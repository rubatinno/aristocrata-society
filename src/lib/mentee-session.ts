import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTrustedUser } from "@/lib/auth-header";
import { isMenteeProfileComplete, type MenteeProfile } from "@/lib/types";

/** Cookie do "modo visualização": um admin vendo o painel de um mentorado. */
export const VIEW_AS_COOKIE = "view_as_mentee_id";

export interface MenteeSession {
  userId: string;
  email: string;
  profile: MenteeProfile | null;
  isComplete: boolean;
  /** true quando quem está vendo é na verdade um admin em "modo visualização". */
  impersonating?: boolean;
}

/**
 * Quem está logado, com o perfil completo.
 *
 * Embrulhado em `cache()` do React: o layout do painel e a página que ele
 * renderiza pedem a sessão cada um por sua conta, e sem isso a mesma consulta
 * a mentee_profiles ia ao Supabase duas (em Aulas, três) vezes na mesma
 * requisição. O cache vale só dentro de uma requisição — nada fica guardado
 * entre navegações, então continua impossível ver o painel de outra pessoa.
 */
export const getMenteeSession = cache(async (): Promise<MenteeSession | null> => {
  const supabase = await createClient();
  const user = await getTrustedUser(supabase);

  if (!user) return null;

  // Modo visualização: um admin pode "entrar" no painel de um mentorado
  // pra ver exatamente o que ele vê (cookie setado por startViewAsMentee).
  // Só vale se o usuário real logado for de fato admin — nunca confia só
  // no cookie.
  const cookieStore = await cookies();
  const viewAsId = cookieStore.get(VIEW_AS_COOKIE)?.value;

  if (viewAsId) {
    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (viewerProfile?.is_admin) {
      const admin = createAdminClient();
      const { data: targetProfile } = await admin
        .from("mentee_profiles")
        .select("*")
        .eq("id", viewAsId)
        .maybeSingle();

      if (targetProfile) {
        return {
          userId: targetProfile.id,
          email: targetProfile.email,
          profile: targetProfile,
          isComplete: isMenteeProfileComplete(targetProfile),
          impersonating: true,
        };
      }
    }
  }

  const { data: profile } = await supabase
    .from("mentee_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email,
    profile: profile ?? null,
    isComplete: profile ? isMenteeProfileComplete(profile) : false,
  };
});

export interface MenteeIdentity {
  userId: string;
  email: string;
}

/**
 * Só o id e o e-mail de quem está logado — o suficiente pra buscar os dados
 * de uma aba.
 *
 * O proxy já validou a sessão e repassou os dois por header, então no caminho
 * normal isto não toca o banco: uma ida a menos ao Supabase em cada troca de
 * aba. Quando o cookie de "modo visualização" está presente, cai na sessão
 * completa, que é quem sabe conferir se o visitante é mesmo admin.
 */
export const getMenteeIdentity = cache(async (): Promise<MenteeIdentity | null> => {
  const cookieStore = await cookies();

  if (!cookieStore.get(VIEW_AS_COOKIE)?.value) {
    const headerList = await headers();
    const id = headerList.get("x-user-id");
    const email = headerList.get("x-user-email");
    if (id && email) return { userId: id, email };
  }

  const session = await getMenteeSession();
  return session ? { userId: session.userId, email: session.email } : null;
});
