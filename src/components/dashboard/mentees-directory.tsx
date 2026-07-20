"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addMenteeLink,
  removeMenteeLink,
  type LinkFormState,
} from "@/app/dashboard/mentorados/actions";
import { listMenteeNotes } from "@/app/agendar/anotacoes/actions";
import { NotesWorkspace } from "@/components/mentee-area/notes-workspace";
import type { ApprovedMentee, MenteeLink, MenteeNote, Plan } from "@/lib/types";
import { formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, Maximize2, Minimize2, NotebookPen, Plus, Trash2 } from "lucide-react";

const initialState: LinkFormState = { status: "idle" };

export type MenteeWithDetails = ApprovedMentee & { plan: Plan | null; links: MenteeLink[] };

export function MenteesDirectory({ mentees }: { mentees: MenteeWithDetails[] }) {
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
        <MenteeCard key={mentee.id} mentee={mentee} />
      ))}
    </div>
  );
}

function MenteeCard({ mentee }: { mentee: MenteeWithDetails }) {
  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(addMenteeLink, initialState);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemoving, startRemoving] = useTransition();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<MenteeNote[] | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesMaximized, setNotesMaximized] = useState(true);

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
