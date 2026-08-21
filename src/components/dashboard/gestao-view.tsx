"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/dashboard/empty-state";
import { formatFullDate } from "@/lib/format";
import { getWeekRange } from "@/lib/date-presets";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarX2,
  CheckCircle2,
  Flame,
  MoonStar,
  Phone,
  Search,
  Users,
  X,
} from "lucide-react";

export interface MenteeInsight {
  id: string;
  fullName: string | null;
  email: string;
  startsAt: string; // yyyy-MM-dd
  planName: string | null;
  daysRemaining: number | null;
  effectiveTotalCalls: number | null;
  completedCalls: number;
  noShowCount: number;
  attendanceRate: number | null; // 0-100
  pendingCount: number;
  totalBookings: number;
  lastBookingStartsAt: string | null;
  isUpcoming: boolean;
  lastBookingPending: boolean;
  daysSinceLastBooking: number | null;
  isExpired: boolean;
  lastMentorName: string | null;
}

const FREQUENT_THRESHOLD_DAYS = 10;
const INACTIVE_THRESHOLD_DAYS = 21;

function isFrequent(m: MenteeInsight) {
  return m.daysSinceLastBooking !== null && (m.isUpcoming || m.daysSinceLastBooking <= FREQUENT_THRESHOLD_DAYS);
}

function isInactive(m: MenteeInsight) {
  if (m.isUpcoming) return false;
  return m.daysSinceLastBooking === null || m.daysSinceLastBooking > INACTIVE_THRESHOLD_DAYS;
}

