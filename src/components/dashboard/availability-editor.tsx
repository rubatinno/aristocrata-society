"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { WEEKDAY_LABELS, type AvailabilityRule, type Weekday } from "@/lib/types";
import { saveAvailability, type AvailabilityRuleInput } from "@/app/dashboard/disponibilidade/actions";
import { Loader2, Plus, X } from "lucide-react";

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

type Block = { id: string; start: string; end: string };

function makeId() {
  return Math.random().toString(36).slice(2);
}

function buildInitialState(rules: AvailabilityRule[]): Record<Weekday, Block[]> {
  const state = {} as Record<Weekday, Block[]>;
  for (const day of WEEKDAYS) {
    state[day] = rules
      .filter((r) => r.weekday === day && r.is_active)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((r) => ({ id: makeId(), start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) }));
  }
  return state;
}

export function AvailabilityEditor({
  initialRules,
  initialEnabled,
}: {
  initialRules: AvailabilityRule[];
  initialEnabled: boolean;
}) {
  const [days, setDays] = useState<Record<Weekday, Block[]>>(() => buildInitialState(initialRules));
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function addBlock(day: Weekday) {
    setDays((prev) => {
      const last = prev[day][prev[day].length - 1];
      const start = last ? last.end : "09:00";
      return {
        ...prev,
        [day]: [...prev[day], { id: makeId(), start, end: "18:00" }],
      };
    });
  }

  function removeBlock(day: Weekday, id: string) {
    setDays((prev) => ({ ...prev, [day]: prev[day].filter((b) => b.id !== id) }));
  }

  function updateBlock(day: Weekday, id: string, patch: Partial<Block>) {
    setDays((prev) => ({
      ...prev,
      [day]: prev[day].map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }

  function handleSave() {
    const rules: AvailabilityRuleInput[] = WEEKDAYS.flatMap((day) =>
      days[day].map((block) => ({
        weekday: day,
        start_time: block.start,
        end_time: block.end,
        is_active: true,
      })),
    );

    startTransition(async () => {
      try {
        await saveAvailability(rules, enabled);
        toast.success("Disponibilidade atualizada.");
      } catch {
        toast.error("Não foi possível salvar. Tente novamente.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4">
        <div>
          <p className="text-sm font-medium">Horário Recorrente</p>
          <p className="text-xs text-muted-foreground">
            Desativado, seus mentorados só veem as datas específicas cadastradas abaixo.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div
        className={
          enabled
            ? "divide-y divide-border rounded-2xl border border-border bg-card"
            : "divide-y divide-border rounded-2xl border border-border bg-card opacity-50"
        }
      >
        {WEEKDAYS.map((day) => {
          const blocks = days[day];
          return (
            <div key={day} className="flex flex-wrap items-start gap-4 px-5 py-4">
              <div className="w-28 shrink-0 pt-1.5 text-sm font-medium">{WEEKDAY_LABELS[day]}</div>

              <div className="flex flex-1 flex-col gap-2">
                {blocks.length === 0 && (
                  <p className="pt-1.5 text-sm text-muted-foreground">Indisponível</p>
                )}

                {blocks.map((block) => (
                  <div key={block.id} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={block.start}
                      onChange={(e) => updateBlock(day, block.id, { start: e.target.value })}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={block.end}
                      onChange={(e) => updateBlock(day, block.id, { end: e.target.value })}
                      className="w-32"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeBlock(day, block.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addBlock(day)}
                  className="w-fit gap-1.5 text-primary hover:text-primary"
                >
                  <Plus className="size-3.5" /> Adicionar horário
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Salvar disponibilidade
        </Button>
      </div>
    </div>
  );
}
