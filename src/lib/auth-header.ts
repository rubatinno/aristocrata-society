import "server-only";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * Usa o id/e-mail que o proxy já validou (via auth.getUser()) e repassou por
 * header, em vez de chamar auth.getUser() de novo em cada página — evita um
 * round-trip a mais pro servidor de autenticação do Supabase por navegação.
 * Só cai de volta pra getUser() se o header não estiver presente (ex: rota
 * fora do matcher do proxy).
 */
export async function getTrustedUser(supabase: SupabaseClient<Database>) {
  const headerList = await headers();
  const id = headerList.get("x-user-id");

  if (id) {
    return { id, email: headerList.get("x-user-email") ?? "" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}
