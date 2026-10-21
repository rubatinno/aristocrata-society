import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedIntegrationRequest, unauthorizedIntegrationResponse } from "@/lib/integration-auth";
import { createBookingForMentee } from "@/lib/booking-service";

export const dynamic = "force-dynamic";

/** Lista os agendamentos de um mentorado — pra outro sistema mostrar
 * "sua próxima mentoria" ou conferir que os dados estão sincronizados. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedIntegrationRequest(request)) return unauthorizedIntegrationResponse();

  const { searchParams } = new URL(request.url);
  const menteeEmail = searchParams.get("menteeEmail")?.trim().toLowerCase();
  if (!menteeEmail) {
    return NextResponse.json({ error: "Informe menteeEmail." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: bookings } = await admin
    .from("bookings")
    .select("id, mentor_id, starts_at, ends_at, status, meeting_link, notes")
    .eq("mentee_email", menteeEmail)
    .order("starts_at", { ascending: false });

  const mentorIds = [...new Set((bookings ?? []).map((b) => b.mentor_id))];
  const mentorNames = new Map<string, string>();
  if (mentorIds.length > 0) {
    const { data: mentors } = await admin.from("profiles").select("id, full_name").in("id", mentorIds);
    for (const m of mentors ?? []) mentorNames.set(m.id, m.full_name);
  }

  return NextResponse.json({
    bookings: (bookings ?? []).map((b) => ({
      id: b.id,
      mentorId: b.mentor_id,
      mentorName: mentorNames.get(b.mentor_id) ?? null,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      status: b.status,
      meetingLink: b.meeting_link,
      notes: b.notes,
    })),
  });
}

/**
 * Cria um agendamento em nome de um mentorado já provisionado (ver
 * POST /api/v1/mentees). Passa pelas MESMAS validações do fluxo interno —
 * aprovação, limite do plano, elegibilidade por nº de chamada, conflito de
 * horário — via lib/booking-service, então nunca existe risco de um
 * agendamento feito por aqui furar uma regra que o app interno aplicaria.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedIntegrationRequest(request)) return unauthorizedIntegrationResponse();

  const body = await request.json().catch(() => null);
  const mentorId = typeof body?.mentorId === "string" ? body.mentorId : "";
  const menteeEmail = typeof body?.menteeEmail === "string" ? body.menteeEmail.trim().toLowerCase() : "";
  const startsAt = typeof body?.startsAt === "string" ? body.startsAt : "";
  const endsAt = typeof body?.endsAt === "string" ? body.endsAt : "";
  const notes = typeof body?.notes === "string" ? body.notes : "";

  if (!mentorId || !menteeEmail || !startsAt || !endsAt) {
    return NextResponse.json(
      { error: "Informe mentorId, menteeEmail, startsAt e endsAt." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: mentee } = await admin
    .from("mentee_profiles")
    .select("id, full_name, phone")
    .eq("email", menteeEmail)
    .maybeSingle();

  if (!mentee) {
    return NextResponse.json(
      { error: "Mentorado não encontrado. Chame POST /api/v1/mentees primeiro pra provisionar essa conta." },
      { status: 404 },
    );
  }

  const result = await createBookingForMentee({
    mentorId,
    menteeId: mentee.id,
    menteeName: mentee.full_name ?? "",
    menteeEmail,
    menteePhone: mentee.phone ?? "",
    startsAt,
    endsAt,
    notes,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json(result, { status: 201 });
}
