import { notFound } from "next/navigation";
import { requireMentor } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, MentorDiscordCall, Profile } from "@/lib/types";
import { formatDateTime, formatFullDate } from "@/lib/format";
import { PrintButton } from "@/components/dashboard/print-button";
import { ShieldAlert } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type ReportEntry =
  | { kind: "individual"; id: string; date: string; menteeName: string; menteeEmail: string }
  | { kind: "discord"; id: string; date: string; quantity: number; notes: string | null };

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fora de /dashboard de propósito — não herda o shell (sidebar/topbar) do
 * painel, só assim dá pra imprimir uma folha limpa. Cores fixas (não os
 * tokens do tema), porque o app inteiro é escuro mas o relatório precisa
 * imprimir em papel branco normal.
 */
export default async function ControleRelatorioPage({
  params,
  searchParams,
}: {
  params: Promise<{ mentorId: string }>;
  searchParams: Promise<{ after?: string; before?: string }>;
}) {
  const { profile } = await requireMentor();

  if (!profile.is_admin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="size-8 text-neutral-400" />
        <p className="text-sm font-medium text-neutral-900">Acesso restrito</p>
        <p className="text-sm text-neutral-500">Só administradores podem ver esse relatório.</p>
      </div>
    );
  }

  const { mentorId } = await params;
  const { after, before } = await searchParams;
  const untilDate = before || todayKey();

  const admin = createAdminClient();
  const [{ data: mentor }, { data: bookings }, { data: discordCalls }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", mentorId).maybeSingle(),
    admin.from("bookings").select("*").eq("mentor_id", mentorId).eq("status", "concluida"),
    admin.from("mentor_discord_calls").select("*").eq("mentor_id", mentorId),
  ]);

  if (!mentor) notFound();

  const mentorProfile = mentor as Profile;

  const filteredBookings = ((bookings as Booking[]) ?? [])
    .filter((b) => {
      const day = b.starts_at.slice(0, 10);
      if (after && day <= after) return false;
      return day <= untilDate;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const filteredDiscordCalls = ((discordCalls as MentorDiscordCall[]) ?? [])
    .filter((c) => {
      if (!c.completed) return false;
      if (after && c.call_date <= after) return false;
      return c.call_date <= untilDate;
    })
    .sort((a, b) => a.call_date.localeCompare(b.call_date));

  const entries: ReportEntry[] = [
    ...filteredBookings.map((b) => ({
      kind: "individual" as const,
      id: b.id,
      date: b.starts_at,
      menteeName: b.mentee_name,
      menteeEmail: b.mentee_email,
    })),
    ...filteredDiscordCalls.map((c) => ({
      kind: "discord" as const,
      id: c.id,
      date: c.call_date,
      quantity: c.quantity,
      notes: c.notes,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const totalIndividual = filteredBookings.length;
  const totalDiscord = filteredDiscordCalls.reduce((sum, c) => sum + c.quantity, 0);
  const totalCalls = totalIndividual + totalDiscord;
  const amount = mentorProfile.rate_per_call ? totalCalls * mentorProfile.rate_per_call : null;

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-white px-8 py-10 font-sans text-neutral-900 print:min-h-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-500">Pré-visualização — use o botão pra salvar como PDF.</p>
        <PrintButton />
      </div>

      <div className="mt-8 space-y-1 border-b border-neutral-200 pb-4 print:mt-0">
        <h1 className="text-xl font-semibold">
          Relatório de chamadas · {mentorProfile.full_name || mentorProfile.slug}
        </h1>
        <p className="text-sm text-neutral-600">
          Período: {after ? `de ${formatFullDate(new Date(`${after}T12:00:00Z`), "UTC")} até ` : "até "}
          {formatFullDate(new Date(`${untilDate}T12:00:00Z`), "UTC")}
        </p>
        <p className="text-xs text-neutral-400">Gerado em {formatDateTime(new Date(), "America/Sao_Paulo")}</p>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs tracking-wide text-neutral-500 uppercase">
            <th className="py-2 pr-2">Data</th>
            <th className="py-2 pr-2">Mentorado</th>
            <th className="py-2 pr-2">E-mail</th>
            <th className="py-2 text-right">Qtd</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.kind}-${entry.id}`} className="border-b border-neutral-100">
              <td className="py-2 pr-2 whitespace-nowrap">
                {entry.kind === "individual"
                  ? formatDateTime(new Date(entry.date), "America/Sao_Paulo")
                  : formatFullDate(new Date(`${entry.date}T12:00:00Z`), "UTC")}
              </td>
              <td className="py-2 pr-2">
                {entry.kind === "individual"
                  ? entry.menteeName
                  : `Chamada em grupo (Discord)${entry.notes ? ` — ${entry.notes}` : ""}`}
              </td>
              <td className="py-2 pr-2 text-neutral-600">
                {entry.kind === "individual" ? entry.menteeEmail : "—"}
              </td>
              <td className="py-2 text-right">{entry.kind === "individual" ? 1 : entry.quantity}</td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-neutral-400">
                Nenhuma chamada nesse período.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-6 flex items-center justify-between border-t border-neutral-300 pt-4 text-sm font-medium">
        <span>
          {totalCalls} chamada{totalCalls === 1 ? "" : "s"} no total ({totalIndividual} individua
          {totalIndividual === 1 ? "l" : "is"} + {totalDiscord} Discord)
        </span>
        {amount !== null && <span>{currencyFormatter.format(amount)}</span>}
      </div>
    </div>
  );
}
