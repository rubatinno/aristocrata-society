import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedIntegrationRequest, unauthorizedIntegrationResponse } from "@/lib/integration-auth";
import {
  buildDaySlots,
  listCandidateDateKeys,
  matchesCallNumber,
  weekdayFromDateKey,
} from "@/lib/scheduling";

export const dynamic = "force-dynamic";

const MAX_DAYS = 31;

/**
 * Horários livres de um mentor pros próximos N dias, já filtrados pela
 * elegibilidade de chamada (1ª, 2ª...) do mentorado informado — mesma regra
 * usada na tela de agendamento (agendar/page.tsx) e na criação do
 * agendamento (lib/booking-service.ts). Precisa de `menteeEmail` porque
 * quais horários aparecem depende de em qual chamada esse mentorado está.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedIntegrationRequest(request)) return unauthorizedIntegrationResponse();

  const { searchParams } = new URL(request.url);
  const mentorId = searchParams.get("mentorId");
  const menteeEmail = searchParams.get("menteeEmail")?.trim().toLowerCase();
  const daysParam = Number(searchParams.get("days") ?? "14");

  if (!mentorId) {
    return NextResponse.json({ error: "Informe mentorId." }, { status: 400 });
  }
  if (!menteeEmail) {
    return NextResponse.json(
      { error: "Informe menteeEmail — os horários elegíveis dependem de em qual chamada o mentorado está." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", mentorId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Mentor não encontrado." }, { status: 404 });
  }

  const { count: completedCount } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("mentee_email", menteeEmail)
    .in("status", ["concluida", "no_show"]);
  const menteeCallNumber = (completedCount ?? 0) + 1;

  const days = Math.min(Math.max(daysParam, 1), Math.min(profile.booking_window_days, MAX_DAYS));
  const dateKeys = listCandidateDateKeys(days, profile.timezone);

  const [{ data: rules }, { data: dateRules }, { data: busyRanges }] = await Promise.all([
    profile.recurring_enabled
      ? admin.from("availability_rules").select("*").eq("mentor_id", mentorId).eq("is_active", true)
      : Promise.resolve({ data: [] }),
    admin
      .from("availability_dates")
      .select("*")
      .eq("mentor_id", mentorId)
      .eq("is_active", true)
      .in("date", dateKeys),
    admin.rpc("get_busy_ranges", {
      p_mentor_id: mentorId,
      p_from: new Date().toISOString(),
      p_to: new Date(`${dateKeys[dateKeys.length - 1]}T23:59:59`).toISOString(),
    }),
  ]);

  const eligibleRules = (rules ?? []).filter((r) => matchesCallNumber(r.required_call_number, menteeCallNumber));
  const eligibleDateRules = (dateRules ?? []).filter((d) =>
    matchesCallNumber(d.required_call_number, menteeCallNumber),
  );

  const days_: { date: string; slots: { startsAt: string; endsAt: string }[] }[] = dateKeys.map((key) => {
    const slots = buildDaySlots({
      dateKey: key,
      weekday: weekdayFromDateKey(key),
      rules: eligibleRules,
      dateRules: eligibleDateRules,
      timeZone: profile.timezone,
      sessionDurationMinutes: profile.session_duration_minutes,
      bufferMinutes: profile.buffer_minutes,
      busyRanges: busyRanges ?? [],
      minNoticeMinutes: profile.min_notice_hours * 60,
    });

    return {
      date: key,
      slots: slots.filter((s) => !s.busy).map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })),
    };
  });

  return NextResponse.json({
    mentorId,
    menteeCallNumber,
    timezone: profile.timezone,
    sessionDurationMinutes: profile.session_duration_minutes,
    days: days_,
  });
}
