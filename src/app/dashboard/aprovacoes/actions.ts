"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberRole } from "@/lib/types";
import { getTrustedUser } from "@/lib/auth-header";
import { isOwner, OWNER_PROTECTED_MESSAGE } from "@/lib/owner";

type AdminClient = ReturnType<typeof createAdminClient>;
type AccessTarget = "mentee" | "mentor" | "admin" | "none";

/**
 * Deixa o acesso de uma conta igual ao cargo/status escolhido.
 *
 * O cargo vive em dois lugares: approved_mentees (fonte da verdade, usada
 * também no cadastro de quem ainda não criou conta) e as tabelas de perfil —
 * profiles pra mentor/admin, mentee_profiles pra mentorado. Regras:
 * - mentor/admin: cria ou atualiza o profiles. O mentee_profiles antigo fica
 *   guardado, pra não perder anotações/metas se a pessoa voltar a ser
 *   mentorada.
 * - mentorado ou reprovado ("none"): tira o profiles. Isso apagaria junto
 *   (cascade) o histórico de calls como mentor, então só deixa quando não há
 *   nenhuma call nesse histórico.
 * - nunca deixa o sistema sem nenhum admin.
 */
async function applyAccess(
  admin: AdminClient,
  row: { user_id: string | null; email: string; full_name: string | null; phone: string | null },
  target: AccessTarget,
) {
  if (isOwner(row) && target !== "admin") throw new Error(OWNER_PROTECTED_MESSAGE);

  const userId = row.user_id;
  if (!userId) return; // ainda não criou conta: o cadastro aplica o cargo depois

  const { data: currentProfile } = await admin
    .from("profiles")
    .select("id, is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (currentProfile?.is_admin && target !== "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true);
    if ((count ?? 0) <= 1) throw new Error("Precisa haver pelo menos um admin.");
  }

  if (target === "mentor" || target === "admin") {
    if (currentProfile) {
      const { error } = await admin
        .from("profiles")
        .update({ is_admin: target === "admin" })
        .eq("id", userId);
      if (error) throw new Error("Não foi possível atualizar o cargo.");
    } else {
      const { error } = await admin.from("profiles").insert({
        id: userId,
        full_name: row.full_name ?? "",
        slug: `mentor-${userId.slice(0, 8)}`,
        is_admin: target === "admin",
      });
      if (error) throw new Error("Não foi possível dar acesso ao painel.");
    }
    return;
  }

  if (currentProfile) {
    const { count: calls } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("mentor_id", userId);
    if ((calls ?? 0) > 0) {
      throw new Error(
        "Essa pessoa tem calls no histórico como mentor. Tirar o acesso dela apagaria esse histórico, então não dá pra fazer por aqui.",
      );
    }
  }

  if (target === "mentee") {
    const { error } = await admin
      .from("mentee_profiles")
      .upsert(
        { id: userId, email: row.email, full_name: row.full_name, phone: row.phone },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (error) throw new Error("Não foi possível criar o perfil de mentorado.");
  }

  if (currentProfile) {
    const { error } = await admin.from("profiles").delete().eq("id", userId);
    if (error) throw new Error("Não foi possível tirar o acesso ao painel.");
  }
}

function revalidateMembers() {
  revalidatePath("/dashboard/aprovacoes");
  revalidatePath("/dashboard/mentorados");
  revalidatePath("/dashboard/equipe");
  revalidatePath("/agendar");
}

async function loadRow(id: string) {
  const supabase = await requireAdmin();
  const { data: row } = await supabase
    .from("approved_mentees")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) throw new Error("Pessoa não encontrada.");
  return row;
}

function assertRole(role: MemberRole) {
  if (!["mentee", "mentor", "admin"].includes(role)) throw new Error("Cargo inválido.");
}

/** Aprova (ou reaprova quem tinha sido reprovado) com o cargo escolhido. */
export async function approveAs(id: string, role: MemberRole) {
  assertRole(role);
  const row = await loadRow(id);
  const admin = createAdminClient();

  await applyAccess(admin, row, role);

  // Desfaz o bloqueio de login de quem tinha sido reprovado.
  if (row.user_id) {
    await admin.auth.admin.updateUserById(row.user_id, { ban_duration: "none" });
  }

  const { error } = await admin
    .from("approved_mentees")
    .update({ status: "approved", role })
    .eq("id", id);
  if (error) throw new Error("Não foi possível aprovar.");

  revalidateMembers();
}

/**
 * Reprova / tira o acesso — também de quem já estava aprovado. Além de
 * marcar como reprovado, bloqueia o login da conta (ban), então a pessoa
 * não entra mais por nenhuma aba. Reaprovar desbloqueia.
 *
 * Mentor com calls no histórico: o perfil fica (apagar levaria o histórico
 * junto), mas perde o admin e os horários são desativados, então ninguém
 * consegue marcar com ele.
 */
