import "server-only";
import { startOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/types";
import { createCalendarEvent, getMentorAccessToken } from "@/lib/google-calendar";
import { dateKey, matchesCallNumber, weekdayFromDateKey } from "@/lib/scheduling";

/**
 * Núcleo de criação de agendamento, compartilhado entre o fluxo autenticado
 * (agendar/actions.ts, via sessão Supabase do mentorado) e a API de
 * integração (api/v1/bookings, via chamada server-to-server de outro
 * sistema). As duas entradas passam pelas MESMAS checagens — é o que
 * garante que nunca existam dois lugares com regras diferentes decidindo
 * se um horário pode ser marcado.
 */
export interface BookingRequest {
  mentorId: string;
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  menteePhone: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  notes: string;
}

export interface BookingResult {
  ok: boolean;
  bookingId?: string;
  message?: string;
  needsApproval?: boolean;
  expired?: boolean;
}

const DEFAULT_CALLS_PER_WEEK = 1;

const APPROVAL_PENDING_MESSAGE =
  "Sua conta ainda não foi aprovada por um mentor, então esse horário não ficou reservado. Envie uma mensagem no grupo da mentoria solicitando acesso e, assim que for aprovado, volte aqui e marque novamente — a aprovação não agenda automaticamente o horário que você escolheu agora.";
const APPROVAL_REJECTED_MESSAGE =
  "Seu acesso não foi aprovado. Envie um e-mail para o grupo da mentoria para mais informações.";

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

export async function createBookingForMentee(input: BookingRequest): Promise<BookingResult> {
  if (new Date(input.startsAt) <= new Date()) {
    return { ok: false, message: "Esse horário não está mais disponível." };
  }

  const admin = createAdminClient();
  const menteeEmail = input.menteeEmail.trim().toLowerCase();

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
    const { data: planRow } = await admin.from("plans").select("*").eq("id", approval.plan_id).maybeSingle();
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

  // Confere de novo no servidor se o mentorado está na chamada certa pra
  // esse horário — nunca confia cegamente numa chamada direta (nem da UI,
  // nem de outro sistema integrado).
  const { data: mentorForEligibility } = await admin
    .from("profiles")
    .select("timezone, recurring_enabled")
    .eq("id", input.mentorId)
    .maybeSingle();

  if (mentorForEligibility) {
    const { count: completedCount } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("mentee_email", menteeEmail)
      .in("status", ["concluida", "no_show"]);
    const menteeCallNumber = (completedCount ?? 0) + 1;

    const requestedDateKey = dateKey(requestedStart, mentorForEligibility.timezone);
    const requestedWeekday = weekdayFromDateKey(requestedDateKey);

    const [{ data: dateWindows }, { data: ruleWindows }] = await Promise.all([
      admin
        .from("availability_dates")
        .select("start_time, end_time, required_call_number")
        .eq("mentor_id", input.mentorId)
        .eq("date", requestedDateKey)
        .eq("is_active", true),
      mentorForEligibility.recurring_enabled
        ? admin
            .from("availability_rules")
            .select("start_time, end_time, required_call_number")
            .eq("mentor_id", input.mentorId)
            .eq("weekday", requestedWeekday)
            .eq("is_active", true)
        : Promise.resolve({ data: [] }),
    ]);

    const eligible = [...(dateWindows ?? []), ...(ruleWindows ?? [])].some((w) => {
      if (!matchesCallNumber(w.required_call_number, menteeCallNumber)) return false;
      const windowStart = fromZonedTime(`${requestedDateKey}T${w.start_time}`, mentorForEligibility.timezone);
      const windowEnd = fromZonedTime(`${requestedDateKey}T${w.end_time}`, mentorForEligibility.timezone);
      return requestedStart >= windowStart && requestedStart < windowEnd;
    });

    if (!eligible) {
      return {
        ok: false,
        message: "Esse horário não está mais disponível pro seu momento atual de mentoria. Escolha outro.",
      };
    }
  }

  // Checagem otimista de horário livre; a garantia real contra corrida é a
  // constraint de exclusão `bookings_no_overlap` no banco.
  const { data: busy } = await admin.rpc("get_busy_ranges", {
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
      mentee_id: input.menteeId,
      mentee_name: input.menteeName,
      mentee_email: menteeEmail,
      mentee_phone: input.menteePhone,
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
          summary: `Mentoria: ${mentorProfile.full_name} + ${input.menteeName}`,
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

  return { ok: true, bookingId: newBooking.id };
}

/**
 * Garante que um e-mail vindo de outro sistema tenha conta de mentorado
 * aqui — cria quando ainda não existe, sempre deixando aprovado (quem
 * chamou a API de integração já validou a compra/matrícula do outro lado).
 * Mesma lógica de `inviteAs` (dashboard/aprovacoes/actions.ts), só que
 * criando a conta de login na hora em vez de esperar a pessoa se cadastrar.
 */
export async function ensureMenteeAccount(input: {
  email: string;
  fullName: string;
  phone: string;
  planId?: string | null;
}): Promise<{ menteeId: string; created: boolean }> {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();

  const { data: existingApproval } = await admin
    .from("approved_mentees")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (existingApproval?.user_id) {
    await admin
      .from("approved_mentees")
      .update({
        status: "approved",
        role: "mentee",
        plan_id: input.planId ?? existingApproval.plan_id,
        full_name: fullName || existingApproval.full_name,
        phone: phone || existingApproval.phone,
      })
      .eq("id", existingApproval.id);

    return { menteeId: existingApproval.user_id, created: false };
  }

  if (existingApproval) {
    const { error } = await admin
      .from("approved_mentees")
      .update({
        status: "approved",
        role: "mentee",
        plan_id: input.planId ?? existingApproval.plan_id,
        full_name: fullName || existingApproval.full_name,
        phone: phone || existingApproval.phone,
      })
      .eq("id", existingApproval.id);
    if (error) throw new Error("Não foi possível aprovar o mentorado.");
  } else {
    const { error } = await admin.from("approved_mentees").insert({
      email,
      full_name: fullName || null,
      phone: phone || null,
      status: "approved",
      role: "mentee",
      plan_id: input.planId ?? null,
      added_by: null,
    });
    if (error) throw new Error("Não foi possível aprovar o mentorado.");
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { role: "mentee", full_name: fullName, phone },
  });

  if (createError || !created?.user) {
    // Corrida rara: a conta já existia (ex: duas chamadas quase simultâneas
    // pro mesmo e-mail) — busca o perfil que o handle_new_user já criou em
    // vez de falhar.
    const { data: existingMentee } = await admin
      .from("mentee_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingMentee) return { menteeId: existingMentee.id, created: false };

    throw new Error("Não foi possível criar a conta do mentorado.");
  }

  return { menteeId: created.user.id, created: true };
}
