import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * Detecta login na aba errada: a conta existe, mas é de mentor tentando
 * entrar como mentorado (ou vice-versa). Retorna a mensagem de erro pra
 * mostrar, ou null se está tudo certo (inclusive quando ainda não existe
 * nenhum dos dois perfis — ex: mentor recém-cadastrado aguardando aprovação).
 */
export async function detectRoleMismatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  expected: "mentor" | "mentee",
): Promise<string | null> {
  if (expected === "mentor") {
    const { data } = await supabase.from("mentee_profiles").select("id").eq("id", userId).maybeSingle();
    if (data) return 'Essa conta é de mentorado. Entre pela aba "Sou mentorado".';
    return null;
  }

  const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (data) return 'Essa conta é de mentor. Entre pela aba "Sou mentor".';
  return null;
}
