"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { getTrustedUser } from "@/lib/auth-header";

export async function setMentorAdmin(mentorId: string, isAdmin: boolean) {
  const supabase = await requireAdmin();

  if (!isAdmin) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true);

    if ((count ?? 0) <= 1) {
      throw new Error("Precisa haver pelo menos um admin.");
    }
  }

  const { error } = await supabase.from("profiles").update({ is_admin: isAdmin }).eq("id", mentorId);
  if (error) throw new Error("Não foi possível atualizar.");

  revalidatePath("/dashboard/equipe");
}

export async function removeMentor(mentorId: string) {
  const supabase = await requireAdmin();
  const user = await getTrustedUser(supabase);

  if (user?.id === mentorId) {
    throw new Error("Você não pode remover a si mesmo. Peça para outro admin fazer isso.");
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", mentorId)
    .maybeSingle();

  if (target?.is_admin) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true);

    if ((count ?? 0) <= 1) {
      throw new Error("Precisa haver pelo menos um admin.");
    }
  }

  const { error } = await supabase.from("profiles").delete().eq("id", mentorId);
  if (error) throw new Error("Não foi possível remover o mentor.");

  revalidatePath("/dashboard/equipe");
  revalidatePath("/agendar");
}
