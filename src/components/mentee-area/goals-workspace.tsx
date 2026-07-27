"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { createGoal, deleteGoal, toggleGoal } from "@/app/agendar/progresso/actions";
import type { MenteeGoal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Target, Trash2 } from "lucide-react";

export function GoalsWorkspace({
  initialGoals,
  menteeId,
  revalidateTarget,
  canManage,
  className,
}: {
  initialGoals: MenteeGoal[];
  menteeId: string;
  revalidateTarget: string;
  /** Só o mentor pode criar/remover metas — o mentorado só marca como feita. */
  canManage: boolean;
  className?: string;
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, startCreating] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoals(initialGoals);
  }, [initialGoals]);

  // Compartilhada entre mentorado e mentor — escuta mudanças em tempo real
  // pra refletir o que a outra pessoa acabou de marcar/adicionar.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`mentee-goals-${menteeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentee_goals", filter: `mentee_id=eq.${menteeId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setGoals((prev) => prev.filter((g) => g.id !== deletedId));
            return;
          }

          const incoming = payload.new as MenteeGoal;
          setGoals((prev) => {
            const exists = prev.some((g) => g.id === incoming.id);
            const next = exists
              ? prev.map((g) => (g.id === incoming.id ? incoming : g))
              : [...prev, incoming];
            return next.sort((a, b) => a.position - b.position);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [menteeId]);

  const total = goals.length;
  const completed = goals.filter((g) => g.is_completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    startCreating(async () => {
      try {
        const goal = await createGoal(menteeId, title, revalidateTarget);
        setGoals((prev) => [...prev, goal]);
        setNewTitle("");
        inputRef.current?.focus();
      } catch {
        toast.error("Não foi possível criar a meta.");
      }
    });
  }

  function handleNewTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreate();
    }
  }

  function handleToggle(goal: MenteeGoal) {
    const nextCompleted = !goal.is_completed;
    setTogglingId(goal.id);
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id
          ? { ...g, is_completed: nextCompleted, completed_at: nextCompleted ? new Date().toISOString() : null }
          : g,
      ),
    );
    toggleGoal(goal.id, nextCompleted, revalidateTarget)
      .catch(() => {
        toast.error("Não foi possível atualizar a meta.");
        setGoals((prev) =>
          prev.map((g) => (g.id === goal.id ? { ...g, is_completed: goal.is_completed, completed_at: goal.completed_at } : g)),
        );
      })
      .finally(() => setTogglingId(null));
  }

  function handleDelete(id: string) {
    setRemovingId(id);
    deleteGoal(id, revalidateTarget)
      .then(() => setGoals((prev) => prev.filter((g) => g.id !== id)))
      .catch(() => toast.error("Não foi possível remover a meta."))
      .finally(() => setRemovingId(null));
  }

  return (
    <div className={cn("flex flex-col gap-5 p-6", className)}>
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {completed} de {total} {total === 1 ? "meta concluída" : "metas concluídas"}
          </span>
          <span className="text-muted-foreground">{percent}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
          <Target className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nenhuma meta ainda</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {canManage
              ? "Adicione as etapas da mentoria abaixo pra acompanhar o progresso."
              : "Seu mentor ainda não definiu as etapas da sua mentoria."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => handleToggle(goal)}
                disabled={togglingId === goal.id}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  goal.is_completed ? "border-primary bg-primary" : "border-muted-foreground/40",
                )}
              >
                {goal.is_completed && (
                  <svg viewBox="0 0 24 24" className="size-3 text-primary-foreground" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  goal.is_completed && "text-muted-foreground line-through",
                )}
              >
                {goal.title}
              </span>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(goal.id)}
                  disabled={removingId === goal.id}
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                >
                  {removingId === goal.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleNewTitleKeyDown}
            placeholder="Nova meta ou etapa..."
            className="flex-1"
          />
          <Button type="button" onClick={handleCreate} disabled={isCreating || !newTitle.trim()} className="gap-1.5">
            {isCreating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
