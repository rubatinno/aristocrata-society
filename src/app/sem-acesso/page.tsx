import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default async function SemAcessoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) redirect("/dashboard");

  async function handleSignOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 px-6 py-12 text-center">
      <LogoMark className="h-9" />
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-3xl border border-border bg-card p-8 shadow-sm">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Sem acesso ao painel</h1>
        <p className="text-sm text-muted-foreground">
          Sua conta ({user.email}) ainda não tem acesso de mentor. Peça a um administrador da
          Aristocrata Society pra te convidar.
        </p>
        <form action={handleSignOut} className="pt-2">
          <Button type="submit" variant="outline">
            Sair
          </Button>
        </form>
      </div>
    </div>
  );
}
