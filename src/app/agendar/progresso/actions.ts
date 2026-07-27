"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GoalKind, MenteeGoal } from "@/lib/types";

/**
 * Tarefas e metas são compartilhadas entre o mentorado dono e qualquer
 * mentor (RLS cuida da permissão — ver migrations 0025/0026). `menteeId`
 * sempre identifica o dono, não quem está chamando a action.
 */
export async function listMenteeGoals(menteeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mentee_goals")
    .select("*")
    .eq("mentee_id", menteeId)
    .order("position", { ascending: true });

  return (data as MenteeGoal[]) ?? [];
}

export async function createGoal(
  menteeId: string,
  title: string,
  kind: GoalKind,
  revalidateTarget: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: last } = await supabase
    .from("mentee_goals")
    .select("position")
    .eq("mentee_id", menteeId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("mentee_goals")
    .insert({
      mentee_id: menteeId,
      title: title.trim(),
      kind,
      position: (last?.position ?? -1) + 1,
      added_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("Não foi possível criar o item.");

  revalidatePath(revalidateTarget);
  return data as MenteeGoal;
}

export async function toggleGoal(id: string, completed: boolean, revalidateTarget: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("mentee_goals")
    .update({ is_completed: completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) throw new Error("Não foi possível atualizar o item.");

  revalidatePath(revalidateTarget);
}

export async function deleteGoal(id: string, revalidateTarget: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("mentee_goals").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover o item.");

  revalidatePath(revalidateTarget);
}
