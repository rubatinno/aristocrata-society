"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adminChangeMentor,
  adminRescheduleBooking,
  adminUpdateBookingStatus,
} from "@/app/dashboard/financeiro/actions";
import { dateKey } from "@/lib/scheduling";
import { formatTime } from "@/lib/format";
import type { Booking, BookingStatus, Profile } from "@/lib/types";
import { Loader2, Settings2 } from "lucide-react";

const STATUS_ITEMS: Record<BookingStatus, string> = {
  confirmada: "Confirmada",
  concluida: "Concluída",
  cancelada: "Cancelada",
  no_show: "Não compareceu",
};

export function AdminBookingControls({
  booking,
  mentors,
  timeZone,
}: {
  booking: Booking;
  mentors: Profile[];
  timeZone: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground"
        title="Gerenciar agendamento"
      >
        <Settings2 className="size-3.5" />
      </Button>

      <AdminBookingDialog booking={booking} mentors={mentors} timeZone={timeZone} open={open} onOpenChange={setOpen} />
    </>
  );
}

function AdminBookingDialog({
  booking,
  mentors,
  timeZone,
  open,
  onOpenChange,
}: {
  booking: Booking;
  mentors: Profile[];
  timeZone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currentDate = new Date(booking.starts_at);
  const [status, setStatus] = useState<BookingStatus>(booking.status);
  const [mentorId, setMentorId] = useState(booking.mentor_id);
  const [date, setDate] = useState(dateKey(currentDate, timeZone));
  const [time, setTime] = useState(formatTime(currentDate, timeZone));
  const [error, setError] = useState<string | null>(null);

  const [isSavingStatus, startSavingStatus] = useTransition();
  const [isRescheduling, startRescheduling] = useTransition();
  const [isChangingMentor, startChangingMentor] = useTransition();

  const mentorItems: Record<string, string> = Object.fromEntries(
    mentors.map((m) => [m.id, m.full_name || m.slug]),
  );

  function handleStatusChange(value: string | null) {
    if (!value || value === status) return;
    const next = value as BookingStatus;
    setStatus(next);
    startSavingStatus(async () => {
      try {
        await adminUpdateBookingStatus(booking.id, next);
        toast.success("Status atualizado.");
      } catch {
        toast.error("Não foi possível atualizar o status.");
        setStatus(booking.status);
      }
    });
  }

  function handleReschedule() {
    setError(null);
    startRescheduling(async () => {
      const result = await adminRescheduleBooking(booking.id, date, time);
      if (!result.ok) {
        setError(result.message ?? "Não foi possível reagendar.");
        return;
      }
      toast.success("Agendamento reagendado.");
    });
  }

  function handleMentorChange(value: string | null) {
    if (!value || value === mentorId) return;
    setError(null);
    startChangingMentor(async () => {
      const result = await adminChangeMentor(booking.id, value);
      if (!result.ok) {
        toast.error(result.message ?? "Não foi possível trocar o mentor.");
        return;
      }
      setMentorId(value);
      toast.success("Mentor alterado.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Gerenciar agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {booking.mentee_name} · {booking.mentee_email}
          </p>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={handleStatusChange} items={STATUS_ITEMS} disabled={isSavingStatus}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mentor</Label>
            <Select
              value={mentorId}
              onValueChange={handleMentorChange}
              items={mentorItems}
              disabled={isChangingMentor}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(mentorItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reagendar</Label>
            <div className="flex items-center gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={handleReschedule} disabled={isRescheduling} className="gap-1.5">
            {isRescheduling && <Loader2 className="size-3.5 animate-spin" />}
            Reagendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
