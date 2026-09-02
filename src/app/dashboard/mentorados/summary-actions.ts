"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTrustedUser } from "@/lib/auth-header";
import type { MenteeSummary } from "@/lib/types";

/**
 * Resumo da trajetória do mentorado — só mentor/admin acessam (RLS bloqueia
 * o próprio mentorado, ver migration 0028). Diferente de mentee_notes, aqui
 * é um documento só, sem lista.
 */
async function requireMentorClient() {
  const supabase = await createClient();
  const user = await getTrustedUser(supabase);
  if (!user) throw new Error("Não autenticado.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) throw new Error("Apenas mentores podem acessar o resumo.");

  return supabase;
}

export async function getMenteeSummary(menteeId: string): Promise<MenteeSummary | null> {
  const supabase = await requireMentorClient();

  const { data } = await supabase
    .from("mentee_summaries")
    .select("*")
    .eq("mentee_id", menteeId)
    .maybeSingle();

  return (data as MenteeSummary | null) ?? null;
}

export async function saveMenteeSummary(menteeId: string, content: string, revalidateTarget: string) {
  const supabase = await requireMentorClient();

  const { error } = await supabase
    .from("mentee_summaries")
    .upsert(
      { mentee_id: menteeId, content, updated_at: new Date().toISOString() },
      { onConflict: "mentee_id" },
    );

  if (error) throw new Error("Não foi possível salvar o resumo.");

  revalidatePath(revalidateTarget);
}
