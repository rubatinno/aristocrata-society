import { AgendaView } from "@/components/dashboard/agenda-view";
import { requireMentor } from "@/lib/session";
import { listBookings } from "@/lib/dashboard-data";

export default async function AgendaPage() {
  const { supabase, profile } = await requireMentor();
  const bookings = await listBookings(supabase, profile.id);
  const now = new Date();

  const upcoming = bookings.filter((b) => b.status === "confirmada" && new Date(b.starts_at) >= now);
  const past = bookings
    .filter(
      (b) =>
        b.status === "concluida" ||
        b.status === "no_show" ||
        (b.status === "confirmada" && new Date(b.starts_at) < now),
    )
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  const cancelled = bookings
    .filter((b) => b.status === "cancelada")
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas as suas mentorias agendadas, realizadas e canceladas.
        </p>
      </div>

      <AgendaView upcoming={upcoming} past={past} cancelled={cancelled} timeZone={profile.timezone} />
    </div>
  );
}
