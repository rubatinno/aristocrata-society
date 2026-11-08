import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTrustedUser } from "@/lib/auth-header";
import type { Profile } from "@/lib/types";

/** Cookie que liga o "Modo Mentor" do admin — mesma conta, mesmos dados, só
 * esconde a navegação de admin. Não é impersonar outra pessoa, por isso não
 * precisa de nenhum cuidado extra nas actions de escrita. */
export const MENTOR_MODE_COOKIE = "admin_mentor_mode";

/** Cookie do "Ver como" de mentor/admin: um admin enxergando o painel de outra
 * pessoa da equipe exatamente como ela vê. É só leitura — o proxy recusa
 * qualquer Server Action em /dashboard enquanto o cookie existir. */
export const VIEW_AS_MENTOR_COOKIE = "view_as_mentor_id";

export interface ViewingAs {
  /** Nome de quem está sendo visualizado. */
  name: string;
  /** Nome do admin que está visualizando. */
  viewerName: string;
}

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

  // "Ver como": só vale se quem está logado de verdade é admin — nunca confia
  // só no cookie. Devolve o perfil da outra pessoa e um client com service
  // role (as policies de RLS só deixariam ler os dados do próprio admin).
  const viewAsId = cookieStore.get(VIEW_AS_MENTOR_COOKIE)?.value;
  if (viewAsId && profile.is_admin && viewAsId !== profile.id) {
    const admin = createAdminClient();
    const [{ data: target }, { data: targetRow }] = await Promise.all([
      admin.from("profiles").select("*").eq("id", viewAsId).maybeSingle<Profile>(),
      admin.from("approved_mentees").select("email").eq("user_id", viewAsId).maybeSingle(),
    ]);

    if (target) {
      return {
        supabase: admin,
        user: { id: target.id, email: targetRow?.email ?? "" },
        profile: target,
        mentorModeActive: false,
        viewingAs: { name: target.full_name || targetRow?.email || "mentor", viewerName: profile.full_name } as
          | ViewingAs
          | null,
      };
    }
  }

  const mentorModeActive = profile.is_admin && cookieStore.get(MENTOR_MODE_COOKIE)?.value === "1";

  return { supabase, user, profile, mentorModeActive, viewingAs: null as ViewingAs | null };
}

/** Perfil "incompleto" = ainda não passou pelo onboarding. */
export function needsOnboarding(profile: Profile) {
  return profile.full_name.trim().length === 0;
}
