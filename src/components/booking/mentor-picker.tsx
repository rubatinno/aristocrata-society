"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookingFlow } from "@/components/booking/booking-flow";
import { createClient } from "@/lib/supabase/client";
import type { BusyRange } from "@/lib/scheduling";
import type { AvailabilityDate, AvailabilityRule, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Clock, Video } from "lucide-react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export interface MentorOption {
  profile: Profile;
  rules: AvailabilityRule[];
  dateRules: AvailabilityDate[];
  busyRanges: BusyRange[];
}

export function MentorPicker({
  mentors,
  initialSlug,
  hasUpcomingBooking = false,
  weeklyLimitReached = false,
}: {
  mentors: MentorOption[];
  initialSlug?: string;
  hasUpcomingBooking?: boolean;
  weeklyLimitReached?: boolean;
}) {
  const initialIndex = Math.max(
    0,
    mentors.findIndex((m) => m.profile.slug === initialSlug),
  );
  const [selectedId, setSelectedId] = useState(mentors[initialIndex]?.profile.id);
  const router = useRouter();
  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Escuta mudanças de disponibilidade/agendamentos em tempo real — quando um
  // mentor abre um novo horário (ou alguém acabou de preencher um), a página
  // se atualiza sozinha, sem o mentorado precisar recarregar.
  useEffect(() => {
    const supabase = createClient();

    function scheduleRefresh() {
      if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
      refreshTimeout.current = setTimeout(() => router.refresh(), 400);
    }

    const channel = supabase
      .channel("agendar-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "availability_dates" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const selected = useMemo(
    () => mentors.find((m) => m.profile.id === selectedId) ?? mentors[0],
    [mentors, selectedId],
  );

  function selectMentor(mentor: MentorOption) {
    setSelectedId(mentor.profile.id);
  }

  if (mentors.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        Nenhum mentor com agenda disponível no momento.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mentors.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Escolha seu mentor</p>
          <div className="flex flex-wrap gap-2">
            {mentors.map((mentor) => {
              const isActive = mentor.profile.id === selected?.profile.id;
              return (
                <button
                  key={mentor.profile.id}
                  type="button"
                  onClick={() => selectMentor(mentor)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    isActive
                      ? "border-primary bg-accent shadow-sm"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <Avatar className="size-8 border border-border" size="sm">
                    {mentor.profile.avatar_url && (
                      <AvatarImage src={mentor.profile.avatar_url} alt={mentor.profile.full_name} />
                    )}
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                      {initials(mentor.profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{mentor.profile.full_name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <div key={selected.profile.id} className="space-y-6">
          <div className="flex items-start gap-4 border-t border-border pt-5">
            <Avatar className="size-14 border border-border">
              {selected.profile.avatar_url && (
                <AvatarImage src={selected.profile.avatar_url} alt={selected.profile.full_name} />
              )}
              <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
                {initials(selected.profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                {selected.profile.full_name}
              </h2>
              {selected.profile.headline && (
                <p className="mt-1 text-sm text-muted-foreground">{selected.profile.headline}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1">
                  <Clock className="size-3" /> {selected.profile.session_duration_minutes} min
                </Badge>
                {selected.profile.meeting_location && (
                  <Badge variant="outline" className="gap-1">
                    <Video className="size-3" /> {selected.profile.meeting_location}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {selected.profile.booking_instructions && (
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground whitespace-pre-line">
              {selected.profile.booking_instructions}
            </div>
          )}

          <BookingFlow
            profile={selected.profile}
            rules={selected.rules}
            dateRules={selected.dateRules}
            busyRanges={selected.busyRanges}
            windowDays={selected.profile.booking_window_days}
            hasUpcomingBooking={hasUpcomingBooking}
            weeklyLimitReached={weeklyLimitReached}
          />
        </div>
      )}
    </div>
  );
}
