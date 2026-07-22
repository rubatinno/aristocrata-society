import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "@/lib/types";
import { sendEmail } from "@/lib/email";
import { buildReminderEmail, type ReminderKind } from "@/lib/reminder-emails";

export const dynamic = "force-dynamic";

const WINDOWS: { kind: ReminderKind; column: "reminder_30_sent_at" | "reminder_5_sent_at" | "reminder_start_sent_at"; fromMin: number; toMin: number }[] = [
  { kind: "30", column: "reminder_30_sent_at", fromMin: 29, toMin: 31 },
  { kind: "5", column: "reminder_5_sent_at", fromMin: 4, toMin: 6 },
  { kind: "start", column: "reminder_start_sent_at", fromMin: -1, toMin: 1 },
];

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const mentorCache = new Map<string, { full_name: string; timezone: string; email: string | null }>();
  async function getMentor(mentorId: string) {
    const cached = mentorCache.get(mentorId);
    if (cached) return cached;

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, timezone")
      .eq("id", mentorId)
      .maybeSingle();

    const { data: userData } = await admin.auth.admin.getUserById(mentorId);

    const mentor = {
      full_name: profile?.full_name ?? "seu mentor",
      timezone: profile?.timezone ?? "America/Sao_Paulo",
      email: userData?.user?.email ?? null,
    };
    mentorCache.set(mentorId, mentor);
    return mentor;
  }

  let sent = 0;
  let checked = 0;

  for (const window of WINDOWS) {
    const from = new Date(now.getTime() + window.fromMin * 60_000).toISOString();
    const to = new Date(now.getTime() + window.toMin * 60_000).toISOString();

    const { data: bookings } = await admin
      .from("bookings")
      .select("id, mentor_id, mentee_name, mentee_email, starts_at, ends_at")
      .eq("status", "confirmada")
      .is(window.column, null)
      .gte("starts_at", from)
      .lt("starts_at", to);

    if (!bookings) continue;
    checked += bookings.length;

    for (const booking of bookings) {
      try {
        const mentor = await getMentor(booking.mentor_id);

        await Promise.allSettled([
          sendEmail({
            to: booking.mentee_email,
            ...buildReminderEmail({
              recipientName: booking.mentee_name,
              otherPartyName: mentor.full_name,
              mentorName: mentor.full_name,
              menteeName: booking.mentee_name,
              kind: window.kind,
              startsAt: booking.starts_at,
              endsAt: booking.ends_at,
              timeZone: mentor.timezone,
              panelUrl: "/agendar",
            }),
          }),
          mentor.email
            ? sendEmail({
                to: mentor.email,
                ...buildReminderEmail({
                  recipientName: mentor.full_name,
                  otherPartyName: booking.mentee_name,
                  mentorName: mentor.full_name,
                  menteeName: booking.mentee_name,
                  kind: window.kind,
                  startsAt: booking.starts_at,
                  endsAt: booking.ends_at,
                  timeZone: mentor.timezone,
                  panelUrl: "/dashboard/agenda",
                }),
              })
            : Promise.resolve(),
        ]);

        const update: Partial<Booking> = { [window.column]: now.toISOString() };
        await admin.from("bookings").update(update).eq("id", booking.id);

        sent += 1;
      } catch (err) {
        console.error(`Falha ao processar lembrete (${window.kind}) do agendamento ${booking.id}:`, err);
      }
    }
  }

  return NextResponse.json({ ok: true, checked, sent });
}
