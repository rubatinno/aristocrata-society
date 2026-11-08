"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  approveAs,
  changeMemberRole,
  inviteAs,
  rejectMentee,
  removeMentee,
  updateMenteePlan,
  type InviteFormState,
} from "@/app/dashboard/aprovacoes/actions";
import type { ApprovedMentee, MemberRole, Plan } from "@/lib/types";
import { Check, Eye, Loader2, Trash2, UserPlus, X } from "lucide-react";
import { startViewAs } from "@/app/dashboard/view-as-actions";
import { isOwner } from "@/lib/owner";

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
          <Input id="invite_email" name="email" type="email" placeholder="pessoa@exemplo.com" required />
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

const STATUS_BADGE: Record<ApprovedMentee["status"], { label: string; className: string }> = {
  pending: {
    label: "Pendente",
    className: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  },
  approved: { label: "Aprovado", className: "border-success/40 text-success" },
  rejected: {
    label: "Reprovado",
    className: "border-destructive/40 text-destructive",
  },
};

function MenteeRow({ mentee, plans }: { mentee: ApprovedMentee & { plan: Plan | null }; plans: Plan[] }) {
  // Pendente/reprovado: o cargo escolhido aqui só vale quando clicar em
  // Aprovar. Aprovado: trocar o cargo aplica na hora (com confirmação).
  const [draftRole, setDraftRole] = useState<MemberRole>(mentee.role ?? "mentee");
  const [isApproving, startApproving] = useTransition();
  const [isRejecting, startRejecting] = useTransition();
  const [isRemoving, startRemoving] = useTransition();
  const [isUpdating, startUpdating] = useTransition();
  const [isChangingRole, startChangingRole] = useTransition();
  const [isOpeningView, startOpeningView] = useTransition();
  const busy = isApproving || isRejecting || isRemoving || isChangingRole || isOpeningView;
  const isApproved = mentee.status === "approved";
  const who = mentee.full_name || mentee.email;
  const shownRole = isApproved ? (mentee.role ?? "mentee") : draftRole;

  function handleRoleChange(value: string | null) {
    const role = value as MemberRole | null;
    if (!role) return;
    if (!isApproved) {
      setDraftRole(role);
      return;
    }
    if (role === mentee.role) return;
    const message =
      role === "admin"
        ? `Tornar ${who} administrador? Ele(a) vai ter acesso total ao painel: aprovações, equipe, financeiro.`
        : `Mudar o cargo de ${who} para ${ROLE_LABELS[role]}?`;
    if (!window.confirm(message)) return;

    startChangingRole(async () => {
      try {
        await changeMemberRole(mentee.id, role);
        toast.success(`Cargo alterado para ${ROLE_LABELS[role]}.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível mudar o cargo.");
      }
    });
  }

  function handleApprove() {
    if (
      draftRole === "admin" &&
      !window.confirm(`Aprovar ${who} como administrador? Ele(a) vai ter acesso total ao painel.`)
    ) {
      return;
    }
    startApproving(async () => {
      try {
        await approveAs(mentee.id, draftRole);
        toast.success(`Aprovado como ${ROLE_LABELS[draftRole].toLowerCase()}.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível aprovar.");
      }
    });
  }

  function handleReject() {
    if (isApproved && !window.confirm(`Reprovar ${who}? A pessoa perde o acesso agora.`)) return;
    startRejecting(async () => {
      try {
        await rejectMentee(mentee.id);
        toast.success("Reprovado.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível reprovar.");
      }
    });
  }

  function handleViewAs() {
    startOpeningView(async () => {
      try {
        // Redireciona por dentro (throw interno do Next) quando dá certo.
        await startViewAs(mentee.id);
      } catch (e) {
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        toast.error(e instanceof Error ? e.message : "Não foi possível abrir a visualização.");
      }
    });
  }

  function handleRemove() {
    if (!window.confirm(`Remover ${who} da lista? Se for mentorado, a conta de login também é apagada.`))
      return;
    startRemoving(async () => {
      try {
        await removeMentee(mentee.id);
        toast.success("Removido.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
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

  const badge = STATUS_BADGE[mentee.status];
  const owner = isOwner(mentee);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{mentee.email}</p>
          <Badge variant="outline" className={badge.className}>
            {badge.label}
          </Badge>
          {owner && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              Criador
            </Badge>
          )}
        </div>
        {(mentee.full_name || mentee.phone) && (
          <p className="truncate text-xs text-muted-foreground">
            {[mentee.full_name, mentee.phone].filter(Boolean).join(" · ")}
          </p>
        )}
        {!mentee.user_id && isApproved && !owner && (
          <p className="text-xs text-muted-foreground">Convidado — ainda não se cadastrou</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={ROLE_LABELS}
          value={owner ? "admin" : shownRole}
          onValueChange={handleRoleChange}
          disabled={busy || owner}
        >
          <SelectTrigger className="w-36" aria-label="Cargo">
            {isChangingRole && <Loader2 className="size-3.5 animate-spin" />}
            <SelectValue placeholder="Cargo" />
          </SelectTrigger>
          <SelectContent>
            {(["mentee", "mentor", "admin"] as MemberRole[]).map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isApproved && mentee.role === "mentee" && (
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

        {!isApproved && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleApprove}
            disabled={busy}
            className="gap-1.5 text-success"
          >
            {isApproving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Aprovar
          </Button>
        )}

        {mentee.status !== "rejected" && !owner && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            disabled={busy}
            className="gap-1.5 text-muted-foreground hover:text-destructive"
          >
            {isRejecting ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
            Reprovar
          </Button>
        )}

        {isApproved && mentee.user_id && !owner && (
          <Button size="sm" variant="outline" onClick={handleViewAs} disabled={busy} className="gap-1.5">
            {isOpeningView ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
            Ver como
          </Button>
        )}

        {!owner && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRemove}
            disabled={busy}
            aria-label="Remover"
            title="Remover"
            className="text-muted-foreground hover:text-destructive"
          >
            {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
