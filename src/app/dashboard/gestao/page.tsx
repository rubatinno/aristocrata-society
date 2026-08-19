import { addDays } from "date-fns";
import { GestaoView, type MenteeInsight } from "@/components/dashboard/gestao-view";
import { requireMentor } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApprovedMentee, Booking, Plan, Profile } from "@/lib/types";
import { ShieldAlert } from "lucide-react";

export default async function GestaoPage() {
  const { profile } = await requireMentor();

  if (!profile.is_admin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Só administradores podem ver a gestão.</p>
      </div>
    );
  }

  const admin = createAdminClient();

  const [{ data: mentees }, { data: plans }, { data: mentors }] = await Promise.all([
    admin
      .from("approved_mentees")
      .select("*")
      .eq("status", "approved")
      .eq("role", "mentee")
      .order("created_at", { ascending: false }),
    admin.from("plans").select("*"),
    admin.from("profiles").select("*"),
  ]);

  const menteeList = (mentees as ApprovedMentee[]) ?? [];
  const planList = (plans as Plan[]) ?? [];
  const mentorList = (mentors as Profile[]) ?? [];
  const plansById = new Map(planList.map((p) => [p.id, p]));
  const mentorNameById = new Map(mentorList.map((m) => [m.id, m.full_name || m.slug]));

  const bookingsByEmail = new Map<string, Booking[]>();
  if (menteeList.length > 0) {
    const emails = menteeList.map((m) => m.email);
    const { data: bookings } = await admin
      .from("bookings")
      .select("*")
      .in("mentee_email", emails)
      .neq("status", "cancelada")
      .order("starts_at", { ascending: false });

    for (const booking of (bookings as Booking[]) ?? []) {
      const list = bookingsByEmail.get(booking.mentee_email) ?? [];
      list.push(booking);
      bookingsByEmail.set(booking.mentee_email, list);
    }
  }

  const now = new Date();

  const insights: MenteeInsight[] = menteeList.map((mentee) => {
    const plan = mentee.plan_id ? (plansById.get(mentee.plan_id) ?? null) : null;
    const effectiveDurationDays = mentee.duration_days_override ?? plan?.duration_days ?? null;
    const effectiveTotalCalls = mentee.total_calls_override ?? plan?.total_calls ?? null;
    const daysRemaining = effectiveDurationDays
      ? Math.ceil(
          (addDays(new Date(`${mentee.starts_at}T00:00:00`), effectiveDurationDays).getTime() -
            now.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    const menteeBookings = bookingsByEmail.get(mentee.email) ?? []; // já ordenado desc por starts_at
    const completedCalls = menteeBookings.filter(
      (b) => b.status === "concluida" || b.status === "no_show",
    ).length;
    const noShowCount = menteeBookings.filter((b) => b.status === "no_show").length;
    const attendanceRate =
      completedCalls > 0 ? Math.round(((completedCalls - noShowCount) / completedCalls) * 100) : null;

    const lastBooking = menteeBookings[0] ?? null;
    const lastBookingStartsAt = lastBooking?.starts_at ?? null;
    const isUpcoming = lastBookingStartsAt ? new Date(lastBookingStartsAt) > now : false;
    const daysSinceLastBooking = lastBookingStartsAt
      ? Math.floor((now.getTime() - new Date(lastBookingStartsAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const pastDeadline = daysRemaining !== null && daysRemaining < 0;
    const usedAllCalls = effectiveTotalCalls !== null && completedCalls >= effectiveTotalCalls;

    return {
      id: mentee.id,
      fullName: mentee.full_name,
      email: mentee.email,
      startsAt: mentee.starts_at,
      planName: plan?.name ?? null,
      daysRemaining,
      effectiveTotalCalls,
      completedCalls,
      noShowCount,
      attendanceRate,
      totalBookings: menteeBookings.length,
      lastBookingStartsAt,
      isUpcoming,
      daysSinceLastBooking,
      isExpired: pastDeadline || usedAllCalls,
      lastMentorName: lastBooking ? (mentorNameById.get(lastBooking.mentor_id) ?? null) : null,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gestão</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral do engajamento dos mentorados — quem está ativo, quem venceu e quem parou de
          marcar chamadas.
        </p>
      </div>

      <GestaoView insights={insights} />
    </div>
  );
}
