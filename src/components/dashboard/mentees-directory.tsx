"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { addMonths, differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addMenteeLink,
  removeMenteeLink,
  updateMenteeOverrides,
  type LinkFormState,
} from "@/app/dashboard/mentorados/actions";
import { listMenteeNotes } from "@/app/agendar/anotacoes/actions";
import { NotesWorkspace } from "@/components/mentee-area/notes-workspace";
import type { ApprovedMentee, MenteeLink, MenteeNote, Plan } from "@/lib/types";
import { formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

const initialState: LinkFormState = { status: "idle" };

export type MenteeWithDetails = ApprovedMentee & {
  plan: Plan | null;
  links: MenteeLink[];
  completedCalls: number;
  daysRemaining: number | null;
  effectiveTotalCalls: number | null;
};

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function MenteesDirectory({
  mentees,
  isAdmin = false,
}: {
  mentees: MenteeWithDetails[];
  isAdmin?: boolean;
}) {
  if (mentees.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Nenhum mentorado aprovado ainda. Peça a um admin para aprovar em Aprovações.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {mentees.map((mentee) => (
        <MenteeCard key={mentee.id} mentee={mentee} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

function MenteeCard({ mentee, isAdmin }: { mentee: MenteeWithDetails; isAdmin: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(addMenteeLink, initialState);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemoving, startRemoving] = useTransition();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<MenteeNote[] | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesMaximized, setNotesMaximized] = useState(true);
  const [editingLimits, setEditingLimits] = useState(false);
  const [totalCallsInput, setTotalCallsInput] = useState(mentee.total_calls_override?.toString() ?? "");
  const [startDateInput, setStartDateInput] = useState(mentee.starts_at);
  const [endDateInput, setEndDateInput] = useState(
    mentee.duration_days_override
      ? addDaysToDateKey(mentee.starts_at, mentee.duration_days_override)
      : "",
  );
  const [isSavingLimits, startSavingLimits] = useTransition();

  // Reage ao resultado da Server Action (fonte externa via useActionState),
  // não a um valor derivável durante a renderização.
  useEffect(() => {
    if (state.status === "success") {
      toast.success("Link adicionado.");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormKey((k) => k + 1); // limpa os campos pra permitir adicionar outro em seguida
    }
  }, [state]);

  function handleRemoveLink(id: string) {
    setRemovingId(id);
    startRemoving(async () => {
      try {
        await removeMenteeLink(id);
        toast.success("Link removido.");
      } catch {
        toast.error("Não foi possível remover.");
      } finally {
        setRemovingId(null);
      }
    });
  }

  function handleStartDateChange(value: string) {
    setStartDateInput(value);
    if (value) {
      const newEnd = addMonths(new Date(`${value}T12:00:00Z`), 4).toISOString().slice(0, 10);
      setEndDateInput(newEnd);
    }
  }

  function handleSaveLimits() {
    const totalCalls = totalCallsInput.trim() === "" ? null : Number.parseInt(totalCallsInput, 10);
    const durationDays =
      endDateInput && startDateInput
        ? differenceInCalendarDays(new Date(`${endDateInput}T12:00:00Z`), new Date(`${startDateInput}T12:00:00Z`))
        : null;

    startSavingLimits(async () => {
      try {
        await updateMenteeOverrides(mentee.id, {
          totalCalls,
          durationDays,
          startsAt: startDateInput || mentee.starts_at,
        });
        toast.success("Limites atualizados.");
        setEditingLimits(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  async function handleOpenNotes() {
    if (!mentee.user_id) return;
    setLoadingNotes(true);
    try {
      const data = await listMenteeNotes(mentee.user_id);
      setNotes(data);
      setNotesOpen(true);
    } catch {
      toast.error("Não foi possível carregar as anotações.");
    } finally {
      setLoadingNotes(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{mentee.full_name || mentee.email}</p>
          <p className="truncate text-xs text-muted-foreground">
            {mentee.email} · desde {formatFullDate(new Date(`${mentee.starts_at}T12:00:00Z`), "UTC")}
          </p>
        </div>
        <Badge variant="outline">{mentee.plan?.name ?? "Sem plano (1/semana)"}</Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOpenNotes}
          disabled={!mentee.user_id || loadingNotes}
          title={!mentee.user_id ? "Mentorado ainda não criou a conta" : undefined}
          className="gap-1.5"
        >
          {loadingNotes ? <Loader2 className="size-3.5 animate-spin" /> : <NotebookPen className="size-3.5" />}
          Anotações
        </Button>
      </div>

      {isAdmin && (
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-success" />
            {mentee.completedCalls}
            {mentee.effectiveTotalCalls ? ` / ${mentee.effectiveTotalCalls}` : ""}{" "}
            {mentee.completedCalls === 1 ? "chamada realizada" : "chamadas realizadas"}
          </span>
          <span className="flex items-center gap-1.5">
            {mentee.daysRemaining === null ? (
              <>
                <CalendarClock className="size-3.5" /> Sem prazo definido
              </>
            ) : mentee.daysRemaining < 0 ? (
              <>
                <CalendarX2 className="size-3.5 text-destructive" /> Plano expirado
              </>
            ) : (
              <>
                <CalendarClock className="size-3.5" /> {mentee.daysRemaining}{" "}
                {mentee.daysRemaining === 1 ? "dia restante" : "dias restantes"}
              </>
            )}
          </span>
          {!editingLimits && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditingLimits(true)}
              className="text-muted-foreground hover:text-foreground"
              title="Editar limites deste mentorado"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
        </div>
      )}

      {isAdmin && editingLimits && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/30 p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Total de chamadas</label>
            <Input
              type="number"
              min={1}
              placeholder={mentee.plan?.total_calls ? String(mentee.plan.total_calls) : "Sem limite"}
              value={totalCallsInput}
              onChange={(e) => setTotalCallsInput(e.target.value)}
              className="w-32"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data de início</label>
            <Input
              type="date"
              value={startDateInput}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data final</label>
            <Input
              type="date"
              placeholder="Sem prazo"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              className="w-40"
            />
          </div>
          <Button type="button" size="sm" onClick={handleSaveLimits} disabled={isSavingLimits} className="gap-1.5">
            {isSavingLimits && <Loader2 className="size-3.5 animate-spin" />}
            Salvar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingLimits(false);
              setTotalCallsInput(mentee.total_calls_override?.toString() ?? "");
              setStartDateInput(mentee.starts_at);
              setEndDateInput(
                mentee.duration_days_override
                  ? addDaysToDateKey(mentee.starts_at, mentee.duration_days_override)
                  : "",
              );
            }}
            disabled={isSavingLimits}
          >
            Cancelar
          </Button>
          <p className="w-full text-[11px] text-muted-foreground">
            A data final começa preenchida com 4 meses após o início — ajuste se quiser. Deixe em
            branco pra usar o prazo padrão do plano ({mentee.plan?.name ?? "sem plano"}).
          </p>
        </div>
      )}

      {mentee.user_id && (
        <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
          <DialogContent
            className={cn(
              "flex flex-col gap-0 p-0",
              notesMaximized
                ? "top-0 left-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none"
                : "h-[70vh] max-w-4xl sm:max-w-4xl",
            )}
            showCloseButton
          >
            <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 shrink-0 border-b border-border p-4 pr-16">
              <DialogTitle>Anotações · {mentee.full_name || mentee.email}</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setNotesMaximized((prev) => !prev)}
                className="text-muted-foreground hover:text-foreground"
                title={notesMaximized ? "Minimizar" : "Maximizar"}
              >
                {notesMaximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
            </DialogHeader>
            {notes && (
              <NotesWorkspace
                initialNotes={notes}
                menteeId={mentee.user_id}
                revalidateTarget="/dashboard/mentorados"
                className="flex-1"
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        {mentee.links.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground">Nenhum link salvo.</p>
        )}

        {mentee.links.map((link) => (
          <div key={link.id} className="flex items-center gap-2 text-sm">
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-primary hover:underline"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              <span className="truncate">{link.title}</span>
            </a>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRemoveLink(link.id)}
              disabled={isRemoving && removingId === link.id}
              className="text-muted-foreground hover:text-destructive"
            >
              {isRemoving && removingId === link.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </div>
        ))}

        {showForm ? (
          <form
            key={formKey}
            action={(formData) => {
              formData.set("mentee_id", mentee.id);
              formAction(formData);
            }}
            className="flex flex-wrap items-center gap-2 pt-1"
          >
            <Input name="title" placeholder="Nome do link" className="min-w-32 flex-1" required />
            <Input name="url" placeholder="https://..." className="min-w-40 flex-1" required />
            <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Salvar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Fechar
            </Button>
            {state.status === "error" && (
              <p className="w-full text-xs text-destructive">{state.message}</p>
            )}
          </form>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(true)}
            className="gap-1.5 text-primary hover:text-primary"
          >
            <Plus className="size-3.5" /> Adicionar link
          </Button>
        )}
      </div>
    </div>
  );
}
