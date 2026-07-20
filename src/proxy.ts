import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding"];

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  let cookiesToApply: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToApply = cookiesToSet;
      },
    },
  });

  // getUser() revalida a sessão com o servidor Supabase — não trocar por getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Só redireciona em navegação normal (GET) — um POST aqui é o próprio envio
  // do formulário de login/registro (Server Action), e devolver um redirect
  // HTTP puro nesse caso quebra o protocolo de resposta esperado pelo Next,
  // causando "An unexpected response was received from the server".
  if (request.method === "GET" && request.nextUrl.pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Repassa o id do usuário já validado via header — evita que cada página
  // precise chamar auth.getUser() de novo (um round-trip a mais pro servidor
  // de autenticação do Supabase a cada navegação). Sempre remove primeiro
  // qualquer valor vindo do próprio cliente antes de definir o nosso, senão
  // dava pra forjar esse header numa requisição direta.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-email");
  if (user) {
    requestHeaders.set("x-user-id", user.id);
    if (user.email) requestHeaders.set("x-user-email", user.email);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  cookiesToApply.forEach(({ name, value, options }) => response.cookies.set(name, value, options));

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
