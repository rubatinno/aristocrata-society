"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  markBookingCompleted,
  cancelBooking,
  markBookingNoShow,
  rescheduleBooking,
} from "@/app/dashboard/agenda/actions";
import { dateKey } from "@/lib/scheduling";
import { formatTime } from "@/lib/format";
import { Calendar, Check, Loader2, UserX, X } from "lucide-react";

export function BookingActions({
  bookingId,
  startsAt,
  timeZone,
}: {
  bookingId: string;
  startsAt: string;
  timeZone: string;
}) {
  const [isCompleting, startCompleting] = useTransition();
  const [isCancelling, startCancelling] = useTransition();
  const [isMarkingNoShow, startMarkingNoShow] = useTransition();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

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
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setRescheduleOpen(true)}
        disabled={isBusy}
        className="text-muted-foreground hover:text-foreground"
        title="Reagendar"
      >
        <Calendar className="size-3.5" />
      </Button>
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

      <RescheduleDialog
        bookingId={bookingId}
        startsAt={startsAt}
        timeZone={timeZone}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
      />
    </>
  );
}

function RescheduleDialog({
  bookingId,
  startsAt,
  timeZone,
  open,
  onOpenChange,
}: {
  bookingId: string;
  startsAt: string;
  timeZone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currentDate = new Date(startsAt);
  const [date, setDate] = useState(dateKey(currentDate, timeZone));
  const [time, setTime] = useState(formatTime(currentDate, timeZone));
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startSaving(async () => {
      const result = await rescheduleBooking(bookingId, date, time);
      if (!result.ok) {
        setError(result.message ?? "Não foi possível reagendar.");
        return;
      }
      toast.success("Agendamento reagendado.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reagendar chamada</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reschedule_date">Nova data</Label>
            <Input
              id="reschedule_date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reschedule_time">Novo horário</Label>
            <Input
              id="reschedule_time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving && <Loader2 className="size-3.5 animate-spin" />}
            Reagendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
