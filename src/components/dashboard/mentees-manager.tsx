"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
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
import { updateMenteeOverrides } from "@/app/dashboard/mentorados/actions";
import type { ApprovedMentee, MemberRole, Plan } from "@/lib/types";
import { CalendarDays, Check, Eye, Loader2, Pencil, Search, Trash2, UserPlus, X } from "lucide-react";
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

export type ManagedMentee = ApprovedMentee & {
  plan: Plan | null;
  usedCalls: number;
  totalCalls: number | null;
  endDate: string | null; // yyyy-MM-dd; null = sem data final
};

const EXPIRING_DAYS = 15;
const RECENT_DAYS = 30;

type FilterKey =
  | "all"
  | "active"
  | "expiring"
  | "expired"
  | "recent"
  | "pending"
  | "rejected"
  | "team";

const FILTERS: { key: FilterKey; label: string; hint: string }[] = [
  { key: "all", label: "Todos", hint: "Todo mundo da lista" },
  { key: "active", label: "Ativos", hint: "Mentorados aprovados, dentro do prazo e com calls sobrando" },
  { key: "expiring", label: "Expirando", hint: `Ativos que encerram nos próximos ${EXPIRING_DAYS} dias` },
  { key: "expired", label: "Expirados", hint: "Prazo encerrado ou calls esgotadas" },
  { key: "recent", label: "Recentes", hint: `Entraram nos últimos ${RECENT_DAYS} dias` },
  { key: "pending", label: "Pendentes", hint: "Aguardando aprovação" },
  { key: "rejected", label: "Reprovados", hint: "Sem acesso" },
  { key: "team", label: "Equipe", hint: "Mentores e admins" },
];

function isActiveMentee(m: ManagedMentee) {
  return m.status === "approved" && (m.role ?? "mentee") === "mentee";
}

function isExpired(m: ManagedMentee, today: string) {
  const outOfTime = m.endDate !== null && m.endDate < today;
  const outOfCalls = m.totalCalls !== null && m.usedCalls >= m.totalCalls;
  return outOfTime || outOfCalls;
}

function matchesFilter(m: ManagedMentee, filter: FilterKey, today: string) {
  const mentee = isActiveMentee(m);
  switch (filter) {
    case "all":
      return true;
    case "active":
      return mentee && !isExpired(m, today);
    case "expiring":
      return (
        mentee &&
        !isExpired(m, today) &&
        m.endDate !== null &&
        differenceInCalendarDays(parseISO(m.endDate), parseISO(today)) <= EXPIRING_DAYS
      );
    case "expired":
      return mentee && isExpired(m, today);
    case "recent":
      return mentee && differenceInCalendarDays(parseISO(today), parseISO(m.starts_at)) <= RECENT_DAYS;
    case "pending":
      return m.status === "pending";
    case "rejected":
      return m.status === "rejected";
    case "team":
      return m.status === "approved" && (m.role === "mentor" || m.role === "admin");
  }
}

