import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getMenteeSession, stopViewAsMentee } from "@/app/agendar/mentee-actions";
import { MenteeSidebar } from "@/components/mentee-area/sidebar";
import { MenteeMobileNav } from "@/components/mentee-area/mobile-nav";
import { MenteeTopbar } from "@/components/mentee-area/topbar";

export default async function AgendarLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  const session = await getMenteeSession();

  // Visitante anônimo (ainda não logou pra agendar): mantém a página pública
  // exatamente como está, sem o painel lateral.
  if (!session) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <MenteeSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {session.impersonating && (
          <div className="flex items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
            Visualizando como {session.profile?.full_name || session.email} — modo administrador
            <form action={stopViewAsMentee}>
              <button type="submit" className="underline underline-offset-2 hover:no-underline">
                Voltar ao meu painel
              </button>
            </form>
          </div>
        )}
        <MenteeTopbar
          fullName={session.profile?.full_name ?? ""}
          email={session.email}
          impersonating={session.impersonating}
        />
        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
      <MenteeMobileNav />
    </div>
  );
}
