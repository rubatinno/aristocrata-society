"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMentorPayment,
  deleteMentorPayment,
  setMentorRate,
} from "@/app/dashboard/controle/actions";
import type { MentorPayment, Profile } from "@/lib/types";
import { formatFullDate } from "@/lib/format";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type MentorWithPayments = Profile & {
  payments: MentorPayment[];
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

export function ControleView({ mentors }: { mentors: MentorWithPayments[] }) {
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
        <MentorPaymentCard key={mentor.id} mentor={mentor} />
      ))}
    </div>
  );
}

function MentorPaymentCard({ mentor }: { mentor: MentorWithPayments }) {
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
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{mentor.unpaidCalls}</span> chamada
          {mentor.unpaidCalls === 1 ? "" : "s"} concluída{mentor.unpaidCalls === 1 ? "" : "s"} não paga
          {mentor.unpaidCalls === 1 ? "" : "s"}
        </span>
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
        {mentor.payments.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((v) => !v)}
            className="gap-1.5 text-muted-foreground"
          >
            {showHistory ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            Histórico ({mentor.payments.length})
          </Button>
        )}
      </div>

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
          {mentor.payments.map((payment) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
