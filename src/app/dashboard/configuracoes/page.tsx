import { SettingsForm } from "@/components/dashboard/settings-form";
import { GoogleCalendarCard } from "@/components/dashboard/google-calendar-card";
import { requireMentor } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ConfiguracoesPage() {
  const { profile } = await requireMentor();

  let connectedEmail: string | null = null;
  if (profile.google_calendar_connected) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("mentor_google_tokens")
      .select("connected_email")
      .eq("mentor_id", profile.id)
      .maybeSingle();
    connectedEmail = data?.connected_email ?? null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste seu perfil público e as regras da sua sessão de mentoria.
        </p>
      </div>

      <GoogleCalendarCard connected={profile.google_calendar_connected} connectedEmail={connectedEmail} />

      <SettingsForm profile={profile} />
    </div>
  );
}
