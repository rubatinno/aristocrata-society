import { ControleView, type MentorWithPayments } from "@/components/dashboard/controle-view";
import { requireMentor } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, MentorDiscordCall, MentorPayment, Profile } from "@/lib/types";
import { ShieldAlert } from "lucide-react";

export default async function ControlePage() {
  const { profile } = await requireMentor();

  if (!profile.is_admin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Só administradores podem ver o controle de pagamentos.</p>
      </div>
    );
  }

  const admin = createAdminClient();

  const [{ data: mentors }, { data: payments }, { data: bookings }, { data: discordCalls }] =
    await Promise.all([
      admin.from("profiles").select("*").order("full_name"),
      admin.from("mentor_payments").select("*").order("paid_through", { ascending: false }),
      admin.from("bookings").select("*").eq("status", "concluida"),
      admin.from("mentor_discord_calls").select("*").order("call_date", { ascending: false }),
    ]);

  const mentorList = (mentors as Profile[]) ?? [];
  const paymentList = (payments as MentorPayment[]) ?? [];
  const completedBookings = (bookings as Booking[]) ?? [];
  const discordCallList = (discordCalls as MentorDiscordCall[]) ?? [];

  const paymentsByMentor = new Map<string, MentorPayment[]>();
  for (const payment of paymentList) {
    const list = paymentsByMentor.get(payment.mentor_id) ?? [];
    list.push(payment);
    paymentsByMentor.set(payment.mentor_id, list);
  }

  const discordCallsByMentor = new Map<string, MentorDiscordCall[]>();
  for (const call of discordCallList) {
    const list = discordCallsByMentor.get(call.mentor_id) ?? [];
    list.push(call);
    discordCallsByMentor.set(call.mentor_id, list);
  }

  const mentorsWithPayments: MentorWithPayments[] = mentorList.map((mentor) => {
    const mentorPayments = paymentsByMentor.get(mentor.id) ?? [];
    const mentorDiscordCalls = discordCallsByMentor.get(mentor.id) ?? [];
    // Já vem ordenado por paid_through desc — o primeiro é o pagamento mais recente.
    const lastPaidThrough = mentorPayments[0]?.paid_through ?? null;

    const unpaidBookings = completedBookings.filter((b) => {
      if (b.mentor_id !== mentor.id) return false;
      if (!lastPaidThrough) return true;
      return b.starts_at.slice(0, 10) > lastPaidThrough;
    });

    // Chamadas em grupo no Discord contam junto — mesmo valor por chamada,
    // mesmo corte por data de pagamento.
    const unpaidDiscordCallsList = mentorDiscordCalls.filter(
      (c) => !lastPaidThrough || c.call_date > lastPaidThrough,
    );

    const unpaidIndividualCalls = unpaidBookings.length;
    // Soma `quantity`, não a quantidade de linhas — uma linha pode
    // representar várias chamadas de uma vez (backfill de um período que
    // não foi marcado dia a dia).
    const unpaidDiscordCalls = unpaidDiscordCallsList.reduce((sum, c) => sum + c.quantity, 0);

    const unpaidCalls = unpaidIndividualCalls + unpaidDiscordCalls;
    const amountOwed = mentor.rate_per_call ? unpaidCalls * mentor.rate_per_call : null;

    return {
      ...mentor,
      payments: mentorPayments,
      discordCalls: mentorDiscordCalls,
      unpaidBookings,
      unpaidDiscordCallsList,
      unpaidIndividualCalls,
      unpaidDiscordCalls,
      unpaidCalls,
      amountOwed,
      lastPaidThrough,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Controle</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina o valor por chamada de cada mentor e registre os pagamentos já feitos — o sistema
          calcula sozinho quantas chamadas concluídas (individuais + Discord) ainda não foram pagas.
        </p>
      </div>

      <ControleView mentors={mentorsWithPayments} />
    </div>
  );
}
