import { TriangleAlert } from "lucide-react";

export function SupabaseSetupNotice() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <TriangleAlert className="size-6" />
      </div>
      <h1 className="text-xl font-semibold">Configure o Supabase</h1>
      <p className="text-sm text-muted-foreground">
        Para usar login, painel e agendamentos reais, crie um projeto em{" "}
        <span className="font-medium text-foreground">supabase.com</span>, rode a migration em{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">supabase/migrations/0001_init.sql</code> e
        preencha as variáveis de <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env.local</code> (veja{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env.example</code>).
      </p>
    </div>
  );
}
