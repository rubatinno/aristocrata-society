import "server-only";
import { startOfWeek, addDays } from "date-fns";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/types";

const DEFAULT_CALLS_PER_WEEK = 1;

/** Mesma regra usada em createBooking (agendar/actions.ts) — mantida aqui
 * também pra decidir, na tela de agendamento, se todos os horários devem
 * aparecer indisponíveis porque o mentorado já usou a call da semana. */
export async function isWeeklyLimitReached(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  plan: Plan | null,
  now: Date = new Date(),
): Promise<boolean> {
  const weeklyLimit = plan?.calls_per_week ?? DEFAULT_CALLS_PER_WEEK;
  // Semana de domingo a sábado — o limite libera de novo todo domingo.
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = addDays(weekStart, 7);

  const { count } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("mentee_email", email)
    .neq("status", "cancelada")
    .gte("starts_at", weekStart.toISOString())
    .lt("starts_at", weekEnd.toISOString());

  return (count ?? 0) >= weeklyLimit;
}
