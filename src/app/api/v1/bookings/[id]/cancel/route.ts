import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedIntegrationRequest, unauthorizedIntegrationResponse } from "@/lib/integration-auth";
import { deleteCalendarEvent, getMentorAccessToken } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

/** Cancela um agendamento criado pela API (ou por qualquer outra via) —
 * libera o horário de novo pra constraint de exclusão/elegibilidade, assim
 * como o cancelamento feito pelo mentor no painel interno. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedIntegrationRequest(request)) return unauthorizedIntegrationResponse();

  const { id } = await params;
  const admin = createAdminClient();

  const { data: updated, error } = await admin
    .from("bookings")
    .update({ status: "cancelada" })
    .eq("id", id)
    .neq("status", "cancelada")
    .select("mentor_id, google_event_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Não foi possível cancelar o agendamento." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Agendamento não encontrado (ou já estava cancelado)." }, { status: 404 });
  }

  if (updated.google_event_id) {
    try {
      const accessToken = await getMentorAccessToken(updated.mentor_id);
      if (accessToken) await deleteCalendarEvent(accessToken, updated.google_event_id);
    } catch (err) {
      console.error("Falha ao remover evento do Google Calendar:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
