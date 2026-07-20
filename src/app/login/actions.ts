"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { detectRoleMismatch } from "@/lib/role-guard";

export interface AuthFormState {
  status: "idle" | "error" | "check-email";
  message?: string;
}

type Role = "mentor" | "mentee";

function defaultNextFor(role: Role) {
  return role === "mentor" ? "/dashboard" : "/agendar";
}

export async function registerUser(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const role = (String(formData.get("role") ?? "mentee") as Role) satisfies Role;
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? defaultNextFor(role));

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
      emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { role, full_name: fullName, phone },
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return { status: "error", message: "Esse e-mail já tem conta. Tente entrar." };
    }
    return { status: "error", message: "Não foi possível criar sua conta. Tente novamente." };
  }

  if (data.session) {
    redirect(next);
  }

  return {
    status: "check-email",
    message: `Enviamos um e-mail de confirmação para ${email}. Clique no link pra ativar sua conta.`,
  };
}

export async function loginUser(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = (String(formData.get("role") ?? "mentee") as Role) satisfies Role;
  const next = String(formData.get("next") ?? defaultNextFor(role));

  if (!email.includes("@")) return { status: "error", message: "Informe um e-mail válido." };
  if (!password) return { status: "error", message: "Informe sua senha." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { status: "error", message: "E-mail ou senha incorretos." };
  }

  const mismatch = await detectRoleMismatch(supabase, data.user.id, role);
  if (mismatch) {
    await supabase.auth.signOut();
    return { status: "error", message: mismatch };
  }

  redirect(next);
}
