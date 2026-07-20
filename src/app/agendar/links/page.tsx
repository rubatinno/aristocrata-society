import { redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink, LinkIcon } from "lucide-react";
import { getMenteeSession } from "@/app/agendar/mentee-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import type { MenteeLink } from "@/lib/types";

export default async function MenteeLinksPage() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const session = await getMenteeSession();
  if (!session) {
    redirect("/login?next=/agendar/links");
  }

  const admin = createAdminClient();

  const { data: approved } = await admin
    .from("approved_mentees")
    .select("id")
    .eq("email", session.email)
    .maybeSingle();

  let links: MenteeLink[] = [];
  if (approved) {
    const { data } = await admin
      .from("mentee_links")
      .select("*")
      .eq("mentee_id", approved.id)
      .order("created_at", { ascending: false });
    links = (data as MenteeLink[]) ?? [];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Links importantes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Documentos, materiais e links que seu mentor guardou pra você por aqui.
        </p>
      </div>

      {links.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
          <LinkIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nenhum link por aqui ainda</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Quando um mentor adicionar um link ou documento pra você, ele aparece nesta página.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <Link
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LinkIcon className="size-4" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{link.title}</span>
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
