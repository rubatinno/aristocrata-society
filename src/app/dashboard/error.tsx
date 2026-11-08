"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Rede de segurança do painel: se algo quebrar numa página do dashboard, o
// mentor vê esta tela (com o menu ainda funcionando) em vez da página branca
// "This page couldn't load".
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <h2 className="font-heading text-xl font-semibold">Algo deu errado nesta tela</h2>
      <p className="text-sm text-muted-foreground">
        Nada do que já estava salvo foi perdido. Tente de novo; se continuar, avise o suporte.
      </p>
      <Button onClick={() => unstable_retry()}>Tentar de novo</Button>
    </div>
  );
}
