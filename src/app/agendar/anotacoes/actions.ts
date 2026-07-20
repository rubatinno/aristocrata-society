"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MenteeNote } from "@/lib/types";

/**
 * Anotações são compartilhadas entre o mentorado dono e qualquer mentor (RLS
 * cuida da permissão — ver migration 0013). `menteeId` sempre identifica o
 * dono das anotações, não quem está chamando a action.
 */
export async function listMenteeNotes(menteeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mentee_notes")
    .select("*")
    .eq("mentee_id", menteeId)
    .order("updated_at", { ascending: false });

  return (data as MenteeNote[]) ?? [];
}

export async function createNote(menteeId: string, revalidateTarget: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mentee_notes")
    .insert({ mentee_id: menteeId, title: "Sem título", content: "" })
    .select("*")
    .single();

  if (error || !data) throw new Error("Não foi possível criar a anotação.");

  revalidatePath(revalidateTarget);
  return data as MenteeNote;
}

export async function updateNote(id: string, title: string, content: string, revalidateTarget: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("mentee_notes")
    .update({ title: title.trim() || "Sem título", content, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("Não foi possível salvar a anotação.");

  revalidatePath(revalidateTarget);
}

export async function deleteNote(id: string, revalidateTarget: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("mentee_notes").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover a anotação.");

  revalidatePath(revalidateTarget);
}

export async function uploadNoteImage(menteeId: string, formData: FormData) {
  const supabase = await createClient();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Nenhum arquivo enviado.");

  const ext = file.name.split(".").pop() ?? "png";
  const path = `${menteeId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("note-images")
    .upload(path, file, { cacheControl: "3600" });

  if (uploadError) throw new Error("Não foi possível enviar a imagem.");

  const { data } = supabase.storage.from("note-images").getPublicUrl(path);
  return data.publicUrl;
}
