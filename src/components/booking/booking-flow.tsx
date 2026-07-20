"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  buildDaySlots,
  dateKey,
  listCandidateDateKeys,
  weekdayFromDateKey,
  type BusyRange,
  type Slot,
} from "@/lib/scheduling";
import {
  formatDateKeyDayNumber,
  formatDateKeyFull,
  formatDateKeyMonthShort,
  formatDateKeyWeekdayShort,
  formatTime,
} from "@/lib/format";
import { BookingDialog, readPendingBooking } from "@/components/booking/booking-dialog";
import type { AvailabilityDate, AvailabilityRule, Profile } from "@/lib/types";
import { CalendarX2, CheckCircle2 } from "lucide-react";

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
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<Slot | null>(null);

  const daySlots = slotsByDay.get(selectedDate) ?? [];
  const hasAnySlot = dateKeys.some((key) => (slotsByDay.get(key)?.length ?? 0) > 0);

  // Se acabamos de voltar de um link mágico enviado a partir dessa mesma
  // mentoria, reabre o diálogo direto no horário que a pessoa tinha escolhido.
  // Só roda uma vez ao montar, lendo o sessionStorage (fonte externa).
  useEffect(() => {
    const pending = readPendingBooking();
    if (!pending || pending.mentorId !== profile.id) return;

    for (const slots of slotsByDay.values()) {
      const found = slots.find((s) => s.startsAt.toISOString() === pending.startsAt);
      if (found) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedDate(dateKey(found.startsAt, profile.timezone));
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

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Escolha um dia</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dateKeys.map((key) => {
            const available = (slotsByDay.get(key)?.length ?? 0) > 0;
            const isSelected = key === selectedDate;
            return (
              <button
                key={key}
                type="button"
                disabled={!available}
                onClick={() => setSelectedDate(key)}
                className={cn(
                  "flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl border py-2 text-xs transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : available
                      ? "border-border text-foreground hover:border-primary/40"
                      : "border-border/50 text-muted-foreground/40",
                )}
              >
                <span>{formatDateKeyWeekdayShort(key)}</span>
                <span className="text-sm font-semibold">{formatDateKeyDayNumber(key)}</span>
                <span className="text-[10px] uppercase">{formatDateKeyMonthShort(key)}</span>
              </button>
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
                  "rounded-lg border py-2 text-sm font-medium transition-colors",
                  slot.busy
                    ? "cursor-not-allowed border-border/50 text-muted-foreground/40 line-through"
                    : "border-border hover:border-primary hover:bg-accent hover:text-accent-foreground",
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
