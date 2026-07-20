import { MentorsTeamList } from "@/components/dashboard/mentors-team-list";
import { requireMentor } from "@/lib/session";
import type { Profile } from "@/lib/types";
import { ShieldAlert } from "lucide-react";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mentores com acesso ao painel. Para adicionar alguém novo, use a página de Aprovações.
        </p>
      </div>

      <MentorsTeamList mentors={(mentors as Profile[]) ?? []} currentUserId={profile.id} />
    </div>
  );
}