export async function rejectMentee(id: string) {
  const row = await loadRow(id);
  if (isOwner(row)) throw new Error(OWNER_PROTECTED_MESSAGE);
  const me = await getTrustedUser(await requireAdmin());
  if (row.user_id && me?.id === row.user_id) {
    throw new Error("Você não pode tirar o seu próprio acesso. Peça para outro admin fazer isso.");
  }
  const admin = createAdminClient();

  if (row.user_id) {
    const userId = row.user_id;
    const [{ data: currentProfile }, { count: calls }] = await Promise.all([
      admin.from("profiles").select("id, is_admin").eq("id", userId).maybeSingle(),
      admin.from("bookings").select("id", { count: "exact", head: true }).eq("mentor_id", userId),
    ]);

    if (currentProfile && (calls ?? 0) > 0) {
      if (currentProfile.is_admin) {
        const { count } = await admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_admin", true);
        if ((count ?? 0) <= 1) throw new Error("Precisa haver pelo menos um admin.");
        await admin.from("profiles").update({ is_admin: false }).eq("id", userId);
      }
      await Promise.all([
        admin.from("availability_rules").update({ is_active: false }).eq("mentor_id", userId),
        admin.from("availability_dates").update({ is_active: false }).eq("mentor_id", userId),
      ]);
    } else {
      await applyAccess(admin, row, "none");
    }

    const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (banError && banError.code !== "user_not_found") {
      throw new Error("Não foi possível bloquear o login dessa pessoa.");
    }
  }

  const { error } = await admin.from("approved_mentees").update({ status: "rejected" }).eq("id", id);
  if (error) throw new Error("Não foi possível reprovar.");

  revalidateMembers();
}

/**
 * Troca o cargo de qualquer pessoa. Pendente/reprovado: só guarda o cargo
 * (vale quando for aprovado). Aprovado: aplica o acesso na hora.
 */
export async function changeMemberRole(id: string, role: MemberRole) {
  assertRole(role);
  const row = await loadRow(id);
  if (isOwner(row) && role !== "admin") throw new Error(OWNER_PROTECTED_MESSAGE);
  if (row.role === role) return;
  const admin = createAdminClient();

  if (row.status === "approved") await applyAccess(admin, row, role);

  const { error } = await admin.from("approved_mentees").update({ role }).eq("id", id);
  if (error) throw new Error("Não foi possível atualizar o cargo.");

  revalidateMembers();
}

/**
 * Remove por completo — inclusive a conta de login, se já existir. Sem
 * isso, o e-mail ficava "preso": o registro de aprovação sumia mas
 * auth.users (e mentee_profiles) continuavam existindo, e um novo cadastro
 * com o mesmo e-mail caía em "usuário já existe". Só mexe em contas de
 * mentorado — mentor/admin têm fluxo próprio de remoção em Equipe.
 */
export async function removeMentee(id: string) {
  const supabase = await requireAdmin();

  const { data: row } = await supabase
    .from("approved_mentees")
    .select("user_id, role, email")
    .eq("id", id)
    .maybeSingle();

  if (row && isOwner(row)) throw new Error(OWNER_PROTECTED_MESSAGE);

  if (row?.role === "mentee" && row.user_id) {
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.deleteUser(row.user_id);
    // user_not_found: a conta já não existia (ex: nunca chegou a se
    // cadastrar) — segue normal, só a linha de aprovação precisa sumir.
    if (authError && authError.code !== "user_not_found") {
      throw new Error("Não foi possível remover a conta de login desse mentorado.");
    }
  }

  const { error } = await supabase.from("approved_mentees").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover.");

  revalidatePath("/dashboard/aprovacoes");
  revalidatePath("/dashboard/mentorados");
}

export async function updateMenteePlan(id: string, planId: string | null) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("approved_mentees")
    .update({ plan_id: planId })
    .eq("id", id);

  if (error) throw new Error("Não foi possível atualizar o plano.");

  revalidatePath("/dashboard/aprovacoes");
  revalidatePath("/dashboard/mentorados");
}

/**
 * Redefine a senha de login de um mentorado — usado quando ele esquece a
 * senha e não tem como recuperar sozinho. Exige a service role porque é uma
 * operação de auth administrativa, sem passar pelo fluxo normal de "esqueci
 * minha senha" (que dependeria do mentorado ter acesso ao e-mail).
 */
export async function adminSetMenteePassword(userId: string, newPassword: string) {
  const supabase = await requireAdmin();

  // A senha do criador só ele mesmo troca.
  if (isOwner({ user_id: userId })) {
    const me = await getTrustedUser(supabase);
    if (!isOwner({ user_id: me?.id })) throw new Error("Só o criador do sistema pode trocar a senha dessa conta.");
  }

  if (newPassword.length < 6) {
    throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw new Error("Não foi possível alterar a senha.");
}

export interface InviteFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

/** Pré-aprova um e-mail como mentor/admin antes mesmo da pessoa se cadastrar. */
export async function inviteAs(
  _prevState: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const supabase = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "mentor") as MemberRole;

  if (!email.includes("@")) return { status: "error", message: "Informe um e-mail válido." };

  const { error } = await supabase.from("approved_mentees").insert({
    email,
    full_name: null,
    phone: null,
    status: "approved",
    role,
    plan_id: null,
    added_by: null,
  });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "Esse e-mail já está na lista." };
    }
    return { status: "error", message: "Não foi possível convidar. Tente novamente." };
  }

  revalidatePath("/dashboard/aprovacoes");
  return {
    status: "success",
    message: "Convite criado — a pessoa ganha o acesso automaticamente ao entrar pelo login.",
  };
}
