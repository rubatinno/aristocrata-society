"use server";

import { startOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMenteeProfileComplete, type Plan } from "@/lib/types";
import { createCalendarEvent, getMentorAccessToken } from "@/lib/google-calendar";

export interface CreateBookingInput {
  mentorId: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  notes: string;
}

export interface CreateBookingResult {
  ok: boolean;
  message?: string;
  needsApproval?: boolean;
  expired?: boolean;
}

const APPROVAL_PENDING_MESSAGE =
  "Sua conta ainda não foi aprovada por um mentor, então esse horário não ficou reservado. Envie uma mensagem no grupo da mentoria solicitando acesso e, assim que for aprovado, volte aqui e marque novamente — a aprovação não agenda automaticamente o horário que você escolheu agora.";
const APPROVAL_REJECTED_MESSAGE =
  "Seu acesso não foi aprovado. Envie um e-mail para o grupo da mentoria para mais informações.";

const DEFAULT_CALLS_PER_WEEK = 1;

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

/** Mensagem detalhada de mentoria vencida — mostra o período, o motivo
 * exato (prazo encerrado ou chamadas esgotadas), agradece e direciona pra
 * consultar renovação no grupo do WhatsApp do mentorado (sem expor o link
 * em si — só a instrução). */
function buildExpiredPlanMessage(input: {
  reason: "duration" | "calls";
  startsAt: string; // yyyy-MM-dd
  endDate: Date | null;
  callsUsed?: number;
  callsLimit?: number;
}) {
  const start = formatLongDate(new Date(`${input.startsAt}T12:00:00`));
  const periodo = input.endDate ? `${start} até ${formatLongDate(input.endDate)}` : `Início em ${start}`;

  const motivo =
    input.reason === "duration"
      ? "o prazo da sua mentoria chegou ao fim."
      : `o número de chamadas do seu plano foi atingido (${input.callsUsed} de ${input.callsLimit} chamadas realizadas).`;

  const renovacao = "Para consultar a renovação, fale com a gente pelo grupo do WhatsApp da mentoria.";

  return [
    "Sua mentoria chegou ao fim.",
    "",
    `Período: ${periodo}`,
    `Motivo: ${motivo}`,
    "",
    "Obrigado por todo esse tempo com a gente e por confiar na Aristocrata Society!",
    renovacao,
  ].join("\n");
}

