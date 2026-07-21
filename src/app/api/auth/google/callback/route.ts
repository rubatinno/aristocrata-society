import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, fetchGoogleEmail } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/dashboard/configuracoes?google=${status}`);

  if (oauthError || !code || !state) {
    return redirectTo("error");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // `state` guarda o id de quem iniciou o fluxo — se não bate com quem está
  // logado agora (ou ninguém está logado), não conecta.
  if (!user || user.id !== state) {
    return redirectTo("error");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // O Google só devolve refresh_token na primeira autorização de fato
    // (por isso forçamos prompt=consent) — sem ele não dá pra manter a
    // integração funcionando depois que o access_token expira.
    if (!tokens.refresh_token) {
      return redirectTo("error");
    }

    const connectedEmail = await fetchGoogleEmail(tokens.access_token);

    const admin = createAdminClient();
    const { error: upsertError } = await admin.from("mentor_google_tokens").upsert({
      mentor_id: user.id,
      refresh_token: tokens.refresh_token,
      connected_email: connectedEmail,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) return redirectTo("error");

    await admin.from("profiles").update({ google_calendar_connected: true }).eq("id", user.id);

    return redirectTo("connected");
  } catch (err) {
    console.error("Erro no callback do Google Calendar:", err);
    return redirectTo("error");
  }
}
