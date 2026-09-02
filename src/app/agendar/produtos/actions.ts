"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MenteeProduct, MenteeProductCreative } from "@/lib/types";

/**
 * Produtos e criativos são compartilhados entre o mentorado dono e qualquer
 * mentor (RLS cuida da permissão — ver migration 0029). `menteeId` sempre
 * identifica o dono, não quem está chamando a action.
 */
export async function listMenteeProducts(menteeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mentee_products")
    .select("*")
    .eq("mentee_id", menteeId)
    .order("created_at", { ascending: true });

  return (data as MenteeProduct[]) ?? [];
}

export async function listProductCreatives(menteeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mentee_product_creatives")
    .select("*")
    .eq("mentee_id", menteeId)
    .order("created_at", { ascending: true });

  return (data as MenteeProductCreative[]) ?? [];
}

export async function createProduct(menteeId: string, name: string, revalidateTarget: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mentee_products")
    .insert({ mentee_id: menteeId, name: name.trim() || "Novo produto" })
    .select("*")
    .single();

  if (error || !data) throw new Error("Não foi possível criar o produto.");

  revalidatePath(revalidateTarget);
  return data as MenteeProduct;
}

export async function renameProduct(id: string, name: string, revalidateTarget: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("mentee_products")
    .update({ name: name.trim() || "Novo produto", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("Não foi possível renomear o produto.");

  revalidatePath(revalidateTarget);
}

export async function deleteProduct(id: string, revalidateTarget: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("mentee_products").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover o produto.");

  revalidatePath(revalidateTarget);
}

export async function createCreative(productId: string, menteeId: string, revalidateTarget: string) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("mentee_product_creatives")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);

  const { data, error } = await supabase
    .from("mentee_product_creatives")
    .insert({
      product_id: productId,
      mentee_id: menteeId,
      title: `Criativo ${(count ?? 0) + 1}`,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("Não foi possível criar o criativo.");

  revalidatePath(revalidateTarget);
  return data as MenteeProductCreative;
}

export interface CreativePatch {
  title?: string;
  link?: string;
  validated?: boolean;
  sales?: number;
}

export async function updateCreative(id: string, patch: CreativePatch, revalidateTarget: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("mentee_product_creatives")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("Não foi possível salvar o criativo.");

  revalidatePath(revalidateTarget);
}

export async function deleteCreative(id: string, revalidateTarget: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("mentee_product_creatives").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover o criativo.");

  revalidatePath(revalidateTarget);
}
