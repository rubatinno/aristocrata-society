"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

/**
 * "Exportar PDF" aqui é o próprio diálogo de impressão do navegador — a
 * pessoa escolhe "Salvar como PDF" como destino. Evita carregar uma
 * biblioteca de geração de PDF só pra isso; a folha de estilos de impressão
 * (print:hidden nos controles, cores fixas no relatório) já deixa o
 * resultado limpo.
 */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="gap-1.5">
      <Printer className="size-3.5" />
      Exportar PDF
    </Button>
  );
}
