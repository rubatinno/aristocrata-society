import { MenteesDirectory, type MenteeWithDetails } from "@/components/dashboard/mentees-directory";
import { requireMentor } from "@/lib/session";
import type { ApprovedMentee, MenteeLink, Plan } from "@/lib/types";

export default async function MentoradosPage() {
  const { supabase } = await requireMentor();

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

  const menteesWithDetails: MenteeWithDetails[] = ((mentees as ApprovedMentee[]) ?? []).map(
    (mentee) => ({
      ...mentee,
      plan: mentee.plan_id ? (plansById.get(mentee.plan_id) ?? null) : null,
      links: linksByMentee.get(mentee.id) ?? [],
    }),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mentorados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os mentorados aprovados na Aristocrata Society. Guarde links de documentos e
          materiais importantes de cada um.
        </p>
      </div>

      <MenteesDirectory mentees={menteesWithDetails} />
    </div>
  );
}
