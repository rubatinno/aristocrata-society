export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

export function formatWeekdayShort(date: Date, timeZone: string): string {
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone }).format(date);
  return label.replace(".", "").replace(/^\w/, (c) => c.toUpperCase());
}

export function formatDayNumber(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone }).format(date);
}

export function formatMonthShort(date: Date, timeZone: string): string {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone }).format(date);
  return label.replace(".", "");
}

export function formatFullDate(date: Date, timeZone: string): string {
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone,
  }).format(date);
  return label.replace(/^\w/, (c) => c.toUpperCase());
}

function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

export function formatDateKeyWeekdayShort(key: string): string {
  return formatWeekdayShort(dateFromKey(key), "UTC");
}

export function formatDateKeyDayNumber(key: string): string {
  return formatDayNumber(dateFromKey(key), "UTC");
}

export function formatDateKeyMonthShort(key: string): string {
  return formatMonthShort(dateFromKey(key), "UTC");
}

export function formatDateKeyFull(key: string): string {
  return formatFullDate(dateFromKey(key), "UTC");
}

export function formatDateTime(date: Date, timeZone: string): string {
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
  return label.replace(".", "").replace(/^\w/, (c) => c.toUpperCase());
}
