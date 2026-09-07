"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { getTrustedUser } from "@/lib/auth-header";

export async function setMentorRate(mentorId: string, rate: number | null) {
  const supabase = await requireAdmin();

  const { error } = await supabase.from("profiles").update({ rate_per_call: rate }).eq("id", mentorId);
  if (error) throw new Error("Não foi possível salvar o valor por chamada.");

  revalidatePath("/dashboard/controle");
}

export async function addMentorPayment(
  mentorId: string,
  input: { amount: number; paidThrough: string; notes: string },
) {
  const supabase = await requireAdmin();
  const user = await getTrustedUser(supabase);

  if (!(input.amount > 0)) throw new Error("Informe um valor válido.");
  if (!input.paidThrough) throw new Error("Informe até qual data foi pago.");

  const { error } = await supabase.from("mentor_payments").insert({
    mentor_id: mentorId,
    amount: input.amount,
    paid_through: input.paidThrough,
    notes: input.notes.trim() || null,
    added_by: user?.id ?? null,
  });

  if (error) throw new Error("Não foi possível registrar o pagamento.");

  revalidatePath("/dashboard/controle");
}

export async function deleteMentorPayment(id: string) {
  const supabase = await requireAdmin();

  const { error } = await supabase.from("mentor_payments").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover o pagamento.");

  revalidatePath("/dashboard/controle");
}

/**
 * Chamada em grupo no Discord — fora do sistema de agendamento 1:1, mas
 * paga no mesmo valor por chamada, então conta junto no total do mentor.
 */
export async function addDiscordCall(
  mentorId: string,
  input: { callDate: string; notes: string; quantity: number },
) {
  const supabase = await requireAdmin();
  const user = await getTrustedUser(supabase);

  if (!input.callDate) throw new Error("Informe a data da chamada.");
  if (!(input.quantity > 0)) throw new Error("Informe uma quantidade válida.");

  const { error } = await supabase.from("mentor_discord_calls").insert({
    mentor_id: mentorId,
    call_date: input.callDate,
    notes: input.notes.trim() || null,
    quantity: input.quantity,
    added_by: user?.id ?? null,
  });

  if (error) throw new Error("Não foi possível registrar a chamada.");

  revalidatePath("/dashboard/controle");
}

export async function deleteDiscordCall(id: string) {
  const supabase = await requireAdmin();

  const { error } = await supabase.from("mentor_discord_calls").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover a chamada.");

  revalidatePath("/dashboard/controle");
}
