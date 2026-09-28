/** Data em que um conteúdo com liberação por dias (drip) fica disponível —
 * `null` quando não tem trava (libera na hora). */
export function computeUnlockDate(registeredAt: string, unlockAfterDays: number | null): Date | null {
  if (!unlockAfterDays || unlockAfterDays <= 0) return null;
  const date = new Date(registeredAt);
  date.setDate(date.getDate() + unlockAfterDays);
  return date;
}

export function daysUntil(date: Date): number {
  const diffMs = date.getTime() - Date.now();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}
