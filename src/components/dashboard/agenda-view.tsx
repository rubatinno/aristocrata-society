"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookingRow } from "@/components/dashboard/booking-row";
import { BookingActions } from "@/components/dashboard/booking-actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import type { Booking } from "@/lib/types";
import { CalendarDays, CalendarCheck2, CalendarX2, Search, X } from "lucide-react";

function matchesSearch(booking: Booking, query: string) {
  if (!query) return true;
  const haystack = `${booking.mentee_name} ${booking.mentee_email} ${booking.mentee_phone}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function matchesDateRange(booking: Booking, from: string, to: string) {
  const day = booking.starts_at.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function AgendaView({
  upcoming,
  past,
  cancelled,
  timeZone,
}: {
  upcoming: Booking[];
  past: Booking[];
  cancelled: Booking[];
  timeZone: string;
}) {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const hasFilters = query !== "" || from !== "" || to !== "";

  function clearFilters() {
    setQuery("");
    setFrom("");
    setTo("");
  }

  const filtered = useMemo(() => {
    const apply = (list: Booking[]) =>
      list.filter((b) => matchesSearch(b, query) && matchesDateRange(b, from, to));
    return {
      upcoming: apply(upcoming),
      past: apply(past),
      cancelled: apply(cancelled),
    };
  }, [upcoming, past, cancelled, query, from, to]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone"
            className="pl-8"
          />
        </div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <span className="text-sm text-muted-foreground">até</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
            <X className="size-3.5" /> Limpar
          </Button>
        )}
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">A realizar ({filtered.upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Histórico ({filtered.past.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas ({filtered.cancelled.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4 space-y-2">
          {filtered.upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={hasFilters ? "Nada encontrado" : "Nada agendado por enquanto"}
              description={
                hasFilters
                  ? "Tente ajustar a busca ou o período."
                  : "Assim que alguém marcar uma call pelo seu link, ela aparece aqui."
              }
            />
          ) : (
            filtered.upcoming.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                timeZone={timeZone}
                actions={<BookingActions bookingId={booking.id} />}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4 space-y-2">
          {filtered.past.length === 0 ? (
            <EmptyState
              icon={CalendarCheck2}
              title={hasFilters ? "Nada encontrado" : "Nenhuma call realizada ainda"}
              description={
                hasFilters
                  ? "Tente ajustar a busca ou o período."
                  : "Suas mentorias concluídas ou que já passaram do horário aparecem aqui."
              }
            />
          ) : (
            filtered.past.map((booking) => (
              <BookingRow key={booking.id} booking={booking} timeZone={timeZone} />
            ))
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4 space-y-2">
          {filtered.cancelled.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title={hasFilters ? "Nada encontrado" : "Nenhum cancelamento"}
              description={
                hasFilters
                  ? "Tente ajustar a busca ou o período."
                  : "Agendamentos cancelados por você ou pelo mentorado ficam listados aqui."
              }
            />
          ) : (
            filtered.cancelled.map((booking) => (
              <BookingRow key={booking.id} booking={booking} timeZone={timeZone} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
