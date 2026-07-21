"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
} from "@/app/dashboard/configuracoes/google-actions";
import { CalendarCheck2, Loader2 } from "lucide-react";

export function GoogleCalendarCard({
  connected,
  connectedEmail,
}: {
  connected: boolean;
  connectedEmail: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isConnecting, startConnecting] = useTransition();
  const [isDisconnecting, startDisconnecting] = useTransition();

  // Reage ao retorno do callback OAuth (query string vinda do servidor),
  // não a um valor derivável durante a renderização.
  useEffect(() => {
    const status = searchParams.get("google");
    if (status === "connected") {
      toast.success("Google Calendar conectado!");
      router.replace("/dashboard/configuracoes");
    } else if (status === "error") {
      toast.error("Não foi possível conectar ao Google Calendar. Tente novamente.");
      router.replace("/dashboard/configuracoes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleConnect() {
    startConnecting(() => {
      void connectGoogleCalendar();
    });
  }

  function handleDisconnect() {
    startDisconnecting(async () => {
      try {
        await disconnectGoogleCalendar();
        toast.success("Google Calendar desconectado.");
      } catch {
        toast.error("Não foi possível desconectar.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarCheck2 className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium">Google Calendar</p>
            <p className="text-xs text-muted-foreground">
              {connected
                ? `Conectado${connectedEmail ? ` · ${connectedEmail}` : ""} — seus agendamentos criam eventos automaticamente, com convite pro mentorado.`
                : "Conecte pra cada mentoria criar um evento automático na sua agenda, com convite enviado direto pro mentorado."}
            </p>
          </div>
        </div>
        {connected ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="shrink-0 gap-1.5"
          >
            {isDisconnecting && <Loader2 className="size-3.5 animate-spin" />}
            Desconectar
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={handleConnect}
            disabled={isConnecting}
            className="shrink-0 gap-1.5"
          >
            {isConnecting && <Loader2 className="size-3.5 animate-spin" />}
            Conectar Google Calendar
          </Button>
        )}
      </div>
    </div>
  );
}
