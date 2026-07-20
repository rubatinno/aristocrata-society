"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { detectRoleMismatch } from "@/lib/role-guard";
import { getTrustedUser } from "@/lib/auth-header";
import { isMenteeProfileComplete, type MenteeProfile } from "@/lib/types";

export interface MenteeAuthState {
  status: "idle" | "success" | "error" | "check-email";
  message?: string;
}

/** Login/registro de mentorado dentro do diálogo de agendamento — não redireciona,
 * só sinaliza sucesso pro diálogo avançar de passo sem sair da página. */
export async function loginMenteeInline(
  _prevState: MenteeAuthState,
  formData: FormData,
): Promise<MenteeAuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@")) return { status: "error", message: "Informe um e-mail válido." };
  if (!password) return { status: "error", message: "Informe sua senha." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { status: "error", message: "E-mail ou senha incorretos." };

  const mismatch = await detectRoleMismatch(supabase, data.user.id, "mentee");
  if (mismatch) {
    await supabase.auth.signOut();
    return { status: "error", message: mismatch };
  }

  return { status: "success" };
}

export async function registerMenteeInline(
  _prevState: MenteeAuthState,
  formData: FormData,
): Promise<MenteeAuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { status: "error", message: "Informe seu nome." };
  if (!email.includes("@")) return { status: "error", message: "Informe um e-mail válido." };
  if (phone.replace(/\D/g, "").length < 8) {
    return { status: "error", message: "Informe um telefone válido." };
  }
  if (password.length < 6) {
    return { status: "error", message: "A senha precisa ter pelo menos 6 caracteres." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=/agendar`,
      data: { role: "mentee", full_name: fullName, phone },
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return { status: "error", message: "Esse e-mail já tem conta. Tente entrar." };
    }
    return { status: "error", message: "Não foi possível criar sua conta. Tente novamente." };
  }

  if (data.session) return { status: "success" };

  return {
    status: "check-email",
    message: `Enviamos um e-mail de confirmação para ${email}. Clique no link e volte pra cá.`,
  };
}

export interface MenteeSession {
  userId: string;
  email: string;
  profile: MenteeProfile | null;
  isComplete: boolean;
}

export async function getMenteeSession(): Promise<MenteeSession | null> {
  const supabase = await createClient();
  const user = await getTrustedUser(supabase);

  if (!user) return null;

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
}

export async function completeMenteeProfile(fullName: string, phone: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autenticado.");

  const name = fullName.trim();
  const phoneValue = phone.trim();

  if (!name) throw new Error("Informe seu nome.");
  if (phoneValue.replace(/\D/g, "").length < 8) throw new Error("Informe um telefone válido.");

  const { error } = await supabase.from("mentee_profiles").upsert({
    id: user.id,
    email: user.email ?? "",
    full_name: name,
    phone: phoneValue,
  });

  if (error) throw new Error("Não foi possível salvar seu perfil.");
}

export async function menteeSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
