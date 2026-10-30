import { redirect } from "next/navigation";
import { getMenteeIdentity } from "@/lib/mentee-session";
import { listMenteeProducts, listProductCreatives } from "@/app/agendar/produtos/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { ProdutosWorkspace } from "@/components/mentee-area/produtos-workspace";

export default async function MenteeProductsPage() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const identity = await getMenteeIdentity();
  if (!identity) {
    redirect("/login?next=/agendar/produtos");
  }

  const [products, creatives] = await Promise.all([
    listMenteeProducts(identity.userId),
    listProductCreatives(identity.userId),
  ]);

  return (
    <ProdutosWorkspace
      initialProducts={products}
      initialCreatives={creatives}
      menteeId={identity.userId}
      revalidateTarget="/agendar/produtos"
      className="h-[calc(100vh-4rem)]"
    />
  );
}
