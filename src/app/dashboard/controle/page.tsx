import { ControleView, type MentorWithPayments } from "@/components/dashboard/controle-view";
import { requireMentor } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, MentorPayment, Profile } from "@/lib/types";
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

  const [{ data: mentors }, { data: payments }, { data: bookings }] = await Promise.all([
    admin.from("profiles").select("*").order("full_name"),
    admin.from("mentor_payments").select("*").order("paid_through", { ascending: false }),
    admin.from("bookings").select("*").eq("status", "concluida"),
  ]);

  const mentorList = (mentors as Profile[]) ?? [];
  const paymentList = (payments as MentorPayment[]) ?? [];
  const completedBookings = (bookings as Booking[]) ?? [];

  const paymentsByMentor = new Map<string, MentorPayment[]>();
  for (const payment of paymentList) {
    const list = paymentsByMentor.get(payment.mentor_id) ?? [];
    list.push(payment);
    paymentsByMentor.set(payment.mentor_id, list);
  }

  const mentorsWithPayments: MentorWithPayments[] = mentorList.map((mentor) => {
    const mentorPayments = paymentsByMentor.get(mentor.id) ?? [];
    // Já vem ordenado por paid_through desc — o primeiro é o pagamento mais recente.
    const lastPaidThrough = mentorPayments[0]?.paid_through ?? null;

    const unpaidCalls = completedBookings.filter((b) => {
      if (b.mentor_id !== mentor.id) return false;
      if (!lastPaidThrough) return true;
      return b.starts_at.slice(0, 10) > lastPaidThrough;
    }).length;

    const amountOwed = mentor.rate_per_call ? unpaidCalls * mentor.rate_per_call : null;

    return {
      ...mentor,
      payments: mentorPayments,
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
          calcula sozinho quantas chamadas concluídas ainda não foram pagas.
        </p>
      </div>

      <ControleView mentors={mentorsWithPayments} />
    </div>
  );
}
