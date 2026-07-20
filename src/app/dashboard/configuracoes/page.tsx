import { SettingsForm } from "@/components/dashboard/settings-form";
import { requireMentor } from "@/lib/session";

export default async function ConfiguracoesPage() {
  const { profile } = await requireMentor();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste seu perfil público e as regras da sua sessão de mentoria.
        </p>
      </div>

      <SettingsForm profile={profile} />
    </div>
  );
}
