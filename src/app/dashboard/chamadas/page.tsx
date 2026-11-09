import { addDays, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { BookingRow } from "@/components/dashboard/booking-row";
import { ChamadasFilters } from "@/components/dashboard/chamadas-filters";
import { requireMentor } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatFullDate } from "@/lib/format";
import type { Booking, Profile } from "@/lib/types";
import { CalendarX2, ShieldAlert } from "lucide-react";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Chamadas Gerais — todas as calls de todos os mentores num dia, com filtro
 * por mentor. Só admin. O dia é contado no fuso do admin que está olhando.
 */
export default async function ChamadasGeraisPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; mentor?: string }>;
}) {
  const { profile, mentorModeActive } = await requireMentor();

  if (!profile.is_admin || mentorModeActive) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Só administradores podem ver as chamadas gerais.</p>
      </div>
    );
  }

  const timeZone = profile.timezone || "America/Sao_Paulo";
  const today = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
  const params = await searchParams;
  const dateKey = params.data && DATE_KEY.test(params.data) ? params.data : today;
  const mentorFilter = params.mentor || "";

  const dayStart = fromZonedTime(`${dateKey}T00:00:00`, timeZone);
  const nextKey = format(addDays(new Date(`${dateKey}T12:00:00Z`), 1), "yyyy-MM-dd");
  const dayEnd = fromZonedTime(`${nextKey}T00:00:00`, timeZone);

  // Service role: as policies de RLS só deixam cada mentor ler as próprias
  // calls; aqui o admin precisa ver as de todo mundo.
  const admin = createAdminClient();
  const [{ data: mentors }, { data: dayBookings }] = await Promise.all([
    admin.from("profiles").select("id, full_name").order("full_name"),
    admin
      .from("bookings")
      .select("*")
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at", { ascending: true }),
  ]);

  const mentorList = (mentors as Pick<Profile, "id" | "full_name">[]) ?? [];
  const mentorName = new Map(mentorList.map((m) => [m.id, m.full_name || "Sem nome"]));
  const allOfDay = (dayBookings as Booking[]) ?? [];

  // Contagem por mentor (sem as canceladas) — vira o "chip" de cada um no
  // filtro, pra bater o olho em quem está com mais calls no dia.
  const countByMentor: Record<string, number> = {};
  for (const b of allOfDay) {
    if (b.status !== "cancelada") countByMentor[b.mentor_id] = (countByMentor[b.mentor_id] ?? 0) + 1;
  }

  const bookings = mentorFilter ? allOfDay.filter((b) => b.mentor_id === mentorFilter) : allOfDay;
  const active = bookings.filter((b) => b.status !== "cancelada");
  const cancelled = bookings.filter((b) => b.status === "cancelada");
  const now = new Date();

  const stats = [
    { label: "Marcadas", value: active.length },
    { label: "A realizar", value: active.filter((b) => b.status === "confirmada" && new Date(b.starts_at) >= now).length },
    { label: "Realizadas", value: active.filter((b) => b.status === "concluida").length },
    { label: "Não compareceu", value: active.filter((b) => b.status === "no_show").length },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Chamadas Gerais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas as chamadas marcadas no dia, de todos os mentores. Horários no fuso{" "}
          <span className="font-medium text-foreground">{timeZone}</span>.
        </p>
      </div>

      <ChamadasFilters
        dateKey={dateKey}
        today={today}
        mentorId={mentorFilter}
        mentors={mentorList.map((m) => ({
          id: m.id,
          name: m.full_name || "Sem nome",
          count: countByMentor[m.id] ?? 0,
        }))}
        totalCount={Object.values(countByMentor).reduce((a, b) => a + b, 0)}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {formatFullDate(new Date(`${dateKey}T12:00:00Z`), "UTC")}
          {mentorFilter && mentorName.get(mentorFilter) ? ` · ${mentorName.get(mentorFilter)}` : ""}
        </h2>

        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
            <CalendarX2 className="size-6 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">Nenhuma chamada marcada nesse dia.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                timeZone={timeZone}
                mentorName={mentorName.get(b.mentor_id) ?? "Mentor removido"}
                pending={b.status === "confirmada" && new Date(b.starts_at) < now}
              />
            ))}
          </div>
        )}
      </section>

      {cancelled.length > 0 && (
        <section className="space-y-3 opacity-70">
          <h2 className="text-sm font-semibold text-muted-foreground">Canceladas ({cancelled.length})</h2>
          <div className="space-y-2">
            {cancelled.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                timeZone={timeZone}
                mentorName={mentorName.get(b.mentor_id) ?? "Mentor removido"}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
