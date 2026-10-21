import { addDays } from "date-fns";
import { LogoMark } from "@/components/logo";
import { MentorPicker, type MentorOption } from "@/components/booking/mentor-picker";
import type { GateReason } from "@/components/booking/booking-flow";
import { UpcomingBookingBanner } from "@/components/booking/upcoming-booking-banner";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getMenteeSession } from "@/app/agendar/mentee-actions";
import { isWeeklyLimitReached } from "@/lib/booking-limits";
import { dateKey, matchesCallNumber } from "@/lib/scheduling";
import type { AvailabilityDate, AvailabilityRule, Plan, Profile } from "@/lib/types";

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: Promise<{ mentor?: string }>;
}) {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const { mentor: initialSlug } = await searchParams;
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .neq("full_name", "")
    .order("full_name");

  const now = new Date();
  const allProfiles = (profiles as Profile[]) ?? [];

  // Antes, cada mentor disparava 3 queries próprias (3×N round-trips, N×3
  // requisições simultâneas brigando pela mesma origem). Batchamos as duas
  // que não dependem de um RPC por mentor — recurring_enabled e
  // availability_dates — num punhado de queries só, o que derruba bastante
  // o tempo de carregamento da página pública de agendamento.
  const recurringMentorIds = allProfiles.filter((p) => p.recurring_enabled).map((p) => p.id);
  const rulesPromise = recurringMentorIds.length
    ? supabase.from("availability_rules").select("*").in("mentor_id", recurringMentorIds).eq("is_active", true)
    : Promise.resolve({ data: [] as AvailabilityRule[] | null });

  // Data de "hoje" no fuso do PRÓPRIO mentor, não em UTC — em fusos
  // negativos (ex: Brasil), UTC já vira o dia seguinte horas antes da
  // meia-noite local, o que excluía indevidamente o resto do dia local.
  // Agrupamos por fuso horário (normalmente um só) pra batchar em vez de
  // uma query por mentor.
  const mentorIdsByTimezone = new Map<string, string[]>();
  for (const p of allProfiles) {
    const list = mentorIdsByTimezone.get(p.timezone) ?? [];
    list.push(p.id);
    mentorIdsByTimezone.set(p.timezone, list);
  }
  const dateRulesPromises = Array.from(mentorIdsByTimezone.entries()).map(([timezone, mentorIds]) =>
    supabase
      .from("availability_dates")
      .select("*")
      .in("mentor_id", mentorIds)
      .eq("is_active", true)
      .gte("date", dateKey(now, timezone)),
  );

  const [{ data: allRules }, ...dateRulesResults] = await Promise.all([rulesPromise, ...dateRulesPromises]);

  const rulesByMentor = new Map<string, AvailabilityRule[]>();
  for (const rule of (allRules as AvailabilityRule[]) ?? []) {
    const list = rulesByMentor.get(rule.mentor_id) ?? [];
    list.push(rule);
    rulesByMentor.set(rule.mentor_id, list);
  }
  const dateRulesByMentor = new Map<string, AvailabilityDate[]>();
  for (const result of dateRulesResults) {
    for (const dateRule of (result.data as AvailabilityDate[]) ?? []) {
      const list = dateRulesByMentor.get(dateRule.mentor_id) ?? [];
      list.push(dateRule);
      dateRulesByMentor.set(dateRule.mentor_id, list);
    }
  }

  const mentorsWithEmpty: MentorOption[] = await Promise.all(
    allProfiles.map(async (profile) => {
      const windowEnd = addDays(now, profile.booking_window_days);

      // O RPC só aceita um mentor por chamada, então continua por mentor —
      // mas agora é a única query que sobra no loop.
      const { data: busyRanges } = await supabase.rpc("get_busy_ranges", {
        p_mentor_id: profile.id,
        p_from: now.toISOString(),
        p_to: windowEnd.toISOString(),
      });

      return {
        profile,
        rules: profile.recurring_enabled ? (rulesByMentor.get(profile.id) ?? []) : [],
        dateRules: dateRulesByMentor.get(profile.id) ?? [],
        busyRanges: busyRanges ?? [],
      };
    }),
  );

  const menteeSession = await getMenteeSession();
  let upcomingBooking: { startsAt: string; mentorName: string; timezone: string } | null = null;
  let weeklyLimitReached = false;
  // Sem login: pede pra registrar/entrar. Logado mas ainda não aprovado por
  // um mentor: pede pra aguardar aprovação. Só mostramos horários de
  // verdade pra quem já está aprovado.
  let gateReason: GateReason = menteeSession ? null : "anonymous";
  // Quantas chamadas (concluídas ou "não compareceu") o mentorado já teve,
  // com qualquer mentor, mais 1 — define se ele está na 1ª, 2ª, 3ª chamada
  // etc. Horários com `required_call_number` só aparecem pra quem está
  // exatamente nesse número; sem restrição (null), aparecem pra todo mundo.
  let menteeCallNumber = 1;

  if (menteeSession) {
    const admin = createAdminClient();

    const [{ data: booking }, { data: approval }, { count: completedCount }] = await Promise.all([
      admin
        .from("bookings")
        .select("starts_at, mentor_id")
        .eq("mentee_id", menteeSession.userId)
        .eq("status", "confirmada")
        .gte("starts_at", now.toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin.from("approved_mentees").select("plan_id, status").eq("email", menteeSession.email).maybeSingle(),
      admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("mentee_email", menteeSession.email)
        .in("status", ["concluida", "no_show"]),
    ]);

    menteeCallNumber = (completedCount ?? 0) + 1;

    if (booking) {
      const { data: mentorProfile } = await admin
        .from("profiles")
        .select("full_name, timezone")
        .eq("id", booking.mentor_id)
        .maybeSingle();

      upcomingBooking = {
        startsAt: booking.starts_at,
        mentorName: mentorProfile?.full_name ?? "seu mentor",
        timezone: mentorProfile?.timezone ?? "America/Sao_Paulo",
      };
    }

    if (!approval || approval.status === "pending") gateReason = "pending";
    else if (approval.status === "rejected") gateReason = "rejected";

    let plan: Plan | null = null;
    if (approval?.plan_id) {
      const { data: planRow } = await admin.from("plans").select("*").eq("id", approval.plan_id).maybeSingle();
      plan = planRow;
    }

    weeklyLimitReached = await isWeeklyLimitReached(admin, menteeSession.email, plan, now);
  }

  const canViewSlots = gateReason === null;

  // Mentor sem nenhum horário disponível pra ESSE mentorado específico (seja
  // porque não tem nada configurado, seja porque tudo que ele tem é
  // restrito a outra chamada) nem aparece na lista — evita mostrar alguém
  // sem nada que ele possa realmente marcar.
  const mentors = mentorsWithEmpty
    .map((m) =>
      canViewSlots
        ? {
            ...m,
            rules: m.rules.filter((r) => matchesCallNumber(r.required_call_number, menteeCallNumber)),
            dateRules: m.dateRules.filter((d) => matchesCallNumber(d.required_call_number, menteeCallNumber)),
          }
        : m,
    )
    .filter((m) => m.rules.length > 0 || m.dateRules.length > 0)
    // Quem não pode ver horários (sem login, ou login ainda não aprovado)
    // não recebe os dados reais de agenda/ocupação no HTML — só o perfil do
    // mentor. O calendário aparece bloqueado porque não há nada pra mostrar.
    .map((m) => (canViewSlots ? m : { ...m, rules: [], dateRules: [], busyRanges: [] }));

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex justify-center">
          <LogoMark className="h-9" />
        </div>

        {upcomingBooking && (
          <UpcomingBookingBanner
            startsAt={upcomingBooking.startsAt}
            mentorName={upcomingBooking.mentorName}
            timezone={upcomingBooking.timezone}
          />
        )}

        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/10 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 right-0 size-64 rounded-full bg-accent/15 blur-3xl"
          />
          <div className="relative">
            <MentorPicker
              mentors={mentors}
              initialSlug={initialSlug}
              hasUpcomingBooking={Boolean(upcomingBooking)}
              weeklyLimitReached={weeklyLimitReached}
              gateReason={gateReason}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
