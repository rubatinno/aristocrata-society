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

/** `required` null = horário aberto pra qualquer mentorado. Caso contrário,
 * só bate com quem está exatamente nessa Nª chamada. */
export function matchesCallNumber(required: number | null, menteeCallNumber: number): boolean {
  return required === null || required === menteeCallNumber;
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

/** dateKey (yyyy-MM-dd) do primeiro dia do mês de `key`. */
export function startOfMonthKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/** Mesmo mês de `key`, deslocado `delta` meses (±1 pra navegar no calendário). */
export function addMonthsToKey(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1, 12));
  return d.toISOString().slice(0, 10);
}

/**
 * Grade completa de semanas (6×7 ou 5×7 células) pro mês de `monthKey`,
 * incluindo os dias de preenchimento do mês anterior/seguinte — como um
 * calendário de verdade, não só os dias dentro da janela de agendamento.
 */
export function buildMonthGrid(monthKey: string): string[] {
  const first = startOfMonthKey(monthKey);
  const [year, month] = first.split("-").map(Number);
  const firstWeekday = weekdayFromDateKey(first);
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const gridStart = new Date(Date.UTC(year, month - 1, 1 - firstWeekday, 12));

  return Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + i);
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

      // Horário passado/muito em cima da hora ou já preenchido: nem aparece
      // na lista — só mostra o que está realmente disponível agora.
      if (!isBefore(cursor, earliestStart) && !overlapsBusy) {
        slots.push({ startsAt: cursor, endsAt: slotEnd, busy: false });
      }

      cursor = addMinutes(cursor, step);
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
