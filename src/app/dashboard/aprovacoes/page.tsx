import { MenteesManager } from "@/components/dashboard/mentees-manager";
import { requireMentor } from "@/lib/session";
import type { ApprovedMentee, Plan } from "@/lib/types";
import { ShieldAlert } from "lucide-react";

export default async function AprovacoesPage() {
  const { supabase, profile } = await requireMentor();

  if (!profile.is_admin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Só administradores podem aprovar mentorados.</p>
      </div>
    );
  }

  const [{ data: mentees }, { data: plans }] = await Promise.all([
    supabase.from("approved_mentees").select("*").order("created_at", { ascending: false }),
    supabase.from("plans").select("*").order("name"),
  ]);

  const planList = (plans as Plan[]) ?? [];
  const plansById = new Map(planList.map((plan) => [plan.id, plan]));
  const menteesWithPlan = ((mentees as ApprovedMentee[]) ?? []).map((mentee) => ({
    ...mentee,
    plan: mentee.plan_id ? (plansById.get(mentee.plan_id) ?? null) : null,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Aprovações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toda pessoa que se cadastra (querendo agendar ou querendo ser mentora) cai pendente
          aqui. Aprove escolhendo o papel — Mentorado, Mentor ou Admin — ou recuse.
        </p>
      </div>

      <MenteesManager mentees={menteesWithPlan} plans={planList} />
    </div>
  );
}
