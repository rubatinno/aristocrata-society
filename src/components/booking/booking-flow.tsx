"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  addMonthsToKey,
  buildDaySlots,
  buildMonthGrid,
  dateKey,
  listCandidateDateKeys,
  startOfMonthKey,
  weekdayFromDateKey,
  type BusyRange,
  type Slot,
} from "@/lib/scheduling";
import { formatDateKeyDayNumber, formatDateKeyFull, formatDateKeyMonthYear, formatTime } from "@/lib/format";
import { BookingDialog, readPendingBooking } from "@/components/booking/booking-dialog";
import type { AvailabilityDate, AvailabilityRule, Profile } from "@/lib/types";
import { CalendarX2, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function BookingFlow({
  profile,
  rules,
  dateRules = [],
  busyRanges,
  windowDays,
  hasUpcomingBooking = false,
  weeklyLimitReached = false,
}: {
  profile: Profile;
  rules: AvailabilityRule[];
  dateRules?: AvailabilityDate[];
  busyRanges: BusyRange[];
  windowDays: number;
  hasUpcomingBooking?: boolean;
  weeklyLimitReached?: boolean;
}) {
  const dateKeys = useMemo(
    () => listCandidateDateKeys(windowDays, profile.timezone),
    [windowDays, profile.timezone],
  );

  const [localBusy, setLocalBusy] = useState<BusyRange[]>(busyRanges);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const key of dateKeys) {
      const daySlots = buildDaySlots({
        dateKey: key,
        weekday: weekdayFromDateKey(key),
        rules,
        dateRules,
        timeZone: profile.timezone,
        sessionDurationMinutes: profile.session_duration_minutes,
        bufferMinutes: profile.buffer_minutes,
        busyRanges: localBusy,
        minNoticeMinutes: profile.min_notice_hours * 60,
      });
      // Já usou a call da semana: nenhum horário pode ser escolhido, mesmo
      // que o slot em si não coincida com nenhum agendamento existente.
      map.set(key, weeklyLimitReached ? daySlots.map((slot) => ({ ...slot, busy: true })) : daySlots);
    }
    return map;
  }, [
    dateKeys,
    rules,
    dateRules,
    profile.timezone,
    profile.session_duration_minutes,
    profile.buffer_minutes,
    profile.min_notice_hours,
    localBusy,
    weeklyLimitReached,
  ]);

  const firstAvailable =
    dateKeys.find((key) => (slotsByDay.get(key) ?? []).some((s) => !s.busy)) ??
    dateKeys.find((key) => (slotsByDay.get(key)?.length ?? 0) > 0);
  const [selectedDate, setSelectedDate] = useState(firstAvailable ?? dateKeys[0]);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonthKey(firstAvailable ?? dateKeys[0]));
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<Slot | null>(null);

  const daySlots = slotsByDay.get(selectedDate) ?? [];
  const hasAnySlot = dateKeys.some((key) => (slotsByDay.get(key)?.length ?? 0) > 0);

  const minMonthKey = startOfMonthKey(dateKeys[0]);
  const maxMonthKey = startOfMonthKey(dateKeys[dateKeys.length - 1]);
  const monthGrid = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);

  // Se acabamos de voltar de um link mágico enviado a partir dessa mesma
  // mentoria, reabre o diálogo direto no horário que a pessoa tinha escolhido.
  // Só roda uma vez ao montar, lendo o sessionStorage (fonte externa).
  useEffect(() => {
    const pending = readPendingBooking();
    if (!pending || pending.mentorId !== profile.id) return;

    for (const slots of slotsByDay.values()) {
      const found = slots.find((s) => s.startsAt.toISOString() === pending.startsAt);
      if (found) {
        const key = dateKey(found.startsAt, profile.timezone);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedDate(key);
        setVisibleMonth(startOfMonthKey(key));
        setSelectedSlot(found);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBooked(slot: Slot) {
    setLocalBusy((prev) => [...prev, { starts_at: slot.startsAt.toISOString(), ends_at: slot.endsAt.toISOString() }]);
    setConfirmedSlot(slot);
    setSelectedSlot(null);
  }

  if (confirmedSlot) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-success/10 py-10 text-center">
        <CheckCircle2 className="size-10 text-success" />
        <p className="text-base font-semibold">Mentoria agendada!</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {formatDateKeyFull(selectedDate)} às {formatTime(confirmedSlot.startsAt, profile.timezone)} (
          {profile.timezone})
        </p>
      </div>
    );
  }

  if (!hasAnySlot) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-10 text-center">
        <CalendarX2 className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Nenhum horário disponível no momento</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {hasUpcomingBooking
            ? `Você já selecionou um horário essa semana. Você poderá marcar a próxima a partir de domingo, ou entre em contato diretamente com ${profile.full_name.split(" ")[0]}.`
            : `Volte em breve ou entre em contato diretamente com ${profile.full_name.split(" ")[0]}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {weeklyLimitReached && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent bg-accent/40 p-4 text-sm">
          <CalendarX2 className="mt-0.5 size-5 shrink-0 text-accent-foreground" />
          <p className="text-accent-foreground">
            Você já usou sua mentoria desta semana — só é permitida uma chamada por semana. Você poderá
            marcar a próxima a partir de <span className="font-semibold">domingo</span>.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Mês anterior"
            disabled={visibleMonth <= minMonthKey}
            onClick={() => setVisibleMonth((m) => addMonthsToKey(m, -1))}
            className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="font-heading text-base font-semibold tracking-tight">
            {formatDateKeyMonthYear(visibleMonth)}
          </p>
          <button
            type="button"
            aria-label="Próximo mês"
            disabled={visibleMonth >= maxMonthKey}
            onClick={() => setVisibleMonth((m) => addMonthsToKey(m, 1))}
            className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </span>
          ))}
          {monthGrid.map((key) => {
            const inCurrentMonth = key.slice(0, 7) === visibleMonth.slice(0, 7);
            const hasSlots = inCurrentMonth && (slotsByDay.get(key)?.length ?? 0) > 0;
            const isSelected = key === selectedDate;
            const isToday = key === dateKeys[0];
            return (
              <div key={key} className="flex items-center justify-center py-0.5">
                <button
                  type="button"
                  disabled={!hasSlots}
                  onClick={() => setSelectedDate(key)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    !inCurrentMonth && "pointer-events-none text-transparent",
                    inCurrentMonth && !hasSlots && "cursor-not-allowed text-muted-foreground/30",
                    inCurrentMonth && hasSlots && !isSelected && "text-foreground hover:bg-accent/15",
                    isSelected && "bg-primary text-primary-foreground shadow-md shadow-primary/25",
                    isToday && !isSelected && "ring-1 ring-accent/60",
                  )}
                >
                  {formatDateKeyDayNumber(key)}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {formatDateKeyFull(selectedDate)} · horários em {profile.timezone}
        </p>
        {daySlots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            Sem horários livres neste dia.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {daySlots.map((slot) => (
              <button
                key={slot.startsAt.toISOString()}
                type="button"
                disabled={slot.busy}
                onClick={() => setSelectedSlot(slot)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-medium transition-all",
                  slot.busy
                    ? "cursor-not-allowed border-border/50 text-muted-foreground/40 line-through"
                    : "border-border hover:-translate-y-0.5 hover:border-primary hover:bg-accent/10 hover:shadow-md",
                )}
              >
                {formatTime(slot.startsAt, profile.timezone)}
              </button>
            ))}
          </div>
        )}
      </div>

      <BookingDialog
        slot={selectedSlot}
        dateLabel={formatDateKeyFull(selectedDate)}
        mentorId={profile.id}
        timeZone={profile.timezone}
        onOpenChange={(open) => !open && setSelectedSlot(null)}
        onBooked={handleBooked}
      />
    </div>
  );
}
