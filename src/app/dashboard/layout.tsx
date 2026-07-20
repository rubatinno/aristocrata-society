import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardMobileNav } from "@/components/dashboard/mobile-nav";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { needsOnboarding, requireMentor } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const { user, profile } = await requireMentor();

  if (needsOnboarding(profile)) {
    redirect("/onboarding");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const bookingUrl = `${appUrl}/agendar`;

  return (
    <div className="flex min-h-screen bg-muted/20">
      <DashboardSidebar isAdmin={profile.is_admin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar fullName={profile.full_name} email={user.email ?? ""} bookingUrl={bookingUrl} />
        <main className="flex-1 px-4 pb-20 pt-6 sm:px-6 lg:pb-10">{children}</main>
      </div>
      <DashboardMobileNav />
    </div>
  );
}
