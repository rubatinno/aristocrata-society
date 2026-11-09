import { addDays } from "date-fns";
import {
  MenteesDirectory,
  type MenteeWithDetails,
  type TeamMember,
} from "@/components/dashboard/mentees-directory";
import { requireMentor } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApprovedMentee, Booking, MenteeLink, Plan } from "@/lib/types";

export default async function MentoradosPage() {
  const { supabase, profile, mentorModeActive } = await requireMentor();
  const isAdmin = profile.is_admin && !mentorModeActive;

  const [{ data: mentees }, { data: plans }, { data: links }] = await Promise.all([
    // Só quem foi aprovado como mentorado — mentores/admins também vivem em
    // approved_mentees, mas não têm mentee_profiles, então não pertencem aqui.
    supabase
      .from("approved_mentees")
      .select("*")
      .eq("status", "approved")
      .eq("role", "mentee")
      .order("created_at", { ascending: false }),
    supabase.from("plans").select("*").order("name"),
    supabase.from("mentee_links").select("*").order("created_at", { ascending: false }),
  ]);

  const planList = (plans as Plan[]) ?? [];
  const plansById = new Map(planList.map((plan) => [plan.id, plan]));
  const linksByMentee = new Map<string, MenteeLink[]>();
  for (const link of (links as MenteeLink[]) ?? []) {
    const list = linksByMentee.get(link.mentee_id) ?? [];
    list.push(link);
    linksByMentee.set(link.mentee_id, list);
  }

  const menteeList = (mentees as ApprovedMentee[]) ?? [];

  // Chamadas realizadas contam em qualquer mentor da equipe, não só nas
  // próprias do mentor logado — precisa da service role pra enxergar tudo.
  // "Não compareceu" também conta aqui: consumiu o horário do plano do
  // mentorado igual uma concluída — só não conta pro mentor em
  // Controle/Financeiro (remuneração fica restrita a "concluida").
  const completedByEmail = new Map<string, number>();
  if (menteeList.length > 0) {
    const admin = createAdminClient();
    const emails = menteeList.map((m) => m.email);
    const { data: bookings } = await admin
      .from("bookings")
      .select("mentee_email, status")
      .in("mentee_email", emails)
      .in("status", ["concluida", "no_show"]);

    for (const booking of (bookings as Pick<Booking, "mentee_email" | "status">[]) ?? []) {
      completedByEmail.set(booking.mentee_email, (completedByEmail.get(booking.mentee_email) ?? 0) + 1);
    }
  }

  // Admin vê também a equipe (mentores e admins). O cargo vem do perfil
  // (is_admin), que é o que vale de fato pro acesso.
  let team: TeamMember[] = [];
  if (isAdmin) {
    const admin = createAdminClient();
    const [{ data: teamRows }, { data: profiles }] = await Promise.all([
      admin
        .from("approved_mentees")
        .select("*")
        .eq("status", "approved")
        .in("role", ["mentor", "admin"])
        .order("created_at", { ascending: true }),
      admin.from("profiles").select("id, full_name, is_admin"),
    ]);
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    team = ((teamRows as ApprovedMentee[]) ?? []).map((row) => {
      const teamProfile = row.user_id ? profileById.get(row.user_id) : undefined;
      return {
        id: row.id,
        user_id: row.user_id,
        email: row.email,
        phone: row.phone,
        full_name: teamProfile?.full_name || row.full_name,
        role: (teamProfile ? teamProfile.is_admin : row.role === "admin") ? "admin" : "mentor",
      };
    });
  }

  const now = new Date();

  const menteesWithDetails: MenteeWithDetails[] = menteeList.map((mentee) => {
    const plan = mentee.plan_id ? (plansById.get(mentee.plan_id) ?? null) : null;
    const effectiveDurationDays = mentee.duration_days_override ?? plan?.duration_days ?? null;
    const effectiveTotalCalls = mentee.total_calls_override ?? plan?.total_calls ?? null;
    const daysRemaining = effectiveDurationDays
      ? Math.ceil(
          (addDays(new Date(`${mentee.starts_at}T00:00:00`), effectiveDurationDays).getTime() -
            now.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    return {
      ...mentee,
      plan,
      links: linksByMentee.get(mentee.id) ?? [],
      completedCalls: completedByEmail.get(mentee.email) ?? 0,
      daysRemaining,
      effectiveTotalCalls,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {isAdmin ? "Membros" : "Mentorados"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin
            ? "Todo mundo com acesso aprovado: mentorados, mentores e admins. Daqui dá pra trocar a senha de qualquer um ou tirar o acesso."
            : "Todos os mentorados aprovados na Aristocrata Society. Guarde links de documentos e materiais importantes de cada um."}
        </p>
      </div>

      <MenteesDirectory
        mentees={menteesWithDetails}
        plans={planList}
        isAdmin={isAdmin}
        team={team}
        currentUserId={profile.id}
      />
    </div>
  );
}
