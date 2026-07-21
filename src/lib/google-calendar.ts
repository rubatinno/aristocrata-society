import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const GOOGLE_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

function getRedirectUri() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/api/auth/google/callback`;
}

/** Monta a URL de consentimento do Google. `state` carrega o id do mentor
 * pra confirmarmos, no callback, que é a mesma pessoa que iniciou o fluxo. */
export function buildGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_OAUTH_BASE}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) throw new Error(`Falha ao trocar código por token: ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error(`Falha ao renovar token do Google: ${await res.text()}`);
  const data: TokenResponse = await res.json();
  return data.access_token;
}

/** Busca o e-mail da conta Google conectada, pra mostrar na UI. */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email ?? null;
}

export interface CreateEventInput {
  accessToken: string;
  summary: string;
  description?: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  timeZone: string;
  attendeeEmail: string;
}

/** Cria o evento na agenda primária do mentor, convidando o mentorado por
 * e-mail (sendUpdates=all) — o Google manda o convite sozinho, sem o
 * mentorado precisar conectar nada. Retorna o id do evento criado. */
export async function createCalendarEvent(input: CreateEventInput): Promise<string | null> {
  const res = await fetch(`${CALENDAR_EVENTS_URL}?sendUpdates=all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startsAt, timeZone: input.timeZone },
      end: { dateTime: input.endsAt, timeZone: input.timeZone },
      attendees: [{ email: input.attendeeEmail }],
      reminders: { useDefault: true },
    }),
  });

  if (!res.ok) {
    console.error("Falha ao criar evento no Google Calendar:", await res.text());
    return null;
  }

  const data = await res.json();
  return data.id ?? null;
}

/** Pega o refresh_token salvo desse mentor e troca por um access_token
 * fresco. Retorna null se o mentor nunca conectou (ou a renovação falhar —
 * ex: ele revogou o acesso pelo lado do Google) — chamadores devem tratar
 * isso como "sem integração" e seguir o fluxo normal, sem quebrar o
 * agendamento em si. */
export async function getMentorAccessToken(mentorId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("mentor_google_tokens")
    .select("refresh_token")
    .eq("mentor_id", mentorId)
    .maybeSingle();

  if (!data?.refresh_token) return null;

  try {
    return await refreshAccessToken(data.refresh_token);
  } catch (err) {
    console.error("Não foi possível renovar o token do Google:", err);
    return null;
  }
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(`${CALENDAR_EVENTS_URL}/${eventId}?sendUpdates=all`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 410 Gone = já tinha sido removido antes, não é erro pra nós.
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    console.error("Falha ao remover evento do Google Calendar:", await res.text());
  }
}