function sortFor(filter: FilterKey) {
  if (filter === "expiring" || filter === "active")
    return (a: ManagedMentee, b: ManagedMentee) => (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999");
  if (filter === "recent" || filter === "expired")
    return (a: ManagedMentee, b: ManagedMentee) =>
      filter === "recent"
        ? b.starts_at.localeCompare(a.starts_at)
        : (b.endDate ?? "").localeCompare(a.endDate ?? "");
  return (a: ManagedMentee, b: ManagedMentee) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
}

function fmtDate(value: string) {
  return format(parseISO(value), "dd/MM/yyyy");
}

export function MenteesManager({
  mentees,
  plans,
  today,
}: {
  mentees: ManagedMentee[];
  plans: Plan[];
  today: string; // yyyy-MM-dd (São Paulo)
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteAs, inviteInitialState);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.key, mentees.filter((m) => matchesFilter(m, f.key, today)).length]),
      ) as Record<FilterKey, number>,
    [mentees, today],
  );

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mentees
      .filter((m) => matchesFilter(m, filter, today))
      .filter(
        (m) =>
          !q ||
          [m.email, m.full_name, m.phone].some((v) => v?.toLowerCase().includes(q)),
      )
      .sort(sortFor(filter));
  }, [mentees, filter, query, today]);

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

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const selected = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                title={f.hint}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                <span className={selected ? "opacity-80" : "opacity-60"}>{counts[f.key]}</span>
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone"
            className="pl-9"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {mentees.length === 0
            ? "Nenhum pedido ainda. Assim que alguém se cadastrar, aparece aqui."
            : "Ninguém nesse filtro."}
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((mentee) => (
            <MenteeRow key={mentee.id} mentee={mentee} plans={plans} today={today} />
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

function MenteeRow({ mentee, plans, today }: { mentee: ManagedMentee; plans: Plan[]; today: string }) {
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
  const showTerms = isApproved && (mentee.role ?? "mentee") === "mentee";
  const [editingTerms, setEditingTerms] = useState(false);

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
        {showTerms && <TermsSummary mentee={mentee} today={today} />}
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

        {showTerms && (
          <Button
            size="sm"
            variant={editingTerms ? "secondary" : "outline"}
            onClick={() => setEditingTerms((v) => !v)}
            disabled={busy}
            className="gap-1.5"
          >
            <Pencil className="size-3.5" />
            Editar
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

      {showTerms && editingTerms && (
        <TermsEditor mentee={mentee} onDone={() => setEditingTerms(false)} />
      )}
    </div>
  );
}

function TermsSummary({ mentee, today }: { mentee: ManagedMentee; today: string }) {
  const daysLeft = mentee.endDate
    ? differenceInCalendarDays(parseISO(mentee.endDate), parseISO(today))
    : null;
  const outOfCalls = mentee.totalCalls !== null && mentee.usedCalls >= mentee.totalCalls;

  let endLabel = "sem data final";
  let endClass = "";
  if (mentee.endDate && daysLeft !== null) {
    if (daysLeft < 0) {
      endLabel = `encerrou em ${fmtDate(mentee.endDate)}`;
      endClass = "text-destructive";
    } else {
      endLabel = `encerra ${fmtDate(mentee.endDate)} (${daysLeft === 0 ? "hoje" : `${daysLeft} dia${daysLeft === 1 ? "" : "s"}`})`;
      if (daysLeft <= EXPIRING_DAYS) endClass = "text-amber-600 dark:text-amber-400";
    }
  }

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <CalendarDays className="size-3.5" />
      <span>entrou {fmtDate(mentee.starts_at)}</span>
      <span>·</span>
      <span className={endClass}>{endLabel}</span>
      <span>·</span>
      <span className={outOfCalls ? "text-destructive" : ""}>
        {mentee.totalCalls !== null
          ? `${mentee.usedCalls}/${mentee.totalCalls} calls`
          : `${mentee.usedCalls} call${mentee.usedCalls === 1 ? "" : "s"} (sem limite total)`}
      </span>
    </p>
  );
}

function TermsEditor({ mentee, onDone }: { mentee: ManagedMentee; onDone: () => void }) {
  const [startDate, setStartDate] = useState(mentee.starts_at);
  const [endDate, setEndDate] = useState(mentee.endDate ?? "");
  const [totalCalls, setTotalCalls] = useState(mentee.totalCalls?.toString() ?? "");
  const [isSaving, startSaving] = useTransition();

  const planDuration = mentee.plan?.duration_days ?? null;
  const planCalls = mentee.plan?.total_calls ?? null;

  function handleStartChange(value: string) {
    // Mantém a mesma duração ao mudar a entrada (o encerramento anda junto).
    if (value && startDate && endDate) {
      const span = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
      setEndDate(format(addDays(parseISO(value), span), "yyyy-MM-dd"));
    }
    setStartDate(value);
  }

  function handleSave() {
    if (!startDate) {
      toast.error("Informe a data de entrada.");
      return;
    }
    let durationDays: number | null = null;
    if (endDate) {
      durationDays = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
      if (durationDays <= 0) {
        toast.error("O encerramento precisa ser depois da entrada.");
        return;
      }
    }
    let calls: number | null = null;
    if (totalCalls.trim() !== "") {
      calls = Number.parseInt(totalCalls, 10);
      if (!Number.isFinite(calls) || calls <= 0) {
        toast.error("Quantidade de calls inválida.");
        return;
      }
    }
    // Igual ao plano = sem ajuste individual (continua seguindo o plano).
    const durationOverride = durationDays !== null && durationDays === planDuration ? null : durationDays;
    const callsOverride = calls !== null && calls === planCalls ? null : calls;

    startSaving(async () => {
      try {
        await updateMenteeOverrides(mentee.id, {
          startsAt: startDate,
          durationDays: durationOverride,
          totalCalls: callsOverride,
        });
        toast.success("Mentoria atualizada.");
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`start-${mentee.id}`} className="text-xs">
            Entrou em
          </Label>
          <Input
            id={`start-${mentee.id}`}
            type="date"
            value={startDate}
            onChange={(e) => handleStartChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`end-${mentee.id}`} className="text-xs">
            Encerra em
          </Label>
          <Input
            id={`end-${mentee.id}`}
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`calls-${mentee.id}`} className="text-xs">
            Total de calls
          </Label>
          <Input
            id={`calls-${mentee.id}`}
            type="number"
            min={1}
            inputMode="numeric"
            placeholder={planCalls ? `Plano: ${planCalls}` : "Sem limite"}
            value={totalCalls}
            onChange={(e) => setTotalCalls(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Vale só pra essa pessoa, o plano dos outros não muda. Deixar o encerramento ou as calls em branco
        volta a usar o do plano{mentee.plan ? ` (${mentee.plan.name})` : ""}. Já usou {mentee.usedCalls}{" "}
        call{mentee.usedCalls === 1 ? "" : "s"}.
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone} disabled={isSaving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
          {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
