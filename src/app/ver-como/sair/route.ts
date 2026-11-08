import { NextResponse, type NextRequest } from "next/server";
import { VIEW_AS_MENTOR_COOKIE } from "@/lib/session";

// Sai do "Ver como" de mentor. É um GET (link comum) de propósito: enquanto o
// modo visualização está ligado, o proxy recusa Server Actions no painel.
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/dashboard/aprovacoes", request.url));
  response.cookies.delete(VIEW_AS_MENTOR_COOKIE);
  return response;
}