/** yyyy-MM-dd no fuso local do navegador, a partir de um ISO em UTC. */
function localDateKey(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function matchesLastCallRange(m: MenteeInsight, from: string, to: string) {
  if (!from && !to) return true;
  if (!m.lastBookingStartsAt) return false;
  const day = localDateKey(m.lastBookingStartsAt);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function matchesSearch(m: MenteeInsight, query: string) {
  if (!query) return true;
  const haystack = `${m.fullName ?? ""} ${m.email}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

const STATUS_ITEMS: Record<string, string> = {
  all: "Todos",
  active: "Ativos",
  expired: "Vencidos",
  frequent: "Frequentes",
  inactive: "Inativos",
  pending: "Pendentes",
};

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors",
        active ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/40",
      )}
    >
      <div className={cn("flex size-8 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-4" />
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  );
}

function lastCallLabel(m: MenteeInsight) {
  if (!m.lastBookingStartsAt) return "Nunca marcou";
  if (m.isUpcoming) return `Agendada · ${formatFullDate(new Date(m.lastBookingStartsAt), "America/Sao_Paulo")}`;
  const days = m.daysSinceLastBooking ?? 0;
  const when = days === 0 ? "Hoje" : days === 1 ? "Há 1 dia" : `Há ${days} dias`;
  return m.lastBookingPending ? `${when} · aguardando confirmação` : when;
}

export function GestaoView({ insights }: { insights: MenteeInsight[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minDaysInactive, setMinDaysInactive] = useState("");
  const [lastCallFrom, setLastCallFrom] = useState("");
  const [lastCallTo, setLastCallTo] = useState("");

  const counts = useMemo(
    () => ({
      total: insights.length,
      active: insights.filter((m) => !m.isExpired).length,
      expired: insights.filter((m) => m.isExpired).length,
      frequent: insights.filter(isFrequent).length,
      inactive: insights.filter(isInactive).length,
      pending: insights.filter((m) => m.pendingCount > 0).length,
    }),
    [insights],
  );

  const filtered = useMemo(() => {
    const minDays = minDaysInactive.trim() === "" ? null : Number.parseInt(minDaysInactive, 10);

    return insights
      .filter((m) => matchesSearch(m, query))
      .filter((m) => {
        if (statusFilter === "active") return !m.isExpired;
        if (statusFilter === "expired") return m.isExpired;
        if (statusFilter === "frequent") return isFrequent(m);
        if (statusFilter === "inactive") return isInactive(m);
        if (statusFilter === "pending") return m.pendingCount > 0;
        return true;
      })
      .filter((m) => {
        if (minDays === null || Number.isNaN(minDays)) return true;
        return (m.daysSinceLastBooking ?? Infinity) >= minDays;
      })
      .filter((m) => matchesLastCallRange(m, lastCallFrom, lastCallTo))
      .sort((a, b) => (b.daysSinceLastBooking ?? Infinity) - (a.daysSinceLastBooking ?? Infinity));
  }, [insights, query, statusFilter, minDaysInactive, lastCallFrom, lastCallTo]);

  const hasFilters =
    query !== "" ||
    statusFilter !== "all" ||
    minDaysInactive !== "" ||
    lastCallFrom !== "" ||
    lastCallTo !== "";

  function applyWeekPreset(weeksAgo: number) {
    const { from, to } = getWeekRange(weeksAgo);
    setLastCallFrom(from);
    setLastCallTo(to);
  }

  const thisWeek = getWeekRange(0);
  const lastWeek = getWeekRange(1);
  const isThisWeek = lastCallFrom === thisWeek.from && lastCallTo === thisWeek.to;
  const isLastWeek = lastCallFrom === lastWeek.from && lastCallTo === lastWeek.to;

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setMinDaysInactive("");
    setLastCallFrom("");
    setLastCallTo("");
  }

  function toggleStatCard(value: string) {
    setStatusFilter((prev) => (prev === value ? "all" : value));
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={Users}
          label="Total de mentorados"
          value={counts.total}
          tone="bg-muted text-foreground"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <StatCard
          icon={CheckCircle2}
          label="Ativos"
          value={counts.active}
          tone="bg-success/15 text-success"
          active={statusFilter === "active"}
          onClick={() => toggleStatCard("active")}
        />
        <StatCard
          icon={CalendarX2}
          label="Vencidos"
          value={counts.expired}
          tone="bg-destructive/15 text-destructive"
          active={statusFilter === "expired"}
          onClick={() => toggleStatCard("expired")}
        />
        <StatCard
          icon={Flame}
          label="Frequentes"
          value={counts.frequent}
          tone="bg-primary/10 text-primary"
          active={statusFilter === "frequent"}
          onClick={() => toggleStatCard("frequent")}
        />
        <StatCard
          icon={MoonStar}
          label="Inativos"
          value={counts.inactive}
          tone="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          active={statusFilter === "inactive"}
          onClick={() => toggleStatCard("inactive")}
        />
        <StatCard
          icon={AlertTriangle}
          label="Pendentes de confirmação"
          value={counts.pending}
          tone="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          active={statusFilter === "pending"}
          onClick={() => toggleStatCard("pending")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)} items={STATUS_ITEMS}>
          <SelectTrigger className="w-40">
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
        <Input
          type="number"
          min={0}
          value={minDaysInactive}
          onChange={(e) => setMinDaysInactive(e.target.value)}
          placeholder="Sem marcar há X+ dias"
          className="w-44"
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
            <X className="size-3.5" /> Limpar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Última chamada:</span>
        <Input
          type="date"
          value={lastCallFrom}
          onChange={(e) => setLastCallFrom(e.target.value)}
          className="w-40"
        />
        <span className="text-sm text-muted-foreground">até</span>
        <Input type="date" value={lastCallTo} onChange={(e) => setLastCallTo(e.target.value)} className="w-40" />
        <Button
          type="button"
          variant={isThisWeek ? "default" : "outline"}
          size="sm"
          onClick={() => applyWeekPreset(0)}
        >
          Esta semana
        </Button>
        <Button
          type="button"
          variant={isLastWeek ? "default" : "outline"}
          size="sm"
          onClick={() => applyWeekPreset(1)}
        >
          Semana passada
        </Button>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Mentorados ({filtered.length})
        </h2>
        {filtered.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="Nada encontrado"
            description="Tente ajustar a busca ou os filtros."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{m.fullName || m.email}</p>
                    <Badge variant={m.isExpired ? "destructive" : "outline"}>
                      {m.isExpired ? "Vencido" : "Ativo"}
                    </Badge>
                    {isFrequent(m) && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        <Flame className="size-3" /> Frequente
                      </span>
                    )}
                    {isInactive(m) && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <MoonStar className="size-3" /> Inativo
                      </span>
                    )}
                    {m.pendingCount > 0 && (
                      <span
                        className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                        title="Chamada já passou mas o mentor ainda não marcou se compareceu"
                      >
                        <AlertTriangle className="size-3" />
                        {m.pendingCount > 1 ? `Pendente (${m.pendingCount})` : "Pendente"}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {m.email}
                    {m.planName ? ` · ${m.planName}` : ""}
                    {m.lastMentorName ? ` · com ${m.lastMentorName}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-4 text-right text-xs">
                  <div>
                    <p className="text-sm font-semibold">
                      {m.completedCalls}
                      {m.effectiveTotalCalls ? ` / ${m.effectiveTotalCalls}` : ""}
                    </p>
                    <p className="text-muted-foreground">chamadas</p>
                  </div>
                  {m.attendanceRate !== null && (
                    <div>
                      <p className="text-sm font-semibold">{m.attendanceRate}%</p>
                      <p className="text-muted-foreground">comparecimento</p>
                    </div>
                  )}
                  <div>
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        isInactive(m) && "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {lastCallLabel(m)}
                    </p>
                    <p className="text-muted-foreground">última chamada</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
