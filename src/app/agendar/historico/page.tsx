import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { CalendarClock, History } from "lucide-react";
import { getMenteeSession } from "@/app/agendar/mentee-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatFullDate } from "@/lib/format";
import type { Booking, BookingStatus, Plan, Profile } from "@/lib/types";

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmada: "Confirmada",
  concluida: "Concluída",
  cancelada: "Cancelada",
  no_show: "Não compareceu",
};

const STATUS_VARIANT: Record<BookingStatus, "default" | "outline" | "destructive" | "secondary"> = {
  confirmada: "default",
  concluida: "outline",
  cancelada: "destructive",
  no_show: "secondary",
};

export default async function MenteeHistoricoPage() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const session = await getMenteeSession();
  if (!session) {
    redirect("/login?next=/agendar/historico");
  }

  const admin = createAdminClient();

  const [{ data: bookingsData }, { data: approval }] = await Promise.all([
    admin
      .from("bookings")
      .select("*")
      .eq("mentee_id", session.userId)
      .order("starts_at", { ascending: false }),
    admin.from("approved_mentees").select("*").eq("email", session.email).maybeSingle(),
  ]);

  const bookings = (bookingsData as Booking[]) ?? [];

  const mentorIds = Array.from(new Set(bookings.map((b) => b.mentor_id)));
  const mentorNames = new Map<string, string>();
  if (mentorIds.length > 0) {
    const { data: mentors } = await admin.from("profiles").select("id, full_name").in("id", mentorIds);
    for (const m of (mentors as Pick<Profile, "id" | "full_name">[]) ?? []) {
      mentorNames.set(m.id, m.full_name);
    }
  }

  let plan: Plan | null = null;
  if (approval?.plan_id) {
    const { data } = await admin.from("plans").select("*").eq("id", approval.plan_id).maybeSingle();
    plan = data;
  }

  const effectiveDurationDays = approval?.duration_days_override ?? plan?.duration_days ?? null;
  const effectiveTotalCalls = approval?.total_calls_override ?? plan?.total_calls ?? null;

  const expiresAt =
    approval && effectiveDurationDays
      ? addDays(new Date(`${approval.starts_at}T00:00:00`), effectiveDurationDays)
      : null;

  const completedCount = bookings.filter((b) => b.status === "concluida").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suas mentorias realizadas e o status do seu acesso.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarClock className="size-4 text-primary" />
          Seu acesso
        </div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Plano</dt>
            <dd className="font-medium">{plan?.name ?? "Sem plano (padrão)"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Chamadas realizadas</dt>
            <dd className="font-medium">
              {completedCount}
              {effectiveTotalCalls ? ` / ${effectiveTotalCalls}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Acesso válido até</dt>
            <dd className="font-medium">{expiresAt ? formatFullDate(expiresAt, "UTC") : "Sem prazo definido"}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Chamadas</h2>
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
            <History className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma mentoria realizada ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {mentorNames.get(booking.mentor_id) ?? "Mentor"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(new Date(booking.starts_at), "America/Sao_Paulo")}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
