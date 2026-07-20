import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<BookingStatus, string> = {
  confirmada: "bg-primary/10 text-primary border-primary/20",
  concluida: "bg-success/15 text-success border-success/30",
  cancelada: "bg-muted text-muted-foreground border-border line-through",
  no_show: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
};

const LABELS: Record<BookingStatus, string> = {
  confirmada: "Confirmada",
  concluida: "Concluída",
  cancelada: "Cancelada",
  no_show: "Não compareceu",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", STYLES[status])}>
      {LABELS[status]}
    </Badge>
  );
}
