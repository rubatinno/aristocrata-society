"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getMentorAccessToken,
} from "@/lib/google-calendar";
import type { BookingStatus } from "@/lib/types";

async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autenticado.");

  // RLS garante que só o mentor dono do agendamento pode alterá-lo.
  const { data: updated, error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId)
    .eq("mentor_id", user.id)
    .select("google_event_id")
    .single();

  if (error) throw new Error("Não foi possível atualizar o agendamento.");

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");

  return { mentorId: user.id, googleEventId: updated?.google_event_id ?? null };
}

export async function markBookingCompleted(bookingId: string) {
  await updateBookingStatus(bookingId, "concluida");
}

export async function cancelBooking(bookingId: string) {
  const { mentorId, googleEventId } = await updateBookingStatus(bookingId, "cancelada");

  // Melhor esforço: remove o evento da agenda do mentor também. Nunca deixa
  // isso quebrar o cancelamento em si, que já aconteceu no passo acima.
  if (googleEventId) {
    try {
      const accessToken = await getMentorAccessToken(mentorId);
      if (accessToken) await deleteCalendarEvent(accessToken, googleEventId);
    } catch (err) {
      console.error("Falha ao remover evento do Google Calendar:", err);
    }
  }
}

export async function markBookingNoShow(bookingId: string) {
  await updateBookingStatus(bookingId, "no_show");
}

export interface RescheduleResult {
  ok: boolean;
  message?: string;
}

/** Reagenda uma chamada pra uma nova data/hora, mantendo a mesma duração.
 * A constraint `bookings_no_overlap` no banco é quem garante de verdade que
 * não dá pra reagendar em cima de outro agendamento — a checagem via
 * get_busy_ranges aqui é só pra devolver uma mensagem amigável. */
export async function rescheduleBooking(
  bookingId: string,
  dateKey: string, // yyyy-MM-dd, no fuso do mentor
  time: string, // HH:mm, no fuso do mentor
): Promise<RescheduleResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, timezone")
    .eq("id", user.id)
    .maybeSingle();

  const timeZone = profile?.timezone ?? "America/Sao_Paulo";

  const { data: booking } = await supabase
    .from("bookings")
    .select("starts_at, ends_at, mentee_name, mentee_email, notes, google_event_id")
    .eq("id", bookingId)
    .eq("mentor_id", user.id)
    .maybeSingle();

  if (!booking) return { ok: false, message: "Agendamento não encontrado." };

  const durationMs = new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime();
  const newStartsAt = fromZonedTime(`${dateKey}T${time}`, timeZone);
  const newEndsAt = new Date(newStartsAt.getTime() + durationMs);

  if (newStartsAt <= new Date()) {
    return { ok: false, message: "Escolha um horário no futuro." };
  }

  const { data: busy } = await supabase.rpc("get_busy_ranges", {
    p_mentor_id: user.id,
    p_from: newStartsAt.toISOString(),
    p_to: newEndsAt.toISOString(),
  });

  if (busy && busy.length > 0) {
    return { ok: false, message: "Esse horário já está ocupado por outro agendamento." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ starts_at: newStartsAt.toISOString(), ends_at: newEndsAt.toISOString() })
    .eq("id", bookingId)
    .eq("mentor_id", user.id);

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, message: "Esse horário já está ocupado por outro agendamento." };
    }
    return { ok: false, message: "Não foi possível reagendar. Tente novamente." };
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");

  // Melhor esforço: recria o evento no Google Calendar no novo horário.
  // Nunca deixa isso quebrar o reagendamento em si, que já aconteceu acima.
  if (booking.google_event_id) {
    try {
      const accessToken = await getMentorAccessToken(user.id);
      if (accessToken) {
        await deleteCalendarEvent(accessToken, booking.google_event_id);
        const eventId = await createCalendarEvent({
          accessToken,
          summary: `Mentoria: ${profile?.full_name ?? "Mentor"} + ${booking.mentee_name}`,
          description: booking.notes ?? undefined,
          startsAt: newStartsAt.toISOString(),
          endsAt: newEndsAt.toISOString(),
          timeZone,
          attendeeEmail: booking.mentee_email,
        });
        if (eventId) {
          await supabase.from("bookings").update({ google_event_id: eventId }).eq("id", bookingId);
        }
      }
    } catch (err) {
      console.error("Falha ao sincronizar reagendamento com o Google Calendar:", err);
    }
  }

  return { ok: true };
}
