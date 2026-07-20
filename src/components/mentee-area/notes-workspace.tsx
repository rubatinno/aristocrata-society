"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createNote, deleteNote, updateNote } from "@/app/agendar/anotacoes/actions";
import { RichNoteEditor } from "@/components/mentee-area/rich-note-editor";
import { createClient } from "@/lib/supabase/client";
import type { MenteeNote } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2, NotebookPen, Plus, Trash2 } from "lucide-react";

function formatUpdated(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function NotesWorkspace({
  initialNotes,
  menteeId,
  revalidateTarget,
  className,
}: {
  initialNotes: MenteeNote[];
  menteeId: string;
  revalidateTarget: string;
  className?: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id ?? null);
  const [title, setTitle] = useState(initialNotes[0]?.title ?? "");
  const [content, setContent] = useState(initialNotes[0]?.content ?? "");
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIdRef = useRef(selectedId);
  const savingRef = useRef(false);

  // Resincroniza a lista com o servidor após criar/remover (fonte externa).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(initialNotes);
  }, [initialNotes]);

  // Troca de nota selecionada: recarrega os campos do editor a partir dela.
  useEffect(() => {
    selectedIdRef.current = selectedId;
    const found = notes.find((n) => n.id === selectedId) ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(found?.title ?? "");
    setContent(found?.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Anotações são compartilhadas entre mentorado e mentores — escuta
  // mudanças em tempo real pra refletir o que a outra pessoa acabou de
  // escrever, sem precisar reabrir a tela.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`mentee-notes-${menteeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentee_notes", filter: `mentee_id=eq.${menteeId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setNotes((prev) => prev.filter((n) => n.id !== deletedId));
            if (selectedIdRef.current === deletedId) setSelectedId(null);
            return;
          }

          const incoming = payload.new as MenteeNote;
          setNotes((prev) => {
            const exists = prev.some((n) => n.id === incoming.id);
            const next = exists
              ? prev.map((n) => (n.id === incoming.id ? incoming : n))
              : [incoming, ...prev];
            return next.sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
            );
          });

          // Se é a nota aberta agora e a mudança não veio do nosso próprio
          // salvamento em andamento, atualiza o editor com o conteúdo novo.
          if (incoming.id === selectedIdRef.current && !savingRef.current) {
            setTitle(incoming.title);
            setContent(incoming.content);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [menteeId]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  function scheduleSave(nextTitle: string, nextContent: string) {
    if (!selectedId) return;
    const id = selectedId;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      setIsSaving(true);
      savingRef.current = true;
      startTransition(async () => {
        try {
          await updateNote(id, nextTitle, nextContent, revalidateTarget);
          setNotes((prev) =>
            prev.map((n) =>
              n.id === id ? { ...n, title: nextTitle.trim() || "Sem título", content: nextContent } : n,
            ),
          );
        } catch {
          toast.error("Não foi possível salvar a anotação.");
        } finally {
          setIsSaving(false);
          savingRef.current = false;
        }
      });
    }, 700);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave(value, content);
  }

  function handleContentChange(value: string) {
    setContent(value);
    scheduleSave(title, value);
  }

  function handleNewNote() {
    startTransition(async () => {
      try {
        const note = await createNote(menteeId, revalidateTarget);
        // Adiciona direto no estado local — não dá pra depender só de
        // router.refresh() aqui: no diálogo do mentor as notas não vêm de
        // props do servidor, foram buscadas manualmente ao abrir.
        setNotes((prev) => [note, ...prev]);
        setSelectedId(note.id);
        router.refresh();
      } catch {
        toast.error("Não foi possível criar a anotação.");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteNote(id, revalidateTarget);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        if (selectedId === id) setSelectedId(null);
        router.refresh();
      } catch {
        toast.error("Não foi possível remover a anotação.");
      }
    });
  }

  return (
    <div className={cn("flex min-h-0 flex-col lg:flex-row", className)}>
      <div className="flex w-full shrink-0 flex-col border-b border-border lg:h-full lg:w-64 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-4">
          <h2 className="text-sm font-semibold">Anotações</h2>
          <Button size="sm" onClick={handleNewNote} disabled={isPending} className="gap-1.5">
            <Plus className="size-3.5" /> Nova
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {notes.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Nenhuma anotação ainda. Crie a primeira.
            </p>
          )}
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => setSelectedId(note.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors",
                selectedId === note.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <span className="truncate text-sm font-medium">{note.title || "Sem título"}</span>
              <span className="truncate text-xs text-muted-foreground">{formatUpdated(note.updated_at)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
              <input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Título"
                className="w-full bg-transparent font-heading text-lg font-semibold outline-none placeholder:text-muted-foreground"
              />
              <div className="flex shrink-0 items-center gap-3">
                {isSaving && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Salvando
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(selected.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <RichNoteEditor content={content} onChange={handleContentChange} menteeId={menteeId} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <NotebookPen className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma anotação selecionada</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Crie uma nova anotação ou escolha uma na lista ao lado.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
