import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardMobileNav } from "@/components/dashboard/mobile-nav";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { needsOnboarding, requireMentor } from "@/lib/session";
import { exitMentorMode } from "@/app/dashboard/mentor-mode-actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const { user, profile, mentorModeActive } = await requireMentor();

  if (needsOnboarding(profile)) {
    redirect("/onboarding");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const bookingUrl = `${appUrl}/agendar`;

  return (
    <div className="flex min-h-screen bg-muted/20">
      <DashboardSidebar isAdmin={profile.is_admin} mentorModeActive={mentorModeActive} />
      <div className="flex min-w-0 flex-1 flex-col">
        {mentorModeActive && (
          <div className="flex items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
            Modo Mentor — só o seu painel de mentor, sem as ferramentas de admin
            <form action={exitMentorMode}>
              <button type="submit" className="underline underline-offset-2 hover:no-underline">
                Voltar ao modo Admin
              </button>
            </form>
          </div>
        )}
        <DashboardTopbar
          fullName={profile.full_name}
          email={user.email ?? ""}
          bookingUrl={bookingUrl}
          isAdmin={profile.is_admin}
          mentorModeActive={mentorModeActive}
        />
        <main className="flex-1 px-4 pb-20 pt-6 sm:px-6 lg:pb-10">{children}</main>
      </div>
      <DashboardMobileNav />
    </div>
  );
}
