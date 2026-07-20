"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { setMentorAdmin } from "@/app/dashboard/equipe/actions";
import type { Profile } from "@/lib/types";

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
  const [isPending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      try {
        await setMentorAdmin(mentor.id, checked);
        toast.success(checked ? "Agora é admin." : "Admin removido.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
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
        <Switch checked={mentor.is_admin} onCheckedChange={handleToggle} disabled={isPending} />
      </div>
    </div>
  );
}
