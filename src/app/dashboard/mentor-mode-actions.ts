"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireMentor, MENTOR_MODE_COOKIE } from "@/lib/session";

/**
 * "Modo Mentor" — o admin passa a ver só o painel comum de mentor (sem
 * Gestão, Aprovações, Equipe, Planos, Financeiro, Controle), separando o
 * trabalho de mentoria dele do trabalho de gestão da Aristocrata Society.
 * É a própria conta dele o tempo todo — só um cookie que esconde a
 * navegação extra, sem trocar sessão nem cliente, então nenhuma ação de
 * escrita precisa de tratamento especial.
 */
export async function enterMentorMode() {
  const { profile } = await requireMentor();
  if (!profile.is_admin) throw new Error("Só administradores podem usar o Modo Mentor.");

  const cookieStore = await cookies();
  cookieStore.set(MENTOR_MODE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/dashboard");
}

export async function exitMentorMode() {
  const cookieStore = await cookies();
  cookieStore.delete(MENTOR_MODE_COOKIE);
  redirect("/dashboard");
}