async function countBookings(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  from?: Date,
  to?: Date,
) {
  let query = admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("mentee_email", email)
    .neq("status", "cancelada");

  if (from) query = query.gte("starts_at", from.toISOString());
  if (to) query = query.lt("starts_at", to.toISOString());

  const { count } = await query;
  return count ?? 0;
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "Faça login para agendar." };

  // Ninguém com perfil de mentor/admin tem uma conta de mentorado de
  // verdade — só chega aqui autenticado assim durante o "modo visualização"
  // (ver startViewAsMentee). Agendar em nome do mentorado, de propósito,
  // não é o objetivo dessa função.
  const { data: mentorProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (mentorProfile) {
    return {
      ok: false,
      message: "Ações de agendamento estão desabilitadas no modo de visualização como mentorado.",
    };
  }

  const { data: menteeProfile } = await supabase
    .from("mentee_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!menteeProfile || !isMenteeProfileComplete(menteeProfile)) {
    return { ok: false, message: "Complete seu nome e telefone antes de agendar." };
  }

  const menteeName = menteeProfile.full_name!.trim();
  const menteeEmail = (menteeProfile.email || user.email || "").trim().toLowerCase();
  const menteePhone = menteeProfile.phone!.trim();

  if (new Date(input.startsAt) <= new Date()) {
    return { ok: false, message: "Esse horário não está mais disponível." };
  }

  const admin = createAdminClient();

  const { data: approval } = await admin
    .from("approved_mentees")
    .select("*")
    .eq("email", menteeEmail)
    .maybeSingle();

  // O registro em approved_mentees já é criado automaticamente no cadastro
  // (trigger handle_new_user), sempre como "pending" até um admin aprovar.
  if (!approval || approval.status === "pending") {
    return { ok: false, needsApproval: true, message: APPROVAL_PENDING_MESSAGE };
  }

  if (approval.status === "rejected") {
    return { ok: false, needsApproval: true, message: APPROVAL_REJECTED_MESSAGE };
  }

  let plan: Plan | null = null;
  if (approval.plan_id) {
    const { data: planRow } = await admin
      .from("plans")
      .select("*")
      .eq("id", approval.plan_id)
      .maybeSingle();
    plan = planRow;
  }

  const requestedStart = new Date(input.startsAt);
  const now = new Date();

  // Um admin pode ajustar total de chamadas/duração por mentorado direto em
  // Mentorados, sem precisar mexer no plano (que afetaria todo mundo nele).
  const effectiveDurationDays = approval.duration_days_override ?? plan?.duration_days ?? null;
  const effectiveTotalCalls = approval.total_calls_override ?? plan?.total_calls ?? null;

  const planEndDate = effectiveDurationDays
    ? addDays(new Date(`${approval.starts_at}T00:00:00`), effectiveDurationDays)
    : null;

  if (planEndDate && now > planEndDate) {
    return {
      ok: false,
      expired: true,
      message: buildExpiredPlanMessage({
        reason: "duration",
        startsAt: approval.starts_at,
        endDate: planEndDate,
      }),
    };
  }

  if (effectiveTotalCalls) {
    const total = await countBookings(admin, menteeEmail);
    if (total >= effectiveTotalCalls) {
      return {
        ok: false,
        expired: true,
        message: buildExpiredPlanMessage({
          reason: "calls",
          startsAt: approval.starts_at,
          endDate: planEndDate,
          callsUsed: total,
          callsLimit: effectiveTotalCalls,
        }),
      };
    }
  }

  if (plan?.calls_per_month) {
    const monthCount = await countBookings(
      admin,
      menteeEmail,
      startOfMonth(requestedStart),
      addDays(endOfMonth(requestedStart), 1),
    );
    if (monthCount >= plan.calls_per_month) {
      return { ok: false, message: "Você atingiu o limite de chamadas deste mês no seu plano." };
    }
  }

  const weeklyLimit = plan?.calls_per_week ?? DEFAULT_CALLS_PER_WEEK;
  // Semana de domingo a sábado — o limite libera de novo todo domingo.
  const weekStart = startOfWeek(requestedStart, { weekStartsOn: 0 });
  const weekEnd = addDays(weekStart, 7);
  const weekCount = await countBookings(admin, menteeEmail, weekStart, weekEnd);

  if (weekCount >= weeklyLimit) {
    return {
      ok: false,
      message:
        weeklyLimit === 1
          ? "Só é permitida uma mentoria por semana. Você já tem uma chamada marcada nesta semana — você poderá marcar a próxima a partir de domingo."
          : `Você atingiu o limite de ${weeklyLimit} chamadas por semana do seu plano. Você poderá marcar novamente a partir de domingo.`,
    };
  }

  // Checagem otimista de horário livre; a garantia real contra corrida é a
  // constraint de exclusão `bookings_no_overlap` no banco.
  const { data: busy } = await supabase.rpc("get_busy_ranges", {
    p_mentor_id: input.mentorId,
    p_from: input.startsAt,
    p_to: input.endsAt,
  });

  if (busy && busy.length > 0) {
    return { ok: false, message: "Esse horário acabou de ser reservado. Escolha outro." };
  }

  const { data: newBooking, error } = await admin
    .from("bookings")
    .insert({
      mentor_id: input.mentorId,
      mentee_id: user.id,
      mentee_name: menteeName,
      mentee_email: menteeEmail,
      mentee_phone: menteePhone,
      notes: input.notes.trim() || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      status: "confirmada",
      meeting_link: null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, message: "Esse horário acabou de ser reservado. Escolha outro." };
    }
    return { ok: false, message: "Não foi possível confirmar o agendamento. Tente novamente." };
  }

  // Melhor esforço: cria o evento no Google Calendar do mentor, se ele tiver
  // conectado a conta. Nunca deixa uma falha aqui derrubar o agendamento —
  // o agendamento em si já está confirmado nesse ponto.
  try {
    const { data: mentorProfile } = await admin
      .from("profiles")
      .select("full_name, timezone, google_calendar_connected")
      .eq("id", input.mentorId)
      .maybeSingle();

    if (mentorProfile?.google_calendar_connected) {
      const accessToken = await getMentorAccessToken(input.mentorId);
      if (accessToken) {
        const eventId = await createCalendarEvent({
          accessToken,
          summary: `Mentoria: ${mentorProfile.full_name} + ${menteeName}`,
          description: input.notes.trim() || undefined,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timeZone: mentorProfile.timezone,
          attendeeEmail: menteeEmail,
        });
        if (eventId) {
          await admin.from("bookings").update({ google_event_id: eventId }).eq("id", newBooking.id);
        }
      }
    }
  } catch (err) {
    console.error("Falha ao sincronizar agendamento com o Google Calendar:", err);
  }

  return { ok: true };
}
