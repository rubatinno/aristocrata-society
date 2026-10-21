import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedIntegrationRequest, unauthorizedIntegrationResponse } from "@/lib/integration-auth";
import { ensureMenteeAccount } from "@/lib/booking-service";

export const dynamic = "force-dynamic";

/**
 * Provisiona/aprova um mentorado vindo de outro sistema (ex: alguém que
 * acabou de comprar acesso na área de membros). Chame isso UMA VEZ, logo
 * depois da matrícula/compra do outro lado — antes de tentar criar
 * agendamentos pra esse e-mail em /api/v1/bookings.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedIntegrationRequest(request)) return unauthorizedIntegrationResponse();

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const planId = typeof body?.planId === "string" ? body.planId : null;

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Informe um email válido." }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: "Informe fullName." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Informe phone." }, { status: 400 });
  }

  try {
    const { menteeId, created } = await ensureMenteeAccount({ email, fullName, phone, planId });
    return NextResponse.json({ menteeId, created }, { status: created ? 201 : 200 });
  } catch (err) {
    console.error("Falha ao provisionar mentorado via API de integração:", err);
    return NextResponse.json({ error: "Não foi possível provisionar o mentorado." }, { status: 500 });
  }
}
