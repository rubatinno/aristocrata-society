"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { VIEW_AS_COOKIE } from "@/lib/mentee-session";
import { VIEW_AS_MENTOR_COOKIE } from "@/lib/session";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  // Expira sozinho: se o admin esquecer de sair, não fica preso no modo
  // visualização (que bloqueia qualquer alteração no painel).
  maxAge: 60 * 60 * 2,
};

/**
 * "Ver como" a partir de Aprovações: abre o painel da pessoa exatamente como
 * ela vê. Mentorado cai na área do mentorado (/agendar, mecanismo que já
 * existia); mentor/admin cai no painel de mentor, em modo só leitura.
 */
export async function startViewAs(approvedId: string) {
  const supabase = await requireAdmin();

  const { data: row } = await supabase
    .from("approved_mentees")
    .select("user_id, role, status")
    .eq("id", approvedId)
    .maybeSingle();

  if (!row?.user_id) throw new Error("Essa pessoa ainda não criou a conta.");
  if (row.status !== "approved") throw new Error("Só dá pra visualizar quem já foi aprovado.");

  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_COOKIE);
  cookieStore.delete(VIEW_AS_MENTOR_COOKIE);

  if (row.role === "mentee") {
    cookieStore.set(VIEW_AS_COOKIE, row.user_id, COOKIE_OPTIONS);
    redirect("/agendar");
  }

  cookieStore.set(VIEW_AS_MENTOR_COOKIE, row.user_id, COOKIE_OPTIONS);
  redirect("/dashboard");
}
