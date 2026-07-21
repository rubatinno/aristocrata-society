import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatDateTime } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { Users } from "lucide-react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function BookingRow({
  booking,
  timeZone,
  actions,
  mentorName,
  pending,
  groupLink,
}: {
  booking: Booking;
  timeZone: string;
  actions?: React.ReactNode;
  mentorName?: string;
  pending?: boolean;
  groupLink?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <Avatar className="size-10 shrink-0 border border-border">
        <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
          {initials(booking.mentee_name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{booking.mentee_name}</p>
          <StatusBadge status={booking.status} pending={pending} />
          {mentorName && (
            <span className="truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {mentorName}
            </span>
          )}
          {groupLink && (
            <a
              href={groupLink}
              target="_blank"
              rel="noreferrer"
              title="Ver grupo do mentorado"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:underline"
            >
              <Users className="size-3" /> Grupo
            </a>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatDateTime(new Date(booking.starts_at), timeZone)} · {booking.mentee_email}
          {booking.mentee_phone ? ` · ${booking.mentee_phone}` : ""}
          {booking.notes ? ` · ${booking.notes}` : ""}
        </p>
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
