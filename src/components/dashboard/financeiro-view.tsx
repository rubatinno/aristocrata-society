"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookingRow } from "@/components/dashboard/booking-row";
import { EmptyState } from "@/components/dashboard/empty-state";
import type { Booking, Profile } from "@/lib/types";
import { CalendarX2, CheckCircle2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_ITEMS: Record<string, string> = {
  all: "Todos os status",
  confirmada: "Confirmada",
  concluida: "Concluída",
  cancelada: "Cancelada",
  no_show: "Não compareceu",
};

function matchesSearch(booking: Booking, query: string) {
  if (!query) return true;
  const haystack = `${booking.mentee_name} ${booking.mentee_email}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function matchesDateRange(booking: Booking, from: string, to: string) {
  const day = booking.starts_at.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function FinanceiroView({ mentors, bookings }: { mentors: Profile[]; bookings: Booking[] }) {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mentorFilter, setMentorFilter] = useState("all");

  const hasFilters = query !== "" || from !== "" || to !== "" || statusFilter !== "all" || mentorFilter !== "all";

  function clearFilters() {
    setQuery("");
    setFrom("");
    setTo("");
    setStatusFilter("all");
    setMentorFilter("all");
  }

  // Base: respeita busca, período e status — mas não o mentor selecionado,
  // pra o resumo por mentor sempre comparar a equipe inteira.
  const baseFiltered = useMemo(
    () =>
      bookings.filter(
        (b) =>
          matchesSearch(b, query) &&
          matchesDateRange(b, from, to) &&
          (statusFilter === "all" || b.status === statusFilter),
      ),
    [bookings, query, from, to, statusFilter],
  );

  const summaryByMentor = useMemo(() => {
    const map = new Map<string, { total: number; concluida: number; cancelada: number; no_show: number }>();
    for (const booking of baseFiltered) {
      const entry = map.get(booking.mentor_id) ?? { total: 0, concluida: 0, cancelada: 0, no_show: 0 };
      entry.total += 1;
      if (booking.status === "concluida") entry.concluida += 1;
      if (booking.status === "cancelada") entry.cancelada += 1;
      if (booking.status === "no_show") entry.no_show += 1;
      map.set(booking.mentor_id, entry);
    }
    return map;
  }, [baseFiltered]);

  const list = useMemo(
    () => baseFiltered.filter((b) => mentorFilter === "all" || b.mentor_id === mentorFilter),
    [baseFiltered, mentorFilter],
  );

  const mentorItems: Record<string, string> = {
    all: "Todos os mentores",
    ...Object.fromEntries(mentors.map((m) => [m.id, m.full_name || m.slug])),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por mentorado"
            className="pl-8"
          />
        </div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <span className="text-sm text-muted-foreground">até</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)} items={STATUS_ITEMS}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mentorFilter} onValueChange={(v) => v && setMentorFilter(v)} items={mentorItems}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(mentorItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
            <X className="size-3.5" /> Limpar
          </Button>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Chamadas por mentor</h2>
        {mentors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum mentor cadastrado.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {mentors.map((mentor) => {
              const stats = summaryByMentor.get(mentor.id) ?? {
                total: 0,
                concluida: 0,
                cancelada: 0,
                no_show: 0,
              };
              const isActiveFilter = mentorFilter === mentor.id;
              return (
                <button
                  key={mentor.id}
                  type="button"
                  onClick={() => setMentorFilter(isActiveFilter ? "all" : mentor.id)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-4 text-left transition-colors",
                    isActiveFilter ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{mentor.full_name || mentor.slug}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {stats.total} no total
                      {stats.cancelada || stats.no_show
                        ? ` · ${stats.cancelada} cancelada${stats.cancelada === 1 ? "" : "s"} · ${stats.no_show} não compareceu`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-sm font-semibold text-success">
                    <CheckCircle2 className="size-3.5" />
                    {stats.concluida}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Agenda detalhada ({list.length})
        </h2>
        {list.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title={hasFilters ? "Nada encontrado" : "Nenhuma chamada registrada"}
            description={hasFilters ? "Tente ajustar os filtros." : "As chamadas da equipe aparecem aqui."}
          />
        ) : (
          <div className="space-y-2">
            {list.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                timeZone="America/Sao_Paulo"
                mentorName={
                  mentors.find((m) => m.id === booking.mentor_id)?.full_name ?? "Mentor removido"
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
