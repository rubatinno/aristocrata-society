import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Autenticação da API de integração (api/v1/*) — um segredo fixo em
 * INTEGRATION_API_KEY, enviado como "Authorization: Bearer <chave>" pelo
 * sistema externo. Mesmo padrão já usado pelo cron de lembretes
 * (CRON_SECRET) — um valor só, sem necessidade de rotação automática,
 * porque quem chama é sempre o backend do outro sistema, nunca o navegador.
 */
export function unauthorizedIntegrationResponse() {
  return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
}

export function isAuthorizedIntegrationRequest(request: NextRequest): boolean {
  const expected = process.env.INTEGRATION_API_KEY;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}
