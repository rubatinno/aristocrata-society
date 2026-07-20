"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

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
