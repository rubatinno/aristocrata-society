"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteCalendarEvent, getMentorAccessToken } from "@/lib/google-calendar";
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
