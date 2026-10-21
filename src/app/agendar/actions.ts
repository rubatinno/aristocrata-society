"use server";

import { createClient } from "@/lib/supabase/server";
import { isMenteeProfileComplete } from "@/lib/types";
import { createBookingForMentee, type BookingResult } from "@/lib/booking-service";

export interface CreateBookingInput {
  mentorId: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  notes: string;
}

export type CreateBookingResult = BookingResult;

/**
 * Entrada usada pela tela de agendamento (mentorado logado no próprio app,
 * via sessão Supabase). Resolve quem é o mentorado a partir da sessão e
 * delega toda a validação pro núcleo compartilhado em lib/booking-service —
 * o mesmo usado pela API de integração em api/v1/bookings, pra garantir que
 * as duas portas de entrada nunca divirjam nas regras de elegibilidade,
 * limite semanal, etc.
 */
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

  return createBookingForMentee({
    mentorId: input.mentorId,
    menteeId: user.id,
    menteeName: menteeProfile.full_name!.trim(),
    menteeEmail: (menteeProfile.email || user.email || "").trim().toLowerCase(),
    menteePhone: menteeProfile.phone!.trim(),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    notes: input.notes,
  });
}
