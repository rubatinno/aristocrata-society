"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberRole } from "@/lib/types";

export async function approveAs(id: string, role: MemberRole) {
  const supabase = await requireAdmin();

  const { data: row, error: fetchError } = await supabase
    .from("approved_mentees")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !row) throw new Error("Não encontrado.");

  const { error } = await supabase
    .from("approved_mentees")
    .update({ status: "approved", role })
    .eq("id", id);

  if (error) throw new Error("Não foi possível aprovar.");

  // Se a pessoa já se cadastrou (tem user_id) e o papel é mentor/admin, dá
  // acesso ao painel na hora — sem precisar da service role pra isso, o
  // admin já pode gerenciar profiles de outros mentores via RLS.
  if ((role === "mentor" || role === "admin") && row.user_id) {
    const admin = createAdminClient();
    await admin.from("profiles").upsert(
      {
        id: row.user_id,
        full_name: row.full_name ?? "",
        slug: `mentor-${row.user_id.slice(0, 8)}`,
        is_admin: role === "admin",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  }

  revalidatePath("/dashboard/aprovacoes");
  revalidatePath("/dashboard/mentorados");
  revalidatePath("/dashboard/equipe");
}

export async function rejectMentee(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("approved_mentees").update({ status: "rejected" }).eq("id", id);
  if (error) throw new Error("Não foi possível recusar.");

  revalidatePath("/dashboard/aprovacoes");
  revalidatePath("/dashboard/mentorados");
}

export async function removeMentee(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("approved_mentees").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover.");

  revalidatePath("/dashboard/aprovacoes");
  revalidatePath("/dashboard/mentorados");
}

export async function updateMenteePlan(id: string, planId: string | null) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("approved_mentees")
    .update({ plan_id: planId })
    .eq("id", id);

  if (error) throw new Error("Não foi possível atualizar o plano.");

  revalidatePath("/dashboard/aprovacoes");
  revalidatePath("/dashboard/mentorados");
}

export interface InviteFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

/** Pré-aprova um e-mail como mentor/admin antes mesmo da pessoa se cadastrar. */
export async function inviteAs(
  _prevState: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const supabase = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "mentor") as MemberRole;

  if (!email.includes("@")) return { status: "error", message: "Informe um e-mail válido." };

  const { error } = await supabase.from("approved_mentees").insert({
    email,
    full_name: null,
    phone: null,
    status: "approved",
    role,
    plan_id: null,
    added_by: null,
  });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "Esse e-mail já está na lista." };
    }
    return { status: "error", message: "Não foi possível convidar. Tente novamente." };
  }

  revalidatePath("/dashboard/aprovacoes");
  return {
    status: "success",
    message: "Convite criado — a pessoa ganha o acesso automaticamente ao entrar pelo login.",
  };
}
