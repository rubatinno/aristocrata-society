"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  addMyDiscordCall,
  deleteMyDiscordCall,
  updateMyDiscordCall,
} from "@/app/dashboard/discord/actions";
import type { MentorDiscordCall } from "@/lib/types";
import { formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BadgeCheck, CircleDashed, Loader2, MessageCircle, Plus, Trash2 } from "lucide-react";

function todayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const STATUS_ITEMS = { sim: "Realizada", nao: "Não realizada" };

function StatusSelect({ completed, onChange }: { completed: boolean; onChange: (next: boolean) => void }) {
  return (
    <Select
      value={completed ? "sim" : "nao"}
      onValueChange={(v) => v && onChange(v === "sim")}
      items={STATUS_ITEMS}
    >
      <SelectTrigger
        className={cn(
          "h-9 w-40 shrink-0 text-xs font-medium",
          completed
            ? "border-success/40 bg-success/15 text-success"
            : "border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_ITEMS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DiscordCallsView({ initialCalls }: { initialCalls: MentorDiscordCall[] }) {
  const [calls, setCalls] = useState(initialCalls);
  const [dateInput, setDateInput] = useState(todayKey());
  const [completedInput, setCompletedInput] = useState(true);
  const [notesInput, setNotesInput] = useState("");
  const [isCreating, startCreating] = useTransition();

  function handleCreate() {
    startCreating(async () => {
      try {
        const call = await addMyDiscordCall({
          callDate: dateInput,
          completed: completedInput,
          notes: notesInput,
        });
        setCalls((prev) => (prev.some((c) => c.id === call.id) ? prev : [call, ...prev]));
        setDateInput(todayKey());
        setCompletedInput(true);
        setNotesInput("");
        toast.success("Chamada registrada.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível registrar.");
      }
    });
  }

  function patchCall(id: string, patch: Partial<MentorDiscordCall>) {
    setCalls((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function handleDelete(id: string) {
    setCalls((prev) => prev.filter((c) => c.id !== id));
    deleteMyDiscordCall(id).catch(() => toast.error("Não foi possível remover a chamada."));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Nova chamada</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Data da chamada</Label>
            <Input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Aconteceu?</Label>
            <StatusSelect completed={completedInput} onChange={setCompletedInput} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Observação (opcional)</Label>
          <Input
            placeholder="Ex: Chamada de terça sobre tráfego pago"
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
          />
        </div>
        <Button type="button" onClick={handleCreate} disabled={isCreating} className="gap-1.5">
          {isCreating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Registrar chamada
        </Button>
      </div>

      {calls.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
          <MessageCircle className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nenhuma chamada registrada ainda</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Registre suas chamadas em grupo do Discord aqui pra elas contarem no fechamento.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <DiscordCallRow key={call.id} call={call} onPatch={patchCall} onDelete={() => handleDelete(call.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiscordCallRow({
  call,
  onPatch,
  onDelete,
}: {
  call: MentorDiscordCall;
  onPatch: (id: string, patch: Partial<MentorDiscordCall>) => void;
  onDelete: () => void;
}) {
  function handleStatusChange(nextCompleted: boolean) {
    onPatch(call.id, { completed: nextCompleted });
    updateMyDiscordCall(call.id, { completed: nextCompleted }).catch(() => {
      toast.error("Não foi possível atualizar.");
      onPatch(call.id, { completed: call.completed });
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {call.completed ? (
            <BadgeCheck className="size-4 shrink-0 text-success" />
          ) : (
            <CircleDashed className="size-4 shrink-0 text-destructive" />
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {formatFullDate(new Date(`${call.call_date}T12:00:00Z`), "UTC")}
            {call.quantity > 1 ? ` · ${call.quantity} chamadas` : ""}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          title="Remover"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <StatusSelect completed={call.completed} onChange={handleStatusChange} />
        {call.notes && <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{call.notes}</span>}
      </div>
    </div>
  );
}
