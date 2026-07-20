"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AvailabilityDate } from "@/lib/types";
import { saveDateOverrides, type DateOverrideInput } from "@/app/dashboard/disponibilidade/date-actions";
import { Check, Loader2, Pencil, Plus, X, CalendarPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Block = { id: string; start: string; end: string; editing: boolean };
type DateEntry = { id: string; date: string; blocks: Block[] };

function makeId() {
  return Math.random().toString(36).slice(2);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Horário de término sugerido: 1h depois do início, sem passar de 23:59. */
function addOneHour(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const total = Math.min(hours * 60 + minutes + 60, 23 * 60 + 59);
  const endHours = Math.floor(total / 60);
  const endMinutes = total % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

function buildInitialState(dates: AvailabilityDate[]): DateEntry[] {
  const byDate = new Map<string, Block[]>();
  for (const row of dates) {
    if (!row.is_active) continue;
    const blocks = byDate.get(row.date) ?? [];
    blocks.push({
      id: makeId(),
      start: row.start_time.slice(0, 5),
      end: row.end_time.slice(0, 5),
      editing: false,
    });
    byDate.set(row.date, blocks);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, blocks]) => ({ id: makeId(), date, blocks }));
}

export function DateOverridesEditor({ initialDates }: { initialDates: AvailabilityDate[] }) {
  const [entries, setEntries] = useState<DateEntry[]>(() => buildInitialState(initialDates));
  const [isPending, startTransition] = useTransition();

  function addDate() {
    setEntries((prev) => [
      ...prev,
      {
        id: makeId(),
        date: todayKey(),
        blocks: [{ id: makeId(), start: "09:00", end: "10:00", editing: true }],
      },
    ]);
  }

  function removeDate(entryId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  function updateDate(entryId: string, date: string) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, date } : e)));
  }

  function addBlock(entryId: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, blocks: [...e.blocks, { id: makeId(), start: "09:00", end: "10:00", editing: true }] }
          : e,
      ),
    );
  }

  function removeBlock(entryId: string, blockId: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, blocks: e.blocks.filter((b) => b.id !== blockId) } : e)),
    );
  }

  function updateBlock(entryId: string, blockId: string, patch: Partial<Block>) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, blocks: e.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }
          : e,
      ),
    );
  }

  function setBlockEditing(entryId: string, blockId: string, editing: boolean) {
    updateBlock(entryId, blockId, { editing });
  }

  function handleSave() {
    const overrides: DateOverrideInput[] = entries.flatMap((entry) =>
      entry.blocks.map((block) => ({
        date: entry.date,
        start_time: block.start,
        end_time: block.end,
      })),
    );

    startTransition(async () => {
      try {
        await saveDateOverrides(overrides);
        toast.success("Datas específicas atualizadas.");
        setEntries((prev) =>
          prev.map((e) => ({ ...e, blocks: e.blocks.map((b) => ({ ...b, editing: false })) })),
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Nenhum horário avulso cadastrado.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  min={todayKey()}
                  value={entry.date}
                  onChange={(e) => updateDate(entry.id, e.target.value)}
                  className="w-44"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeDate(entry.id)}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {entry.blocks.map((block) =>
                  block.editing ? (
                    <div
                      key={block.id}
                      className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2"
                    >
                      <Input
                        type="time"
                        value={block.start}
                        onChange={(e) => {
                          const start = e.target.value;
                          updateBlock(entry.id, block.id, { start, end: addOneHour(start) });
                        }}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={block.end}
                        onChange={(e) => updateBlock(entry.id, block.id, { end: e.target.value })}
                        className="w-32"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setBlockEditing(entry.id, block.id, false)}
                        className="text-success hover:text-success"
                        title="Confirmar"
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeBlock(entry.id, block.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      key={block.id}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-medium",
                      )}
                    >
                      <span>
                        {block.start} até {block.end}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setBlockEditing(entry.id, block.id, true)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Editar"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeBlock(entry.id, block.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ),
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addBlock(entry.id)}
                className="mt-2 w-fit gap-1.5 text-primary hover:text-primary"
              >
                <Plus className="size-3.5" /> Adicionar horário
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addDate} className="gap-1.5">
          <CalendarPlus className="size-3.5" /> Adicionar data
        </Button>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Salvar datas específicas
        </Button>
      </div>
    </div>
  );
}
