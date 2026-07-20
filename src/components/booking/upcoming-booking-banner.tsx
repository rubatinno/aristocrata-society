"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2 } from "lucide-react";
import { formatFullDate, formatTime } from "@/lib/format";

function formatCountdown(ms: number) {
  if (ms <= 0) return "Está começando!";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}min`);
  if (days === 0 && hours === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function UpcomingBookingBanner({
  startsAt,
  mentorName,
  timezone,
}: {
  startsAt: string;
  mentorName: string;
  timezone: string;
}) {
  const target = new Date(startsAt);
  const [now, setNow] = useState<Date | null>(null);

  // Relógio ao vivo — só existe no cliente (o servidor renderizaria um
  // instante diferente do navegador, causando mismatch de hidratação).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm">
      <CalendarCheck2 className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="space-y-1">
        <p className="text-foreground">
          Sua mentoria está agendada para{" "}
          <span className="font-semibold">{formatFullDate(target, timezone)}</span> às{" "}
          <span className="font-semibold">{formatTime(target, timezone)}</span> com {mentorName}.
        </p>
        {now && (
          <p className="text-xs text-muted-foreground">
            Faltam <span className="font-medium text-primary">{formatCountdown(target.getTime() - now.getTime())}</span>
          </p>
        )}
      </div>
    </div>
  );
}
