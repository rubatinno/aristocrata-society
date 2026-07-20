import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getTrustedUser } from "@/lib/auth-header";

/** Retorna o client autenticado + garante que o usuário atual é admin. */
export async function requireAdmin() {
  const supabase = await createClient();
  const user = await getTrustedUser(supabase);

  if (!user) throw new Error("Não autenticado.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) throw new Error("Apenas administradores podem fazer isso.");

  return supabase;
}
