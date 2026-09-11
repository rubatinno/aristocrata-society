"use server";

import { revalidatePath } from "next/cache";
import { requireMentor } from "@/lib/session";
import type { MentorDiscordCall } from "@/lib/types";

/**
 * Auto-registro do mentor: cada mentor só vê e mexe nas próprias chamadas
 * do Discord (RLS também garante isso — ver migration 0034). O admin
 * continua com a visão de todo mundo em Controle, com suas próprias
 * actions em dashboard/controle/actions.ts.
 */
export async function listMyDiscordCalls() {
  const { supabase, user } = await requireMentor();

  const { data } = await supabase
    .from("mentor_discord_calls")
    .select("*")
    .eq("mentor_id", user.id)
    .order("call_date", { ascending: false });

  return (data as MentorDiscordCall[]) ?? [];
}

export async function addMyDiscordCall(input: { callDate: string; completed: boolean; notes: string }) {
  const { supabase, user } = await requireMentor();

  if (!input.callDate) throw new Error("Informe a data da chamada.");

  const { data, error } = await supabase
    .from("mentor_discord_calls")
    .insert({
      mentor_id: user.id,
      call_date: input.callDate,
      completed: input.completed,
      notes: input.notes.trim() || null,
      added_by: user.id,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("Não foi possível registrar a chamada.");

  revalidatePath("/dashboard/discord");
  revalidatePath("/dashboard/controle");
  return data as MentorDiscordCall;
}

export interface MyDiscordCallPatch {
  call_date?: string;
  completed?: boolean;
  notes?: string | null;
}

export async function updateMyDiscordCall(id: string, patch: MyDiscordCallPatch) {
  const { supabase, user } = await requireMentor();

  const { error } = await supabase
    .from("mentor_discord_calls")
    .update(patch)
    .eq("id", id)
    .eq("mentor_id", user.id);

  if (error) throw new Error("Não foi possível atualizar a chamada.");

  revalidatePath("/dashboard/discord");
  revalidatePath("/dashboard/controle");
}

export async function deleteMyDiscordCall(id: string) {
  const { supabase, user } = await requireMentor();

  const { error } = await supabase
    .from("mentor_discord_calls")
    .delete()
    .eq("id", id)
    .eq("mentor_id", user.id);

  if (error) throw new Error("Não foi possível remover a chamada.");

  revalidatePath("/dashboard/discord");
  revalidatePath("/dashboard/controle");
}
