import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getMenteeIdentity } from "@/lib/mentee-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { MenteeLinkRow } from "@/components/mentee-area/mentee-link-row";
import { Skeleton } from "@/components/ui/skeleton";
import type { MenteeLink } from "@/lib/types";

export default function MenteeLinksPage() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  // O título e a descrição não dependem do banco, então saem na hora; só a
  // lista espera o Supabase, dentro do próprio Suspense. Antes a página
  // inteira ficava em branco até a última consulta voltar.
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Google Docs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Documentos e materiais que seu mentor guardou pra você por aqui.
        </p>
      </div>

      <Suspense fallback={<LinksSkeleton />}>
        <LinksList />
      </Suspense>
    </div>
  );
}

function LinksSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  );
}


async function LinksList() {
  const identity = await getMenteeIdentity();
  if (!identity) {
    redirect("/login?next=/agendar/links");
  }

  const admin = createAdminClient();

  // Uma ida só: o filtro por e-mail viaja junto com a busca dos links, em vez
  // de descobrir primeiro o id do mentorado numa consulta separada.
  const { data } = await admin
    .from("mentee_links")
    .select("*, approved_mentees!inner(email)")
    .eq("approved_mentees.email", identity.email)
    .order("created_at", { ascending: false });

  // O filtro por e-mail arrasta a linha de approved_mentees junto; a lista só
  // quer o link.
  const links: MenteeLink[] = ((data as (MenteeLink & { approved_mentees?: unknown })[]) ?? []).map(
    (linha) => {
      const { approved_mentees, ...link } = linha;
      void approved_mentees;
      return link;
    },
  );

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
        <FileText className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Nenhum documento por aqui ainda</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Quando um mentor adicionar um documento ou link pra você, ele aparece nesta página.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {links.map((link) => (
        <MenteeLinkRow key={link.id} link={link} />
      ))}
    </div>
  );
}
