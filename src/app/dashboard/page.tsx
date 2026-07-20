import Link from "next/link";
import { CalendarCheck2, CalendarClock, ExternalLink, ListChecks } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { BookingRow } from "@/components/dashboard/booking-row";
import { EmptyState } from "@/components/dashboard/empty-state";
import { requireMentor } from "@/lib/session";
import { computeStats, listBookings } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

export default async function DashboardOverviewPage() {
  const { supabase, profile } = await requireMentor();
  const bookings = await listBookings(supabase, profile.id);
  const { upcomingCount, completedCount, thisWeekCount, nextBookings } = computeStats(bookings);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const bookingUrl = `${appUrl}/agendar`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Olá, {profile.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui está um resumo das suas mentorias.
        </p>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Link de agendamento da Aristocrata Society</p>
            <p className="truncate text-sm text-muted-foreground">{bookingUrl}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Único para todos os mentores — o mentorado escolhe você na lista.
            </p>
          </div>
          <Link
            href="/agendar"
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            Visualizar <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarClock} label="Próximas calls" value={upcomingCount} />
        <StatCard icon={ListChecks} label="Nos próximos 7 dias" value={thisWeekCount} />
        <StatCard icon={CalendarCheck2} label="Calls concluídas" value={completedCount} accent="success" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Próximas calls</h2>
          <Link href="/dashboard/agenda" className="text-xs font-medium text-primary hover:underline">
            Ver agenda completa
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          {nextBookings.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nenhuma call agendada"
              description="Compartilhe seu link de agendamento para que seus mentorados marquem um horário."
            />
          ) : (
            nextBookings.map((booking) => (
              <BookingRow key={booking.id} booking={booking} timeZone={profile.timezone} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
