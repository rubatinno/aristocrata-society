import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getMenteeSession } from "@/app/agendar/mentee-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { MenteeLinkRow } from "@/components/mentee-area/mentee-link-row";
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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Google Docs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Documentos e materiais que seu mentor guardou pra você por aqui.
        </p>
      </div>

      {links.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nenhum documento por aqui ainda</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Quando um mentor adicionar um documento ou link pra você, ele aparece nesta página.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <MenteeLinkRow key={link.id} link={link} />
          ))}
        </div>
      )}
    </div>
  );
}
