"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCalendarEvent, deleteCalendarEvent, getMentorAccessToken } from "@/lib/google-calendar";
import type { BookingStatus } from "@/lib/types";

export interface AdminActionResult {
  ok: boolean;
  message?: string;
}

function revalidateAll() {
  revalidatePath("/dashboard/financeiro");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
}

async function getBookingOrThrow(admin: ReturnType<typeof createAdminClient>, bookingId: string) {
  const { data: booking } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!booking) throw new Error("Agendamento não encontrado.");
  return booking;
}

/** Controle total do admin sobre qualquer agendamento da equipe — status,
 * reagendamento e troca de mentor — sem ficar restrito a `mentor_id = eu`
 * como as ações do próprio mentor em /dashboard/agenda. */
export async function adminUpdateBookingStatus(bookingId: string, status: BookingStatus) {
  await requireAdmin();
  const admin = createAdminClient();
  const booking = await getBookingOrThrow(admin, bookingId);

  const { error } = await admin.from("bookings").update({ status }).eq("id", bookingId);
  if (error) throw new Error("Não foi possível atualizar o status.");

  revalidateAll();

  if (status === "cancelada" && booking.google_event_id) {
    try {
      const accessToken = await getMentorAccessToken(booking.mentor_id);
      if (accessToken) await deleteCalendarEvent(accessToken, booking.google_event_id);
    } catch (err) {
      console.error("Falha ao remover evento do Google Calendar:", err);
    }
  }
}

export async function adminRescheduleBooking(
  bookingId: string,
  dateKey: string, // yyyy-MM-dd, no fuso do mentor dono do agendamento
  time: string, // HH:mm
): Promise<AdminActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const booking = await getBookingOrThrow(admin, bookingId);

  const { data: mentorProfile } = await admin
    .from("profiles")
    .select("full_name, timezone")
    .eq("id", booking.mentor_id)
    .maybeSingle();
  const timeZone = mentorProfile?.timezone ?? "America/Sao_Paulo";

  const durationMs = new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime();
  const newStartsAt = fromZonedTime(`${dateKey}T${time}`, timeZone);
  const newEndsAt = new Date(newStartsAt.getTime() + durationMs);

  const { data: busy } = await admin.rpc("get_busy_ranges", {
    p_mentor_id: booking.mentor_id,
    p_from: newStartsAt.toISOString(),
    p_to: newEndsAt.toISOString(),
  });
  if (busy && busy.length > 0) {
    return { ok: false, message: "Esse mentor já tem uma chamada marcada nesse horário." };
  }

  const { error } = await admin
    .from("bookings")
    .update({ starts_at: newStartsAt.toISOString(), ends_at: newEndsAt.toISOString() })
    .eq("id", bookingId);

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, message: "Esse mentor já tem uma chamada marcada nesse horário." };
    }
    return { ok: false, message: "Não foi possível reagendar. Tente novamente." };
  }

  revalidateAll();

  // Melhor esforço: recria o evento no Google Calendar no novo horário.
  if (booking.google_event_id) {
    try {
      const accessToken = await getMentorAccessToken(booking.mentor_id);
      if (accessToken) {
        await deleteCalendarEvent(accessToken, booking.google_event_id);
        const eventId = await createCalendarEvent({
          accessToken,
          summary: `Mentoria: ${mentorProfile?.full_name ?? "Mentor"} + ${booking.mentee_name}`,
          description: booking.notes ?? undefined,
          startsAt: newStartsAt.toISOString(),
          endsAt: newEndsAt.toISOString(),
          timeZone,
          attendeeEmail: booking.mentee_email,
        });
        if (eventId) await admin.from("bookings").update({ google_event_id: eventId }).eq("id", bookingId);
      }
    } catch (err) {
      console.error("Falha ao sincronizar reagendamento com o Google Calendar:", err);
    }
  }

  return { ok: true };
}

export async function adminChangeMentor(bookingId: string, newMentorId: string): Promise<AdminActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const booking = await getBookingOrThrow(admin, bookingId);

  if (booking.mentor_id === newMentorId) return { ok: true };

  const { data: busy } = await admin.rpc("get_busy_ranges", {
    p_mentor_id: newMentorId,
    p_from: booking.starts_at,
    p_to: booking.ends_at,
  });
  if (busy && busy.length > 0) {
    return { ok: false, message: "Esse mentor já tem uma chamada marcada nesse horário." };
  }

  const { error } = await admin.from("bookings").update({ mentor_id: newMentorId }).eq("id", bookingId);
  if (error) {
    if (error.code === "23P01") {
      return { ok: false, message: "Esse mentor já tem uma chamada marcada nesse horário." };
    }
    return { ok: false, message: "Não foi possível trocar o mentor. Tente novamente." };
  }

  revalidateAll();

  // Melhor esforço: tira o evento da agenda do mentor antigo e recria na do novo.
  if (booking.google_event_id) {
    try {
      const oldAccessToken = await getMentorAccessToken(booking.mentor_id);
      if (oldAccessToken) await deleteCalendarEvent(oldAccessToken, booking.google_event_id);
    } catch (err) {
      console.error("Falha ao remover evento do mentor antigo:", err);
    }
  }
  try {
    const { data: newMentorProfile } = await admin
      .from("profiles")
      .select("full_name, timezone, google_calendar_connected")
      .eq("id", newMentorId)
      .maybeSingle();

    if (newMentorProfile?.google_calendar_connected) {
      const accessToken = await getMentorAccessToken(newMentorId);
      if (accessToken) {
        const eventId = await createCalendarEvent({
          accessToken,
          summary: `Mentoria: ${newMentorProfile.full_name} + ${booking.mentee_name}`,
          description: booking.notes ?? undefined,
          startsAt: booking.starts_at,
          endsAt: booking.ends_at,
          timeZone: newMentorProfile.timezone,
          attendeeEmail: booking.mentee_email,
        });
        if (eventId) await admin.from("bookings").update({ google_event_id: eventId }).eq("id", bookingId);
      }
    }
  } catch (err) {
    console.error("Falha ao criar evento na agenda do novo mentor:", err);
  }

  return { ok: true };
}
