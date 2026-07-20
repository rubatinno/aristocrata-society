"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveAs,
  inviteAs,
  rejectMentee,
  removeMentee,
  updateMenteePlan,
  type InviteFormState,
} from "@/app/dashboard/aprovacoes/actions";
import type { ApprovedMentee, MemberRole, Plan } from "@/lib/types";
import { Check, Loader2, Trash2, UserPlus, X } from "lucide-react";

const NO_PLAN = "none";
const STATUS_ORDER = { pending: 0, approved: 1, rejected: 2 } as const;
const ROLE_LABELS: Record<MemberRole, string> = {
  mentee: "Mentorado",
  mentor: "Mentor",
  admin: "Admin",
};

const inviteInitialState: InviteFormState = { status: "idle" };

export function MenteesManager({
  mentees,
  plans,
}: {
  mentees: (ApprovedMentee & { plan: Plan | null })[];
  plans: Plan[];
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteAs, inviteInitialState);
  const sorted = [...mentees].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <div className="space-y-6">
      <form
        action={inviteAction}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4"
      >
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="invite_email" className="text-xs">
            Convidar por e-mail
          </Label>
          <Input
            id="invite_email"
            name="email"
            type="email"
            placeholder="pessoa@exemplo.com"
            required
          />
        </div>
        <div className="w-40 space-y-1.5">
          <Label htmlFor="invite_role" className="text-xs">
            Papel
          </Label>
          <Select name="role" defaultValue="mentor" items={{ mentor: "Mentor", admin: "Admin" }}>
            <SelectTrigger id="invite_role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mentor">Mentor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={invitePending} className="gap-1.5">
          {invitePending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Convidar
        </Button>
        {inviteState.status !== "idle" && (
          <p
            className={`w-full text-xs ${inviteState.status === "error" ? "text-destructive" : "text-success"}`}
          >
            {inviteState.message}
          </p>
        )}
      </form>

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Nenhum pedido ainda. Assim que alguém se cadastrar, aparece aqui.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((mentee) => (
            <MenteeRow key={mentee.id} mentee={mentee} plans={plans} />
          ))}
        </div>
      )}
    </div>
  );
}

function MenteeRow({ mentee, plans }: { mentee: ApprovedMentee & { plan: Plan | null }; plans: Plan[] }) {
  const [approvingRole, setApprovingRole] = useState<MemberRole | null>(null);
  const [isApproving, startApproving] = useTransition();
  const [isRejecting, startRejecting] = useTransition();
  const [isRemoving, startRemoving] = useTransition();
  const [isUpdating, startUpdating] = useTransition();
  const busy = isApproving || isRejecting || isRemoving;

  function handleApprove(role: MemberRole) {
    setApprovingRole(role);
    startApproving(async () => {
      try {
        await approveAs(mentee.id, role);
        toast.success(`Aprovado como ${ROLE_LABELS[role].toLowerCase()}.`);
      } catch {
        toast.error("Não foi possível aprovar.");
      }
    });
  }

  function handleReject() {
    startRejecting(async () => {
      try {
        await rejectMentee(mentee.id);
        toast.success("Pedido recusado.");
      } catch {
        toast.error("Não foi possível recusar.");
      }
    });
  }

  function handleRemove() {
    startRemoving(async () => {
      try {
        await removeMentee(mentee.id);
        toast.success("Removido.");
      } catch {
        toast.error("Não foi possível remover.");
      }
    });
  }

  function handlePlanChange(value: string | null) {
    startUpdating(async () => {
      try {
        await updateMenteePlan(mentee.id, !value || value === NO_PLAN ? null : value);
        toast.success("Plano atualizado.");
      } catch {
        toast.error("Não foi possível atualizar o plano.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{mentee.email}</p>
        {(mentee.full_name || mentee.phone) && (
          <p className="truncate text-xs text-muted-foreground">
            {[mentee.full_name, mentee.phone].filter(Boolean).join(" · ")}
          </p>
        )}
        {!mentee.user_id && mentee.status === "approved" && (
          <p className="text-xs text-muted-foreground">Convidado — ainda não se cadastrou</p>
        )}
      </div>

      {mentee.status === "pending" && (
        <>
          <Badge variant="outline">Pendente</Badge>
          {(["mentee", "mentor", "admin"] as MemberRole[]).map((role) => (
            <Button
              key={role}
              size="sm"
              variant="outline"
              onClick={() => handleApprove(role)}
              disabled={busy}
              className="gap-1.5"
            >
              {isApproving && approvingRole === role ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {ROLE_LABELS[role]}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleReject}
            disabled={busy}
            aria-label="Recusar"
            className="text-muted-foreground hover:text-destructive"
          >
            {isRejecting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          </Button>
        </>
      )}

      {mentee.status === "approved" && mentee.role === "mentee" && (
        <Select
          items={{
            [NO_PLAN]: "Sem plano (1/semana)",
            ...Object.fromEntries(plans.map((plan) => [plan.id, plan.name])),
          }}
          value={mentee.plan_id ?? NO_PLAN}
          onValueChange={handlePlanChange}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Sem plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PLAN}>Sem plano (1/semana)</SelectItem>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {mentee.status === "approved" && mentee.role !== "mentee" && (
        <Badge variant="outline">{ROLE_LABELS[mentee.role ?? "mentor"]}</Badge>
      )}

      {mentee.status === "rejected" && <Badge variant="outline">Recusado</Badge>}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleRemove}
        disabled={busy}
        aria-label="Remover"
        className="text-muted-foreground hover:text-destructive"
      >
        {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  );
}
