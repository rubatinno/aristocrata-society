import { Lock } from "lucide-react";

export function AulasLockedNotice({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-lg">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Lock className="size-6 text-primary" />
        </span>
        <h1 className="font-heading text-xl font-semibold">Aulas em produção</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
