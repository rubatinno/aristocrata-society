"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/lib/types";

async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autenticado.");

  // RLS garante que só o mentor dono do agendamento pode alterá-lo.
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId)
    .eq("mentor_id", user.id);

  if (error) throw new Error("Não foi possível atualizar o agendamento.");

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
}

export async function markBookingCompleted(bookingId: string) {
  await updateBookingStatus(bookingId, "concluida");
}

export async function cancelBooking(bookingId: string) {
  await updateBookingStatus(bookingId, "cancelada");
}

export async function markBookingNoShow(bookingId: string) {
  await updateBookingStatus(bookingId, "no_show");
}
