import { addDays, startOfWeek } from "date-fns";

/** yyyy-MM-dd no fuso local do navegador — evita o mesmo problema de
 * toISOString() virar o dia seguinte em fusos negativos à noite. */
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Intervalo (domingo a sábado) de uma semana relativa a hoje.
 * weeksAgo=0 → semana atual, weeksAgo=1 → semana passada. */
export function getWeekRange(weeksAgo: number): { from: string; to: string } {
  const start = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), -7 * weeksAgo);
  const end = addDays(start, 6);
  return { from: toDateKey(start), to: toDateKey(end) };
}
