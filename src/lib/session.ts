import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrustedUser } from "@/lib/auth-header";
import type { Profile } from "@/lib/types";

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

  return { supabase, user, profile };
}

/** Perfil "incompleto" = ainda não passou pelo onboarding. */
export function needsOnboarding(profile: Profile) {
  return profile.full_name.trim().length === 0;
}
