"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createPlan, deletePlan, type PlanFormState } from "@/app/dashboard/planos/actions";
import type { Plan } from "@/lib/types";
import { Loader2, Plus, Trash2 } from "lucide-react";

const initialState: PlanFormState = { status: "idle" };

function limitLabel(plan: Plan) {
  const parts: string[] = [];
  if (plan.calls_per_week) parts.push(`${plan.calls_per_week}/semana`);
  if (plan.calls_per_month) parts.push(`${plan.calls_per_month}/mês`);
  if (plan.total_calls) parts.push(`${plan.total_calls} no total`);
  if (plan.duration_days) parts.push(`${plan.duration_days} dias de duração`);
  return parts.length > 0 ? parts.join(" · ") : "Sem limites configurados";
}

export function PlansManager({ plans }: { plans: Plan[] }) {
  const [state, formAction, pending] = useActionState(createPlan, initialState);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemoving, startRemoving] = useTransition();

  function handleDelete(id: string) {
    setRemovingId(id);
    startRemoving(async () => {
      try {
        await deletePlan(id);
        toast.success("Plano removido.");
      } catch {
        toast.error("Não foi possível remover.");
      } finally {
        setRemovingId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-border bg-card p-5"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Nome do plano</Label>
          <Input id="name" name="name" placeholder="Ex: Plano Premium" required />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="calls_per_week">Chamadas por semana</Label>
            <Input id="calls_per_week" name="calls_per_week" type="number" min={1} placeholder="Sem limite" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calls_per_month">Chamadas por mês</Label>
            <Input id="calls_per_month" name="calls_per_month" type="number" min={1} placeholder="Sem limite" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_calls">Chamadas totais</Label>
            <Input id="total_calls" name="total_calls" type="number" min={1} placeholder="Sem limite" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration_days">Duração da mentoria (dias)</Label>
            <Input id="duration_days" name="duration_days" type="number" min={1} placeholder="Sem limite" />
          </div>
        </div>

        {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending} className="gap-1.5">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Criar plano
          </Button>
        </div>
      </form>

      <div className="space-y-2">
        {plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nenhum plano criado ainda.
          </p>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{plan.name}</p>
                <Badge variant="outline" className="mt-1.5">
                  {limitLabel(plan)}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(plan.id)}
                disabled={isRemoving && removingId === plan.id}
                className="text-muted-foreground hover:text-destructive"
              >
                {isRemoving && removingId === plan.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
