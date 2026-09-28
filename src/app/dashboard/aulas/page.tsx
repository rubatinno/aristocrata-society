import { requireMentor } from "@/lib/session";
import { getAulasLockSetting, listAllModulesWithLessons, viewAulasAsMentee } from "@/app/dashboard/aulas/actions";
import { AulasAdminView } from "@/components/dashboard/aulas-admin-view";
import { AulasLockToggle } from "@/components/dashboard/aulas-lock-toggle";
import { Button } from "@/components/ui/button";
import { Eye, ShieldAlert } from "lucide-react";

export default async function AdminAulasPage() {
  const { profile, mentorModeActive } = await requireMentor();

  if (!profile.is_admin || mentorModeActive) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Só administradores podem gerenciar as aulas.</p>
      </div>
    );
  }

  const [modules, lockSetting] = await Promise.all([listAllModulesWithLessons(), getAulasLockSetting()]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aulas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monte os módulos e aulas que todo mentorado vê na área dele, do jeito que você quiser.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AulasLockToggle initialLocked={lockSetting.aulas_locked} />
          <form action={viewAulasAsMentee}>
            <Button type="submit" variant="outline" size="sm" className="gap-1.5">
              <Eye className="size-3.5" /> Ver como aluno
            </Button>
          </form>
        </div>
      </div>

      <AulasAdminView initialModules={modules} />
    </div>
  );
}
