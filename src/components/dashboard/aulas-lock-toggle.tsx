"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setAulasLocked } from "@/app/dashboard/aulas/actions";
import { Button } from "@/components/ui/button";
import { Lock, LockOpen } from "lucide-react";

export function AulasLockToggle({ initialLocked }: { initialLocked: boolean }) {
  const [locked, setLocked] = useState(initialLocked);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = !locked;
    setLocked(next);
    startTransition(async () => {
      try {
        await setAulasLocked(next);
        toast.success(next ? "Aulas travadas para os mentorados." : "Aulas liberadas para os mentorados.");
      } catch (e) {
        setLocked(!next);
        toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={locked ? "outline" : "default"}
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className="gap-1.5"
    >
      {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
      {locked ? "Aulas travadas" : "Aulas liberadas"}
    </Button>
  );
}
