import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrustedUser } from "@/lib/auth-header";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { needsOnboarding } from "@/lib/session";
import type { Profile } from "@/lib/types";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const supabase = await createClient();
  const user = await getTrustedUser(supabase);

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");
  if (!needsOnboarding(profile)) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-lg font-semibold">Vamos configurar sua agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leva menos de um minuto. Você pode ajustar tudo depois.
        </p>
        <div className="mt-6">
          <OnboardingForm defaultSlug={profile.slug} />
        </div>
      </div>
    </div>
  );
}
