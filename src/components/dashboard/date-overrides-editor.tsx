"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AvailabilityDate } from "@/lib/types";
import { saveDateOverrides, type DateOverrideInput } from "@/app/dashboard/disponibilidade/date-actions";
import { Check, Loader2, Pencil, Plus, X, CalendarPlus, Trash2, Filter, Clock, Minus, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

type Block = {
  id: string;
  start: string;
  end: string;
  editing: boolean;
  /** null = aberto pra qualquer mentorado. N = só quem está na Nª chamada. */
  requiredCallNumber: number | null;
};
type DateEntry = { id: string; date: string; blocks: Block[] };

function makeId() {
  return Math.random().toString(36).slice(2);
}

/** Data de hoje no fuso local do navegador — usar toISOString() aqui daria a
 * data em UTC, que já é "amanhã" à noite em fusos negativos (ex: Brasil),
 * bloqueando sem motivo a adição de um horário ainda hoje. */
function todayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Rótulo "Quarta-feira, 21 de out." a partir de um dateKey, sem depender do
 * fuso local do navegador (âncora em meio-dia UTC). */
function formatDateLabel(dateKey: string): string {
  const anchor = new Date(`${dateKey}T12:00:00Z`);
  const label = format(anchor, "EEEE, d 'de' MMM", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
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
      requiredCallNumber: row.required_call_number,
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

  // Exibe sempre em ordem cronológica, não importa a ordem em que o mentor
  // adicionou as datas/horários — sem isso, adicionar uma data anterior
  // depois de uma posterior deixava a lista fora de ordem.
  const sortedEntries = useMemo(
    () =>
      [...entries]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((entry) => ({
          ...entry,
          blocks: [...entry.blocks].sort((a, b) => a.start.localeCompare(b.start)),
        })),
    [entries],
  );

  function addDate() {
    setEntries((prev) => [
      ...prev,
      {
        id: makeId(),
        date: todayKey(),
        blocks: [{ id: makeId(), start: "09:00", end: "10:00", editing: true, requiredCallNumber: null }],
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
          ? {
              ...e,
              blocks: [
                ...e.blocks,
                { id: makeId(), start: "09:00", end: "10:00", editing: true, requiredCallNumber: null },
              ],
            }
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
        required_call_number: block.requiredCallNumber,
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
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
          <CalendarDays className="size-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">Nenhum horário avulso cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedEntries.map((entry) => (
            <div
              key={entry.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-black/5"
            >
              <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-4 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent ring-1 ring-primary/30">
                  <CalendarDays className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{formatDateLabel(entry.date)}</p>
                  <Input
                    type="date"
                    min={todayKey()}
                    value={entry.date}
                    onChange={(e) => updateDate(entry.id, e.target.value)}
                    className="mt-0.5 h-6 w-36 border-0 bg-transparent p-0 text-xs text-muted-foreground focus-visible:ring-0"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeDate(entry.id)}
                  className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                  title="Remover data"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="space-y-2 p-4">
                {entry.blocks.map((block) =>
                  block.editing ? (
                    <div key={block.id} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5">
                          <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                          <Input
                            type="time"
                            value={block.start}
                            onChange={(e) => {
                              const start = e.target.value;
                              updateBlock(entry.id, block.id, { start, end: addOneHour(start) });
                            }}
                            className="h-6 w-auto flex-1 border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0"
                          />
                          <span className="shrink-0 text-xs text-muted-foreground">até</span>
                          <Input
                            type="time"
                            value={block.end}
                            onChange={(e) => updateBlock(entry.id, block.id, { end: e.target.value })}
                            className="h-6 w-auto flex-1 border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setBlockEditing(entry.id, block.id, false)}
                          className="shrink-0 text-success hover:text-success"
                          title="Confirmar"
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeBlock(entry.id, block.id)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Filter className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">Restringir por nº da chamada</span>
                        </div>
                        <Switch
                          checked={block.requiredCallNumber != null}
                          onCheckedChange={(checked) =>
                            updateBlock(entry.id, block.id, { requiredCallNumber: checked ? 2 : null })
                          }
                        />
                      </div>

                      {block.requiredCallNumber != null && (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
                          <span className="text-xs text-muted-foreground">Só quem está na</span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-xs"
                              onClick={() =>
                                updateBlock(entry.id, block.id, {
                                  requiredCallNumber: Math.max(1, (block.requiredCallNumber ?? 1) - 1),
                                })
                              }
                              className="rounded-full"
                              title="Diminuir"
                            >
                              <Minus className="size-3" />
                            </Button>
                            <span className="w-5 text-center text-sm font-semibold tabular-nums text-accent">
                              {block.requiredCallNumber}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-xs"
                              onClick={() =>
                                updateBlock(entry.id, block.id, {
                                  requiredCallNumber: (block.requiredCallNumber ?? 1) + 1,
                                })
                              }
                              className="rounded-full"
                              title="Aumentar"
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>
                          <span className="text-xs text-muted-foreground">ª chamada</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      key={block.id}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-sm font-medium",
                      )}
                    >
                      <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {block.start} até {block.end}
                      </span>
                      {block.requiredCallNumber != null && (
                        <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                          <Filter className="size-3" /> Só {block.requiredCallNumber}ª chamada
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1">
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
                    </div>
                  ),
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addBlock(entry.id)}
                  className="w-fit gap-1.5 text-primary hover:text-primary"
                >
                  <Plus className="size-3.5" /> Adicionar horário
                </Button>
              </div>
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
