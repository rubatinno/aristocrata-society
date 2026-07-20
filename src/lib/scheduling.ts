import { addDays, addMinutes, areIntervalsOverlapping, isBefore } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type { AvailabilityDate, AvailabilityRule, Weekday } from "@/lib/types";

export interface BusyRange {
  starts_at: string;
  ends_at: string;
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  busy: boolean;
}

export function weekdayOf(date: Date): Weekday {
  return date.getDay() as Weekday;
}

/** Combina uma data (yyyy-MM-dd) + hora (HH:mm) no fuso do mentor num instante UTC. */
function zonedDateTime(dateKey: string, time: string, timeZone: string): Date {
  return fromZonedTime(`${dateKey}T${time}`, timeZone);
}

export function dateKey(date: Date, timeZone: string): string {
  // yyyy-MM-dd na perspectiva do fuso do mentor
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date,
  );
}

/** Dia da semana (0-6) de uma data "pura" yyyy-MM-dd, sem depender do fuso local do dispositivo. */
export function weekdayFromDateKey(key: string): Weekday {
  return new Date(`${key}T12:00:00Z`).getUTCDay() as Weekday;
}

/** Próximos `days` dias, como dateKeys (yyyy-MM-dd), no calendário do mentor. */
export function listCandidateDateKeys(days: number, timeZone: string, from: Date = new Date()): string[] {
  const todayKey = dateKey(from, timeZone);
  const anchor = new Date(`${todayKey}T12:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(anchor, i);
    return d.toISOString().slice(0, 10);
  });
}

interface BuildDaySlotsInput {
  dateKey: string; // yyyy-MM-dd, no fuso do mentor
  weekday: Weekday;
  rules: AvailabilityRule[];
  /** Horários avulsos cadastrados para essa data específica (somam-se ao padrão semanal). */
  dateRules?: AvailabilityDate[];
  timeZone: string;
  sessionDurationMinutes: number;
  bufferMinutes: number;
  busyRanges: BusyRange[];
  now?: Date;
  minNoticeMinutes?: number;
}

/** Gera os horários de início disponíveis para um dia, já como instantes UTC. */
export function buildDaySlots({
  dateKey: day,
  weekday,
  rules,
  dateRules = [],
  timeZone,
  sessionDurationMinutes,
  bufferMinutes,
  busyRanges,
  now = new Date(),
  minNoticeMinutes = 60,
}: BuildDaySlotsInput): Slot[] {
  const step = sessionDurationMinutes + bufferMinutes;
  const earliestStart = addMinutes(now, minNoticeMinutes);
  const busyIntervals = busyRanges.map((b) => ({
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
  }));

  const windows = [
    ...rules.filter((r) => r.is_active && r.weekday === weekday),
    ...dateRules.filter((d) => d.is_active && d.date === day),
  ];

  const slots: Slot[] = [];

  for (const window of windows) {
    let cursor = zonedDateTime(day, window.start_time.slice(0, 5), timeZone);
    const windowEnd = zonedDateTime(day, window.end_time.slice(0, 5), timeZone);

    while (true) {
      const slotEnd = addMinutes(cursor, sessionDurationMinutes);
      if (slotEnd > windowEnd) break;

      const overlapsBusy = busyIntervals.some((busy) =>
        areIntervalsOverlapping({ start: cursor, end: slotEnd }, busy, { inclusive: false }),
      );

      // Horários passados/muito em cima da hora continuam ocultos; horários
      // ocupados aparecem na lista, só desabilitados (cinza).
      if (!isBefore(cursor, earliestStart)) {
        slots.push({ startsAt: cursor, endsAt: slotEnd, busy: overlapsBusy });
      }

      cursor = addMinutes(cursor, step);
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
