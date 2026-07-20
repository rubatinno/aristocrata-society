"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

export interface LinkFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function addMenteeLink(
  _prevState: LinkFormState,
  formData: FormData,
): Promise<LinkFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "error", message: "Sessão expirada, faça login novamente." };

  const menteeId = String(formData.get("mentee_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();

  if (!menteeId) return { status: "error", message: "Mentorado inválido." };
  if (!title) return { status: "error", message: "Dê um nome para o link." };
  if (!/^https?:\/\//i.test(url)) {
    return { status: "error", message: "Informe uma URL válida (começando com http:// ou https://)." };
  }

  const { error } = await supabase.from("mentee_links").insert({
    mentee_id: menteeId,
    title,
    url,
    added_by: user.id,
  });

  if (error) return { status: "error", message: "Não foi possível adicionar o link." };

  revalidatePath("/dashboard/mentorados");
  return { status: "success" };
}

export async function removeMenteeLink(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autenticado.");

  const { error } = await supabase.from("mentee_links").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover o link.");

  revalidatePath("/dashboard/mentorados");
}

/** Só admin: ajusta total de chamadas / dias de acesso de um mentorado
 * específico, sobrepondo o valor do plano dele (sem afetar outros
 * mentorados no mesmo plano). Passe null pra voltar a usar o valor do plano. */
export async function updateMenteeOverrides(
  menteeId: string,
  overrides: { totalCalls: number | null; durationDays: number | null },
) {
  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("approved_mentees")
    .update({
      total_calls_override: overrides.totalCalls,
      duration_days_override: overrides.durationDays,
    })
    .eq("id", menteeId);

  if (error) throw new Error("Não foi possível salvar os ajustes.");

  revalidatePath("/dashboard/mentorados");
  revalidatePath("/agendar");
}
