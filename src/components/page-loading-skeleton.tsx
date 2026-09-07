import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback genérico mostrado na hora durante a troca de página (loading.tsx
 * do App Router) — sem isso, a tela ficava "congelada" no conteúdo antigo
 * até o servidor terminar de buscar os dados da página nova, parecendo
 * travamento. Não precisa se parecer exatamente com cada página; só precisa
 * aparecer instantaneamente pra dar feedback de que algo está acontecendo.
 */
export function PageLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  );
}
