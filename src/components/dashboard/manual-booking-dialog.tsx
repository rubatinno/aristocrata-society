"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createManualBooking, type MenteeOption } from "@/app/dashboard/agenda/actions";
import { CalendarPlus, Loader2 } from "lucide-react";

function todayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ManualBookingDialog({ menteeOptions }: { menteeOptions: MenteeOption[] }) {
  const [open, setOpen] = useState(false);
  const [menteeId, setMenteeId] = useState<string | null>(null);
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState(nowTime());
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [markCompleted, setMarkCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const menteeItems = Object.fromEntries(menteeOptions.map((m) => [m.id, `${m.fullName} · ${m.email}`]));

  function resetForm() {
    setMenteeId(null);
    setDate(todayKey());
    setTime(nowTime());
    setDuration("60");
    setNotes("");
    setMarkCompleted(false);
    setError(null);
  }

  function handleCreate() {
    if (!menteeId) {
      setError("Selecione um mentorado.");
      return;
    }
    setError(null);
    startSaving(async () => {
      const result = await createManualBooking({
        approvedMenteeId: menteeId,
        dateKey: date,
        time,
        durationMinutes: Number.parseInt(duration, 10) || 60,
        notes,
        markCompleted,
      });
      if (!result.ok) {
        setError(result.message ?? "Não foi possível criar o agendamento.");
        return;
      }
      toast.success("Agendamento criado.");
      setOpen(false);
      resetForm();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <CalendarPlus className="size-3.5" />
        Agendar manualmente
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setError(null);
          setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar manualmente</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mentorado</Label>
              {menteeOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum mentorado aprovado ainda.</p>
              ) : (
                <Select
                  value={menteeId ?? undefined}
                  onValueChange={(v) => setMenteeId(v)}
                  items={menteeItems}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um mentorado" />
                  </SelectTrigger>
                  <SelectContent>
                    {menteeOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.fullName} · {m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="manual_booking_date">Data</Label>
                <Input id="manual_booking_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual_booking_time">Horário</Label>
                <Input id="manual_booking_time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_booking_duration">Duração (minutos)</Label>
              <Input
                id="manual_booking_duration"
                type="text"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_booking_notes">Observação (opcional)</Label>
              <Input
                id="manual_booking_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Combinado pelo WhatsApp"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Switch checked={markCompleted} onCheckedChange={setMarkCompleted} />
              Já aconteceu — marcar como concluída
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreate} disabled={isSaving} className="gap-1.5">
              {isSaving && <Loader2 className="size-3.5 animate-spin" />}
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
