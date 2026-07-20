import { FinanceiroView } from "@/components/dashboard/financeiro-view";
import { requireMentor } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, Profile } from "@/lib/types";
import { ShieldAlert } from "lucide-react";

export default async function FinanceiroPage() {
  const { profile } = await requireMentor();

  if (!profile.is_admin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Só administradores podem ver o financeiro.</p>
      </div>
    );
  }

  // Precisa da service role: bookings tem RLS restrita ao próprio mentor,
  // mas aqui o admin precisa enxergar a agenda de todo mundo da equipe.
  const admin = createAdminClient();

  const [{ data: mentors }, { data: bookings }] = await Promise.all([
    admin.from("profiles").select("*").order("full_name"),
    admin.from("bookings").select("*").order("starts_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quantas chamadas cada mentor realizou, com acesso à agenda completa da equipe. Filtre por
          mentor, período e status.
        </p>
      </div>

      <FinanceiroView mentors={(mentors as Profile[]) ?? []} bookings={(bookings as Booking[]) ?? []} />
    </div>
  );
}
