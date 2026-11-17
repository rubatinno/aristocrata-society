import { addDays, format } from "date-fns";
import { MenteesManager } from "@/components/dashboard/mentees-manager";
import { requireMentor } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApprovedMentee, Booking, Plan } from "@/lib/types";
import { ShieldAlert } from "lucide-react";

export default async function AprovacoesPage() {
  const { supabase, profile, mentorModeActive } = await requireMentor();

  if (!profile.is_admin || mentorModeActive) {
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
  const menteeList = (mentees as ApprovedMentee[]) ?? [];

  // Calls já usadas (concluída ou não compareceu), igual à aba Membros —
  // service role pra enxergar as chamadas de todos os mentores.
  const usedByEmail = new Map<string, number>();
  if (menteeList.length > 0) {
    const { data: bookings } = await createAdminClient()
      .from("bookings")
      .select("mentee_email, status")
      .in("mentee_email", menteeList.map((m) => m.email))
      .in("status", ["concluida", "no_show"]);
    for (const b of (bookings as Pick<Booking, "mentee_email" | "status">[]) ?? []) {
      usedByEmail.set(b.mentee_email, (usedByEmail.get(b.mentee_email) ?? 0) + 1);
    }
  }

  // "Hoje" no fuso de São Paulo, calculado no servidor pra filtro e tela
  // concordarem (sem divergência de hidratação).
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const menteesWithPlan = menteeList.map((mentee) => {
    const plan = mentee.plan_id ? (plansById.get(mentee.plan_id) ?? null) : null;
    const durationDays = mentee.duration_days_override ?? plan?.duration_days ?? null;
    const endDate = durationDays
      ? format(addDays(new Date(`${mentee.starts_at}T12:00:00`), durationDays), "yyyy-MM-dd")
      : null;
    return {
      ...mentee,
      plan,
      usedCalls: usedByEmail.get(mentee.email) ?? 0,
      totalCalls: mentee.total_calls_override ?? plan?.total_calls ?? null,
      endDate,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Aprovações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toda pessoa que se cadastra cai aqui como pendente. Escolha o cargo (Mentorado, Mentor
          ou Admin) e aprove ou reprove — dá pra mudar o cargo e a situação de qualquer pessoa
          depois. Em &quot;Ver como&quot; você abre o painel dela exatamente como ela vê. Nos
          mentorados aprovados, &quot;Editar&quot; ajusta a data de entrada, o encerramento e o total de calls.
        </p>
      </div>

      <MenteesManager mentees={menteesWithPlan} plans={planList} today={today} />
    </div>
  );
}
