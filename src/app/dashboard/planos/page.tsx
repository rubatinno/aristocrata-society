import { PlansManager } from "@/components/dashboard/plans-manager";
import { requireMentor } from "@/lib/session";
import type { Plan } from "@/lib/types";
import { ShieldAlert } from "lucide-react";

export default async function PlanosPage() {
  const { supabase, profile } = await requireMentor();

  if (!profile.is_admin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">
          Só administradores podem gerenciar planos.
        </p>
      </div>
    );
  }

  const { data: plans } = await supabase.from("plans").select("*").order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Planos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie planos com limites de chamadas e duração. Vincule um plano a cada mentorado na
          página de Mentorados.
        </p>
      </div>

      <PlansManager plans={(plans as Plan[]) ?? []} />
    </div>
  );
}
