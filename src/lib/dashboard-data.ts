import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Booking, Database } from "@/lib/types";

export async function listBookings(
  supabase: SupabaseClient<Database>,
  mentorId: string,
): Promise<Booking[]> {
  const { data } = await supabase
    .from("bookings")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("starts_at", { ascending: true });

  return data ?? [];
}

export function computeStats(bookings: Booking[], now: Date = new Date()) {
  const upcoming = bookings.filter((b) => b.status === "confirmada" && new Date(b.starts_at) >= now);
  const completed = bookings.filter((b) => b.status === "concluida");
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thisWeek = upcoming.filter((b) => new Date(b.starts_at) <= weekFromNow);

  return {
    upcomingCount: upcoming.length,
    completedCount: completed.length,
    thisWeekCount: thisWeek.length,
    nextBookings: upcoming.slice(0, 5),
  };
}
