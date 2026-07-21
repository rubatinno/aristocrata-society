import { AgendaView } from "@/components/dashboard/agenda-view";
import { requireMentor } from "@/lib/session";
import { listBookings } from "@/lib/dashboard-data";

export default async function AgendaPage() {
  const { supabase, profile } = await requireMentor();
  const bookings = await listBookings(supabase, profile.id);
  const now = new Date();

  const emails = Array.from(new Set(bookings.map((b) => b.mentee_email)));
  const groupLinkByEmail = new Map<string, string>();
  if (emails.length > 0) {
    const { data: mentees } = await supabase
      .from("approved_mentees")
      .select("email, group_link")
      .in("email", emails);

    for (const mentee of mentees ?? []) {
      if (mentee.group_link) groupLinkByEmail.set(mentee.email, mentee.group_link);
    }
  }

  const upcoming = bookings.filter((b) => b.status === "confirmada" && new Date(b.starts_at) >= now);
  // Já passou do horário e o mentor ainda não disse se rolou ou não — fica
  // separado do histórico até alguém resolver, com os botões de ação ainda
  // disponíveis (no histórico normal eles somem, de propósito).
  const pending = bookings
    .filter((b) => b.status === "confirmada" && new Date(b.starts_at) < now)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  const past = bookings
    .filter((b) => b.status === "concluida" || b.status === "no_show")
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

      <AgendaView
        upcoming={upcoming}
        pending={pending}
        past={past}
        cancelled={cancelled}
        timeZone={profile.timezone}
        groupLinkByEmail={Object.fromEntries(groupLinkByEmail)}
      />
    </div>
  );
}
