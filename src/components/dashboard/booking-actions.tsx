"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markBookingCompleted, cancelBooking, markBookingNoShow } from "@/app/dashboard/agenda/actions";
import { Check, Loader2, UserX, X } from "lucide-react";

export function BookingActions({ bookingId }: { bookingId: string }) {
  const [isCompleting, startCompleting] = useTransition();
  const [isCancelling, startCancelling] = useTransition();
  const [isMarkingNoShow, startMarkingNoShow] = useTransition();

  const isBusy = isCompleting || isCancelling || isMarkingNoShow;

  function handleComplete() {
    startCompleting(async () => {
      try {
        await markBookingCompleted(bookingId);
        toast.success("Call marcada como concluída.");
      } catch {
        toast.error("Não foi possível atualizar. Tente novamente.");
      }
    });
  }

  function handleCancel() {
    startCancelling(async () => {
      try {
        await cancelBooking(bookingId);
        toast.success("Agendamento cancelado.");
      } catch {
        toast.error("Não foi possível cancelar. Tente novamente.");
      }
    });
  }

  function handleNoShow() {
    startMarkingNoShow(async () => {
      try {
        await markBookingNoShow(bookingId);
        toast.success("Marcado como não compareceu.");
      } catch {
        toast.error("Não foi possível atualizar. Tente novamente.");
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleComplete} disabled={isBusy} className="gap-1.5">
        {isCompleting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Concluída
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleNoShow}
        disabled={isBusy}
        className="gap-1.5 text-amber-600 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-400"
      >
        {isMarkingNoShow ? <Loader2 className="size-3.5 animate-spin" /> : <UserX className="size-3.5" />}
        Não compareceu
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleCancel}
        disabled={isBusy}
        className="text-muted-foreground hover:text-destructive"
        title="Cancelar"
      >
        {isCancelling ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
      </Button>
    </>
  );
}
