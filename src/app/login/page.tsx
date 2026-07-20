import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { LogoMark } from "@/components/logo";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const { next } = await searchParams;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-muted/30 px-6 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--color-primary)_12%,transparent),transparent_60%)]" />

      <Link href="/" className="mb-8">
        <LogoMark className="h-9" />
      </Link>

      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-lg shadow-black/5 sm:p-8">
        <LoginForm next={next ?? "/dashboard"} />
      </div>
    </div>
  );
}
