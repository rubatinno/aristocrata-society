"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { RichNoteEditor } from "@/components/mentee-area/rich-note-editor";
import { saveMenteeSummary } from "@/app/dashboard/mentorados/summary-actions";
import { ShieldAlert, Loader2 } from "lucide-react";

export function SummaryWorkspace({
  initialContent,
  menteeId,
  revalidateTarget,
}: {
  initialContent: string;
  menteeId: string;
  revalidateTarget: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [, startTransition] = useTransition();
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(next: string) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      setIsSaving(true);
      startTransition(async () => {
        try {
          await saveMenteeSummary(menteeId, next, revalidateTarget);
        } catch {
          toast.error("Não foi possível salvar o resumo.");
        } finally {
          setIsSaving(false);
        }
      });
    }, 700);
  }

  function handleChange(value: string) {
    setContent(value);
    scheduleSave(value);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-6 py-2.5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5 shrink-0" />
          Visível só pra mentores e admin — o mentorado não vê essa aba.
        </p>
        {isSaving && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Salvando
          </span>
        )}
      </div>
      <RichNoteEditor content={content} onChange={handleChange} menteeId={menteeId} />
    </div>
  );
}
