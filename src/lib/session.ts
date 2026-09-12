import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrustedUser } from "@/lib/auth-header";
import type { Profile } from "@/lib/types";

/** Cookie que liga o "Modo Mentor" do admin — mesma conta, mesmos dados, só
 * esconde a navegação de admin. Não é impersonar outra pessoa, por isso não
 * precisa de nenhum cuidado extra nas actions de escrita. */
export const MENTOR_MODE_COOKIE = "admin_mentor_mode";

/** Garante um usuário autenticado com perfil de mentor já criado. */
export async function requireMentor() {
  const supabase = await createClient();
  const user = await getTrustedUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    redirect("/sem-acesso");
  }

  const cookieStore = await cookies();
  const mentorModeActive = profile.is_admin && cookieStore.get(MENTOR_MODE_COOKIE)?.value === "1";

  return { supabase, user, profile, mentorModeActive };
}

/** Perfil "incompleto" = ainda não passou pelo onboarding. */
export function needsOnboarding(profile: Profile) {
  return profile.full_name.trim().length === 0;
}
