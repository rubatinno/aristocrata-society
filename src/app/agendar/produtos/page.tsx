import { redirect } from "next/navigation";
import { getMenteeSession } from "@/app/agendar/mentee-actions";
import { listMenteeProducts, listProductCreatives } from "@/app/agendar/produtos/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { ProdutosWorkspace } from "@/components/mentee-area/produtos-workspace";

export default async function MenteeProductsPage() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const session = await getMenteeSession();
  if (!session) {
    redirect("/login?next=/agendar/produtos");
  }

  const [products, creatives] = await Promise.all([
    listMenteeProducts(session.userId),
    listProductCreatives(session.userId),
  ]);

  return (
    <ProdutosWorkspace
      initialProducts={products}
      initialCreatives={creatives}
      menteeId={session.userId}
      revalidateTarget="/agendar/produtos"
      className="h-[calc(100vh-4rem)]"
    />
  );
}
