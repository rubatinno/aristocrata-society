"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDiscordCall,
  addMentorPayment,
  deleteDiscordCall,
  deleteMentorPayment,
  setMentorRate,
} from "@/app/dashboard/controle/actions";
import { removeMentor } from "@/app/dashboard/equipe/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Booking, MentorDiscordCall, MentorPayment, Profile } from "@/lib/types";
import { formatDateTime, formatFullDate } from "@/lib/format";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileDown,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type MentorWithPayments = Profile & {
  payments: MentorPayment[];
  discordCalls: MentorDiscordCall[];
  unpaidBookings: Booking[];
  unpaidDiscordCallsList: MentorDiscordCall[];
  unpaidIndividualCalls: number;
  unpaidDiscordCalls: number;
  unpaidCalls: number;
  amountOwed: number | null;
  lastPaidThrough: string | null;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function ControleView({
  mentors,
  currentUserId,
}: {
  mentors: MentorWithPayments[];
  currentUserId: string;
}) {
  if (mentors.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Nenhum mentor cadastrado ainda.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {mentors.map((mentor) => (
        <MentorPaymentCard key={mentor.id} mentor={mentor} isSelf={mentor.id === currentUserId} />
      ))}
    </div>
  );
}

function MentorPaymentCard({ mentor, isSelf }: { mentor: MentorWithPayments; isSelf: boolean }) {
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(mentor.rate_per_call?.toString() ?? "");
  const [isSavingRate, startSavingRate] = useTransition();

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [paidThroughInput, setPaidThroughInput] = useState(todayKey());
  const [notesInput, setNotesInput] = useState("");
  const [isSavingPayment, startSavingPayment] = useTransition();

  const [showHistory, setShowHistory] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemoving, startRemoving] = useTransition();

  const [showDiscordForm, setShowDiscordForm] = useState(false);
  const [discordDateInput, setDiscordDateInput] = useState(todayKey());
  const [discordNotesInput, setDiscordNotesInput] = useState("");
  const [discordQuantityInput, setDiscordQuantityInput] = useState("1");
  const [isSavingDiscordCall, startSavingDiscordCall] = useTransition();

  const [showDiscordHistory, setShowDiscordHistory] = useState(false);
  const [removingDiscordId, setRemovingDiscordId] = useState<string | null>(null);
  const [isRemovingDiscord, startRemovingDiscord] = useTransition();

  const [showUnpaidDetail, setShowUnpaidDetail] = useState(false);
  const [isRemovingMentor, startRemovingMentor] = useTransition();

  function handleRemoveMentor() {
    if (
      !window.confirm(
        `Remover ${mentor.full_name || "esse mentor"} da equipe? Isso também apaga o histórico de mentorias dele(a). Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    startRemovingMentor(async () => {
      try {
        await removeMentor(mentor.id);
        toast.success("Mentor removido da equipe.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
      }
    });
  }

  function handleSaveRate() {
    const rate = rateInput.trim() === "" ? null : Number.parseFloat(rateInput);
    startSavingRate(async () => {
      try {
        await setMentorRate(mentor.id, rate);
        toast.success("Valor por chamada atualizado.");
        setEditingRate(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  function handleAddPayment() {
    const amount = Number.parseFloat(amountInput.replace(",", "."));
    startSavingPayment(async () => {
      try {
        await addMentorPayment(mentor.id, { amount, paidThrough: paidThroughInput, notes: notesInput });
        toast.success("Pagamento registrado.");
        setShowPaymentForm(false);
        setAmountInput("");
        setNotesInput("");
        setPaidThroughInput(todayKey());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível registrar.");
      }
    });
  }

  function handleRemovePayment(id: string) {
    setRemovingId(id);
    startRemoving(async () => {
      try {
        await deleteMentorPayment(id);
        toast.success("Pagamento removido.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
      } finally {
        setRemovingId(null);
      }
    });
  }

  function handleAddDiscordCall() {
    const quantity = Number.parseInt(discordQuantityInput, 10) || 1;
    startSavingDiscordCall(async () => {
      try {
        await addDiscordCall(mentor.id, { callDate: discordDateInput, notes: discordNotesInput, quantity });
        toast.success(quantity === 1 ? "Chamada do Discord registrada." : `${quantity} chamadas do Discord registradas.`);
        setDiscordNotesInput("");
        setDiscordDateInput(todayKey());
        setDiscordQuantityInput("1");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível registrar.");
      }
    });
  }

  function handleRemoveDiscordCall(id: string) {
    setRemovingDiscordId(id);
    startRemovingDiscord(async () => {
      try {
        await deleteDiscordCall(id);
        toast.success("Chamada removida.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
      } finally {
        setRemovingDiscordId(null);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{mentor.full_name || mentor.slug}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {mentor.lastPaidThrough
              ? `Pago até ${formatFullDate(new Date(`${mentor.lastPaidThrough}T12:00:00Z`), "UTC")}`
              : "Nenhum pagamento registrado ainda"}
          </p>
        </div>

        {editingRate ? (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="R$ por call"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              className="w-28"
            />
            <Button type="button" size="sm" onClick={handleSaveRate} disabled={isSavingRate} className="gap-1">
              {isSavingRate && <Loader2 className="size-3 animate-spin" />} Salvar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingRate(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingRate(true)}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3" />
            {mentor.rate_per_call ? `${formatCurrency(mentor.rate_per_call)} / call` : "Definir valor/call"}
          </button>
        )}
        {!isSelf && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleRemoveMentor}
            disabled={isRemovingMentor}
            title="Remover mentor da equipe"
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            {isRemovingMentor ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm">
        {mentor.unpaidCalls > 0 ? (
          <button
            type="button"
            onClick={() => setShowUnpaidDetail(true)}
            className="group flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <span className="font-semibold text-foreground">{mentor.unpaidCalls}</span> chamada
            {mentor.unpaidCalls === 1 ? "" : "s"} não paga{mentor.unpaidCalls === 1 ? "" : "s"}
            <span className="text-xs">
              ({mentor.unpaidIndividualCalls} individua{mentor.unpaidIndividualCalls === 1 ? "l" : "is"} + {mentor.unpaidDiscordCalls} Discord)
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">0</span> chamadas não pagas
          </span>
        )}
        {mentor.amountOwed !== null ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              mentor.amountOwed > 0 ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success",
            )}
          >
            {mentor.amountOwed > 0 ? `Deve ${formatCurrency(mentor.amountOwed)}` : "Em dia"}
          </span>
        ) : mentor.unpaidCalls > 0 ? (
          <span className="text-xs text-muted-foreground">Defina o valor por chamada pra calcular</span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => setShowPaymentForm((v) => !v)} className="gap-1.5">
          <Plus className="size-3.5" /> Registrar pagamento
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowDiscordForm((v) => !v)}
          className="gap-1.5"
        >
          <MessageCircle className="size-3.5" /> Registrar chamada Discord
        </Button>
        {mentor.payments.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((v) => !v)}
            className="gap-1.5 text-muted-foreground"
          >
            {showHistory ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            Pagamentos ({mentor.payments.length})
          </Button>
        )}
        {mentor.discordCalls.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowDiscordHistory((v) => !v)}
            className="gap-1.5 text-muted-foreground"
          >
            {showDiscordHistory ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            Chamadas Discord ({mentor.discordCalls.length})
          </Button>
        )}
      </div>

      {showDiscordForm && (
        <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Data da chamada</Label>
              <Input
                type="date"
                value={discordDateInput}
                onChange={(e) => setDiscordDateInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantidade (opcional)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="1"
                value={discordQuantityInput}
                onChange={(e) => setDiscordQuantityInput(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <p className="text-[11px] text-muted-foreground">
                Deixe 1 pra chamada avulsa, ou coloque quantas ele fez se for lançar um período de uma vez.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observação (opcional)</Label>
              <Input
                placeholder="Ex: Chamada de terça"
                value={discordNotesInput}
                onChange={(e) => setDiscordNotesInput(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddDiscordCall}
              disabled={isSavingDiscordCall}
              className="gap-1.5"
            >
              {isSavingDiscordCall && <Loader2 className="size-3.5 animate-spin" />} Salvar chamada
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowDiscordForm(false)}>
              Fechar
            </Button>
          </div>
        </div>
      )}

      {showDiscordHistory && mentor.discordCalls.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          {mentor.discordCalls.map((call) => (
            <div
              key={call.id}
              className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">
                  {formatFullDate(new Date(`${call.call_date}T12:00:00Z`), "UTC")}
                </span>
                {call.quantity > 1 ? (
                  <span className="text-muted-foreground"> · {call.quantity} chamadas</span>
                ) : null}
                {!call.completed && <span className="text-destructive"> · não realizada</span>}
                {call.notes ? <span className="text-muted-foreground"> · {call.notes}</span> : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRemoveDiscordCall(call.id)}
                disabled={isRemovingDiscord && removingDiscordId === call.id}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                {isRemovingDiscord && removingDiscordId === call.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {showPaymentForm && (
        <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Valor pago</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pago até a data</Label>
              <Input
                type="date"
                value={paidThroughInput}
                onChange={(e) => setPaidThroughInput(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observação (opcional)</Label>
            <Input
              placeholder="Ex: Pix referente a julho"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleAddPayment} disabled={isSavingPayment} className="gap-1.5">
              {isSavingPayment && <Loader2 className="size-3.5 animate-spin" />} Salvar pagamento
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowPaymentForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {showHistory && mentor.payments.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          {mentor.payments.map((payment, index) => {
            // Ordenado desc por paid_through — o próximo do array é o
            // pagamento anterior (mais antigo), que marca o início do
            // período coberto por este.
            const previousPaidThrough = mentor.payments[index + 1]?.paid_through;
            const reportHref = `/relatorio/controle/${mentor.id}?before=${payment.paid_through}${
              previousPaidThrough ? `&after=${previousPaidThrough}` : ""
            }`;
            return (
              <div
                key={payment.id}
                className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{formatCurrency(payment.amount)}</span>{" "}
                  <span className="text-muted-foreground">
                    · pago até {formatFullDate(new Date(`${payment.paid_through}T12:00:00Z`), "UTC")}
                    {payment.notes ? ` · ${payment.notes}` : ""}
                  </span>
                </div>
                <a
                  href={reportHref}
                  target="_blank"
                  rel="noreferrer"
                  title="Exportar PDF desse pagamento"
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <FileDown className="size-3.5" />
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemovePayment(payment.id)}
                  disabled={isRemoving && removingId === payment.id}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  {isRemoving && removingId === payment.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <UnpaidCallsDialog
        open={showUnpaidDetail}
        onOpenChange={setShowUnpaidDetail}
        mentor={mentor}
      />
    </div>
  );
}

type UnpaidEntry =
  | { kind: "individual"; id: string; date: string; menteeName: string; menteeEmail: string }
  | { kind: "discord"; id: string; date: string; quantity: number; notes: string | null };

/**
 * Lista detalhada de todas as chamadas não pagas — data, quem marcou (ou
 * "Discord" pras chamadas em grupo) — pro fechamento do mês com o mentor.
 * Ordenada cronologicamente, mais antiga primeiro, igual um extrato.
 */
function UnpaidCallsDialog({
  open,
  onOpenChange,
  mentor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentor: MentorWithPayments;
}) {
  const entries: UnpaidEntry[] = [
    ...mentor.unpaidBookings.map((b) => ({
      kind: "individual" as const,
      id: b.id,
      date: b.starts_at,
      menteeName: b.mentee_name,
      menteeEmail: b.mentee_email,
    })),
    ...mentor.unpaidDiscordCallsList.map((c) => ({
      kind: "discord" as const,
      id: c.id,
      date: c.call_date,
      quantity: c.quantity,
      notes: c.notes,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border p-4 pr-16">
          <DialogTitle>Chamadas não pagas · {mentor.full_name || mentor.slug}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {mentor.lastPaidThrough
              ? `Desde o pagamento até ${formatFullDate(new Date(`${mentor.lastPaidThrough}T12:00:00Z`), "UTC")}`
              : "Nenhum pagamento registrado ainda — todas as chamadas concluídas aparecem aqui"}
          </p>
        </DialogHeader>

        <div className="flex-1 space-y-1.5 overflow-y-auto p-4">
          {entries.map((entry) =>
            entry.kind === "individual" ? (
              <div
                key={`b-${entry.id}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2 text-sm"
              >
                <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{entry.menteeName}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Mail className="size-3 shrink-0" />
                    {entry.menteeEmail}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(new Date(entry.date), "America/Sao_Paulo")}
                </span>
              </div>
            ) : (
              <div
                key={`d-${entry.id}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm"
              >
                <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    Chamada em grupo (Discord)
                    {entry.quantity > 1 ? ` · ${entry.quantity} chamadas` : ""}
                  </p>
                  {entry.notes && <p className="truncate text-xs text-muted-foreground">{entry.notes}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFullDate(new Date(`${entry.date}T12:00:00Z`), "UTC")}
                </span>
              </div>
            ),
          )}
          {entries.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma chamada não paga.</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {mentor.unpaidCalls} chamada{mentor.unpaidCalls === 1 ? "" : "s"} no total
            </span>
            {mentor.amountOwed !== null && (
              <span className="font-semibold text-foreground">{formatCurrency(mentor.amountOwed)}</span>
            )}
          </div>
          <a
            href={`/relatorio/controle/${mentor.id}?before=${todayKey()}${
              mentor.lastPaidThrough ? `&after=${mentor.lastPaidThrough}` : ""
            }`}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <FileDown className="size-3.5" />
            Exportar PDF
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
