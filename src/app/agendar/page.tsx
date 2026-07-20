import { addDays } from "date-fns";
import { LogoMark } from "@/components/logo";
import { MentorPicker, type MentorOption } from "@/components/booking/mentor-picker";
import { UpcomingBookingBanner } from "@/components/booking/upcoming-booking-banner";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getMenteeSession } from "@/app/agendar/mentee-actions";
import { isWeeklyLimitReached } from "@/lib/booking-limits";
import type { AvailabilityDate, AvailabilityRule, Plan, Profile } from "@/lib/types";

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: Promise<{ mentor?: string }>;
}) {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const { mentor: initialSlug } = await searchParams;
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .neq("full_name", "")
    .order("full_name");

  const now = new Date();

  const mentors: MentorOption[] = await Promise.all(
    ((profiles as Profile[]) ?? []).map(async (profile) => {
      const windowEnd = addDays(now, profile.booking_window_days);

      const [{ data: rules }, { data: dateRules }, { data: busyRanges }] = await Promise.all([
        supabase
          .from("availability_rules")
          .select("*")
          .eq("mentor_id", profile.id)
          .eq("is_active", true),
        supabase
          .from("availability_dates")
          .select("*")
          .eq("mentor_id", profile.id)
          .eq("is_active", true)
          .gte("date", now.toISOString().slice(0, 10)),
        supabase.rpc("get_busy_ranges", {
          p_mentor_id: profile.id,
          p_from: now.toISOString(),
          p_to: windowEnd.toISOString(),
        }),
      ]);

      return {
        profile,
        rules: profile.recurring_enabled ? ((rules as AvailabilityRule[]) ?? []) : [],
        dateRules: (dateRules as AvailabilityDate[]) ?? [],
        busyRanges: busyRanges ?? [],
      };
    }),
  );

  const menteeSession = await getMenteeSession();
  let upcomingBooking: { startsAt: string; mentorName: string; timezone: string } | null = null;
  let weeklyLimitReached = false;

  if (menteeSession) {
    const admin = createAdminClient();

    const [{ data: booking }, { data: approval }] = await Promise.all([
      admin
        .from("bookings")
        .select("starts_at, mentor_id")
        .eq("mentee_id", menteeSession.userId)
        .eq("status", "confirmada")
        .gte("starts_at", now.toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin.from("approved_mentees").select("plan_id").eq("email", menteeSession.email).maybeSingle(),
    ]);

    if (booking) {
      const { data: mentorProfile } = await admin
        .from("profiles")
        .select("full_name, timezone")
        .eq("id", booking.mentor_id)
        .maybeSingle();

      upcomingBooking = {
        startsAt: booking.starts_at,
        mentorName: mentorProfile?.full_name ?? "seu mentor",
        timezone: mentorProfile?.timezone ?? "America/Sao_Paulo",
      };
    }

    let plan: Plan | null = null;
    if (approval?.plan_id) {
      const { data: planRow } = await admin.from("plans").select("*").eq("id", approval.plan_id).maybeSingle();
      plan = planRow;
    }

    weeklyLimitReached = await isWeeklyLimitReached(admin, menteeSession.email, plan, now);
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex justify-center">
          <LogoMark className="h-9" />
        </div>

        {upcomingBooking && (
          <UpcomingBookingBanner
            startsAt={upcomingBooking.startsAt}
            mentorName={upcomingBooking.mentorName}
            timezone={upcomingBooking.timezone}
          />
        )}

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <MentorPicker
            mentors={mentors}
            initialSlug={initialSlug}
            hasUpcomingBooking={Boolean(upcomingBooking)}
            weeklyLimitReached={weeklyLimitReached}
          />
        </div>
      </div>
    </div>
  );
}
