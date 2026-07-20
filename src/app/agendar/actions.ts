"use server";

import { startOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMenteeProfileComplete, type Plan } from "@/lib/types";

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
}

const APPROVAL_PENDING_MESSAGE =
  "Seu agendamento está indisponível pois precisa de aprovação de um mentor. Envie um e-mail para o grupo da mentoria solicitando acesso.";
const APPROVAL_REJECTED_MESSAGE =
  "Seu acesso não foi aprovado. Envie um e-mail para o grupo da mentoria para mais informações.";

const DEFAULT_CALLS_PER_WEEK = 1;

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

  if (plan?.duration_days) {
    const expiresAt = addDays(new Date(`${approval.starts_at}T00:00:00`), plan.duration_days);
    if (now > expiresAt) {
      return {
        ok: false,
        message: "Sua mentoria expirou. Entre em contato com um mentor para renovar seu acesso.",
      };
    }
  }

  if (plan?.total_calls) {
    const total = await countBookings(admin, menteeEmail);
    if (total >= plan.total_calls) {
      return { ok: false, message: "Você atingiu o limite total de chamadas do seu plano." };
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

  const { error } = await admin.from("bookings").insert({
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
  });

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, message: "Esse horário acabou de ser reservado. Escolha outro." };
    }
    return { ok: false, message: "Não foi possível confirmar o agendamento. Tente novamente." };
  }

  return { ok: true };
}
