"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { setMentorAdmin, removeMentor } from "@/app/dashboard/equipe/actions";
import type { Profile } from "@/lib/types";
import { Loader2, Trash2 } from "lucide-react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function MentorsTeamList({ mentors, currentUserId }: { mentors: Profile[]; currentUserId: string }) {
  return (
    <div className="space-y-2">
      {mentors.map((mentor) => (
        <MentorRow key={mentor.id} mentor={mentor} isSelf={mentor.id === currentUserId} />
      ))}
    </div>
  );
}

function MentorRow({ mentor, isSelf }: { mentor: Profile; isSelf: boolean }) {
  const [isTogglingAdmin, startTogglingAdmin] = useTransition();
  const [isRemoving, startRemoving] = useTransition();

  function handleToggle(checked: boolean) {
    startTogglingAdmin(async () => {
      try {
        await setMentorAdmin(mentor.id, checked);
        toast.success(checked ? "Agora é admin." : "Admin removido.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
      }
    });
  }

  function handleRemove() {
    if (
      !window.confirm(
        `Remover ${mentor.full_name || "esse mentor"} da equipe? Isso também apaga o histórico de mentorias dele(a). Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    startRemoving(async () => {
      try {
        await removeMentor(mentor.id);
        toast.success("Mentor removido da equipe.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <Avatar className="size-9 border border-border">
        {mentor.avatar_url && <AvatarImage src={mentor.avatar_url} alt={mentor.full_name} />}
        <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
          {initials(mentor.full_name || "?")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {mentor.full_name || "Sem nome"} {isSelf && <span className="text-muted-foreground">(você)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">/agendar · {mentor.slug}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Admin</span>
        <Switch checked={mentor.is_admin} onCheckedChange={handleToggle} disabled={isTogglingAdmin || isRemoving} />
      </div>
      {!isSelf && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleRemove}
          disabled={isTogglingAdmin || isRemoving}
          className="text-muted-foreground hover:text-destructive"
          title="Remover da equipe"
        >
          {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      )}
    </div>
  );
}
