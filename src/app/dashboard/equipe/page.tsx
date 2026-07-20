import Link from "next/link";
import { MentorsTeamList } from "@/components/dashboard/mentors-team-list";
import { buttonVariants } from "@/components/ui/button";
import { requireMentor } from "@/lib/session";
import type { Profile } from "@/lib/types";
import { ShieldAlert, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function EquipePage() {
  const { supabase, profile } = await requireMentor();

  if (!profile.is_admin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Só administradores podem gerenciar a equipe.</p>
      </div>
    );
  }

  const { data: mentors } = await supabase.from("profiles").select("*").order("full_name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mentores com acesso ao painel. Promova/remova admin ou remova alguém da equipe.
          </p>
        </div>
        <Link
          href="/dashboard/aprovacoes"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <UserPlus className="size-3.5" /> Convidar mentor
        </Link>
      </div>

      <MentorsTeamList mentors={(mentors as Profile[]) ?? []} currentUserId={profile.id} />
    </div>
  );
}
