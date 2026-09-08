"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { addMonths, differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  addMenteeLink,
  removeMenteeLink,
  updateMenteeGroupLink,
  updateMenteeOverrides,
  type LinkFormState,
} from "@/app/dashboard/mentorados/actions";
import { adminSetMenteePassword, updateMenteePlan } from "@/app/dashboard/aprovacoes/actions";
import { listMenteeNotes } from "@/app/agendar/anotacoes/actions";
import { listMenteeGoals } from "@/app/agendar/progresso/actions";
import { getMenteeSummary } from "@/app/dashboard/mentorados/summary-actions";
import { listMenteeProducts, listProductCreatives } from "@/app/agendar/produtos/actions";
import { startViewAsMentee } from "@/app/agendar/mentee-actions";
import { NotesWorkspace } from "@/components/mentee-area/notes-workspace";
import { GoalsWorkspace } from "@/components/mentee-area/goals-workspace";
import { SummaryWorkspace } from "@/components/mentee-area/summary-workspace";
import { ProdutosWorkspace } from "@/components/mentee-area/produtos-workspace";
import type {
  ApprovedMentee,
  MenteeGoal,
  MenteeLink,
  MenteeNote,
  MenteeProduct,
  MenteeProductCreative,
  Plan,
} from "@/lib/types";
import { formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  Eye,
  ExternalLink,
  FileText,
  KeyRound,
  Loader2,
  Mail,
  Maximize2,
  Minimize2,
  NotebookPen,
  Package,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

const initialState: LinkFormState = { status: "idle" };
const NO_PLAN = "none";

export type MenteeWithDetails = ApprovedMentee & {
  plan: Plan | null;
  links: MenteeLink[];
  completedCalls: number;
  daysRemaining: number | null;
  effectiveTotalCalls: number | null;
};

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Vencido = prazo do plano já passou OU já usou todas as chamadas do plano. */
function isMenteeExpired(mentee: MenteeWithDetails) {
  const pastDeadline = mentee.daysRemaining !== null && mentee.daysRemaining < 0;
  const usedAllCalls =
    mentee.effectiveTotalCalls !== null && mentee.completedCalls >= mentee.effectiveTotalCalls;
  return pastDeadline || usedAllCalls;
}

function matchesSearch(mentee: MenteeWithDetails, query: string) {
  if (!query) return true;
  const haystack = `${mentee.full_name ?? ""} ${mentee.email}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

const STATUS_ITEMS: Record<string, string> = {
  all: "Todos",
  active: "Ativos",
  expired: "Vencidos",
};

export function MenteesDirectory({
  mentees,
  plans = [],
  isAdmin = false,
}: {
  mentees: MenteeWithDetails[];
  plans?: Plan[];
  isAdmin?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  if (mentees.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Nenhum mentorado aprovado ainda. Peça a um admin para aprovar em Aprovações.
      </p>
    );
  }

  const activeCount = mentees.filter((m) => !isMenteeExpired(m)).length;
  const expiredCount = mentees.length - activeCount;

  const filtered = mentees.filter((mentee) => {
    if (!matchesSearch(mentee, query)) return false;
    if (statusFilter === "active") return !isMenteeExpired(mentee);
    if (statusFilter === "expired") return isMenteeExpired(mentee);
    return true;
  });

  const hasFilters = query !== "" || statusFilter !== "all";

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)} items={STATUS_ITEMS}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                  {value === "active" ? ` (${activeCount})` : value === "expired" ? ` (${expiredCount})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
              className="gap-1.5"
            >
              <X className="size-3.5" /> Limpar
            </Button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Nenhum mentorado encontrado com esses filtros.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((mentee) => (
            <MenteeCard key={mentee.id} mentee={mentee} plans={plans} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Botão de ação do card — empilhado (ícone em cima, texto curto embaixo)
 * numa grade no celular, onde 6 botões com texto ao lado do outro nunca
 * cabiam (espremiam o nome/e-mail até truncar); em telas maiores volta a
 * ser um botão normal, ícone + texto completo lado a lado. */
function MenteeActionButton({
  icon: Icon,
  label,
  shortLabel,
  onClick,
  disabled,
  title,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  shortLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  loading?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-auto flex-col gap-1 py-2.5 sm:h-9 sm:flex-row sm:gap-1.5 sm:py-0"
    >
      {loading ? <Loader2 className="size-4 animate-spin sm:size-3.5" /> : <Icon className="size-4 sm:size-3.5" />}
      <span className="text-[11px] leading-none sm:hidden">{shortLabel ?? label}</span>
      <span className="hidden text-sm sm:inline">{label}</span>
    </Button>
  );
}

function MenteeCard({
  mentee,
  plans,
  isAdmin,
}: {
  mentee: MenteeWithDetails;
  plans: Plan[];
  isAdmin: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(addMenteeLink, initialState);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemoving, startRemoving] = useTransition();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<MenteeNote[] | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesMaximized, setNotesMaximized] = useState(true);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [goals, setGoals] = useState<MenteeGoal[] | null>(null);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryContent, setSummaryContent] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [products, setProducts] = useState<MenteeProduct[] | null>(null);
  const [productCreatives, setProductCreatives] = useState<MenteeProductCreative[] | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [editingLimits, setEditingLimits] = useState(false);
  const [totalCallsInput, setTotalCallsInput] = useState(mentee.total_calls_override?.toString() ?? "");
  const [startDateInput, setStartDateInput] = useState(mentee.starts_at);
  const [endDateInput, setEndDateInput] = useState(
    mentee.duration_days_override
      ? addDaysToDateKey(mentee.starts_at, mentee.duration_days_override)
      : "",
  );
  const [isSavingLimits, startSavingLimits] = useTransition();
  const [isChangingPlan, startChangingPlan] = useTransition();
  const [editingGroupLink, setEditingGroupLink] = useState(false);
  const [groupLinkInput, setGroupLinkInput] = useState(mentee.group_link ?? "");
  const [isSavingGroupLink, startSavingGroupLink] = useTransition();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isSavingPassword, startSavingPassword] = useTransition();

  function handlePlanChange(value: string | null) {
    startChangingPlan(async () => {
      try {
        await updateMenteePlan(mentee.id, !value || value === NO_PLAN ? null : value);
        toast.success("Plano atualizado.");
      } catch {
        toast.error("Não foi possível atualizar o plano.");
      }
    });
  }

  function handleSaveGroupLink() {
    startSavingGroupLink(async () => {
      try {
        await updateMenteeGroupLink(mentee.id, groupLinkInput);
        toast.success("Link do grupo salvo.");
        setEditingGroupLink(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  // Reage ao resultado da Server Action (fonte externa via useActionState),
  // não a um valor derivável durante a renderização.
  useEffect(() => {
    if (state.status === "success") {
      toast.success("Link adicionado.");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormKey((k) => k + 1); // limpa os campos pra permitir adicionar outro em seguida
    }
  }, [state]);

  function handleRemoveLink(id: string) {
    setRemovingId(id);
    startRemoving(async () => {
      try {
        await removeMenteeLink(id);
        toast.success("Link removido.");
      } catch {
        toast.error("Não foi possível remover.");
      } finally {
        setRemovingId(null);
      }
    });
  }

  function handleStartDateChange(value: string) {
    setStartDateInput(value);
    if (value) {
      const newEnd = addMonths(new Date(`${value}T12:00:00Z`), 4).toISOString().slice(0, 10);
      setEndDateInput(newEnd);
    }
  }

  function handleSaveLimits() {
    const totalCalls = totalCallsInput.trim() === "" ? null : Number.parseInt(totalCallsInput, 10);
    const durationDays =
      endDateInput && startDateInput
        ? differenceInCalendarDays(new Date(`${endDateInput}T12:00:00Z`), new Date(`${startDateInput}T12:00:00Z`))
        : null;

    startSavingLimits(async () => {
      try {
        await updateMenteeOverrides(mentee.id, {
          totalCalls,
          durationDays,
          startsAt: startDateInput || mentee.starts_at,
        });
        toast.success("Limites atualizados.");
        setEditingLimits(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  async function handleOpenNotes() {
    if (!mentee.user_id) return;
    setLoadingNotes(true);
    try {
      const data = await listMenteeNotes(mentee.user_id);
      setNotes(data);
      setNotesOpen(true);
    } catch {
      toast.error("Não foi possível carregar as anotações.");
    } finally {
      setLoadingNotes(false);
    }
  }

  async function handleOpenGoals() {
    if (!mentee.user_id) return;
    setLoadingGoals(true);
    try {
      const data = await listMenteeGoals(mentee.user_id);
      setGoals(data);
      setGoalsOpen(true);
    } catch {
      toast.error("Não foi possível carregar o progresso.");
    } finally {
      setLoadingGoals(false);
    }
  }

  async function handleOpenSummary() {
    if (!mentee.user_id) return;
    setLoadingSummary(true);
    try {
      const data = await getMenteeSummary(mentee.user_id);
      setSummaryContent(data?.content ?? "");
      setSummaryOpen(true);
    } catch {
      toast.error("Não foi possível carregar o resumo.");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleOpenProducts() {
    if (!mentee.user_id) return;
    setLoadingProducts(true);
    try {
      const [productsData, creativesData] = await Promise.all([
        listMenteeProducts(mentee.user_id),
        listProductCreatives(mentee.user_id),
      ]);
      setProducts(productsData);
      setProductCreatives(creativesData);
      setProductsOpen(true);
    } catch {
      toast.error("Não foi possível carregar os produtos.");
    } finally {
      setLoadingProducts(false);
    }
  }

  function handleViewAsMentee() {
    if (!mentee.user_id) return;
    // startViewAsMentee redireciona (throw interno do Next.js) — sem
    // try/catch aqui, igual ao padrão já usado em menteeSignOut.
    void startViewAsMentee(mentee.user_id);
  }

  function handleSetPassword() {
    if (!mentee.user_id) return;
    if (newPassword.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    startSavingPassword(async () => {
      try {
        await adminSetMenteePassword(mentee.user_id!, newPassword);
        toast.success("Senha alterada. Avise o mentorado da nova senha.");
        setPasswordOpen(false);
        setNewPassword("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível alterar a senha.");
      }
    });
  }

  const actionButtons = (
    <>
      {isAdmin && (
        <MenteeActionButton
          icon={Eye}
          label="Visualizar como Mentorado"
          shortLabel="Ver como"
          onClick={handleViewAsMentee}
          disabled={!mentee.user_id}
          title={!mentee.user_id ? "Mentorado ainda não criou a conta" : undefined}
        />
      )}
      <MenteeActionButton
        icon={Target}
        label="Progresso"
        onClick={handleOpenGoals}
        disabled={!mentee.user_id || loadingGoals}
        title={!mentee.user_id ? "Mentorado ainda não criou a conta" : undefined}
        loading={loadingGoals}
      />
      <MenteeActionButton
        icon={NotebookPen}
        label="Anotações"
        onClick={handleOpenNotes}
        disabled={!mentee.user_id || loadingNotes}
        title={!mentee.user_id ? "Mentorado ainda não criou a conta" : undefined}
        loading={loadingNotes}
      />
      <MenteeActionButton
        icon={FileText}
        label="Resumo"
        onClick={handleOpenSummary}
        disabled={!mentee.user_id || loadingSummary}
        title={!mentee.user_id ? "Mentorado ainda não criou a conta" : "Só mentores e admin veem essa aba"}
        loading={loadingSummary}
      />
      <MenteeActionButton
        icon={Package}
        label="Produtos"
        onClick={handleOpenProducts}
        disabled={!mentee.user_id || loadingProducts}
        title={!mentee.user_id ? "Mentorado ainda não criou a conta" : undefined}
        loading={loadingProducts}
      />
      {isAdmin && (
        <MenteeActionButton
          icon={KeyRound}
          label="Redefinir senha"
          shortLabel="Senha"
          onClick={() => setPasswordOpen(true)}
          disabled={!mentee.user_id}
          title={!mentee.user_id ? "Mentorado ainda não criou a conta" : undefined}
        />
      )}
    </>
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{mentee.full_name || mentee.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1">
              <Mail className="size-3 shrink-0" />
              <span className="truncate">{mentee.email}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1">
              <CalendarDays className="size-3 shrink-0" />
              desde {formatFullDate(new Date(`${mentee.starts_at}T12:00:00Z`), "UTC")}
            </span>
          </div>
        </div>
        {isAdmin ? (
          <Select
            items={{
              [NO_PLAN]: "Sem plano (1/semana)",
              ...Object.fromEntries(plans.map((plan) => [plan.id, plan.name])),
            }}
            value={mentee.plan_id ?? NO_PLAN}
            onValueChange={handlePlanChange}
            disabled={isChangingPlan}
          >
            <SelectTrigger className="w-full sm:w-44">
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
        ) : (
          <Badge variant="outline" className="w-fit">
            {mentee.plan?.name ?? "Sem plano (1/semana)"}
          </Badge>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-border pt-3 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
        {actionButtons}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {editingGroupLink ? (
          <>
            <Users className="size-3.5 shrink-0 text-muted-foreground" />
            <Input
              type="text"
              autoFocus
              placeholder="https://chat.whatsapp.com/..."
              value={groupLinkInput}
              onChange={(e) => setGroupLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveGroupLink();
                } else if (e.key === "Escape") {
                  setEditingGroupLink(false);
                  setGroupLinkInput(mentee.group_link ?? "");
                }
              }}
              className="h-8 min-w-48 flex-1"
            />
            <Button type="button" size="sm" onClick={handleSaveGroupLink} disabled={isSavingGroupLink} className="gap-1.5">
              {isSavingGroupLink && <Loader2 className="size-3.5 animate-spin" />}
              Salvar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingGroupLink(false);
                setGroupLinkInput(mentee.group_link ?? "");
              }}
              disabled={isSavingGroupLink}
            >
              Cancelar
            </Button>
          </>
        ) : mentee.group_link ? (
          <>
            <a
              href={mentee.group_link}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-1.5 truncate text-sm text-primary hover:underline"
            >
              <Users className="size-3.5 shrink-0" />
              Grupo do mentorado
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditingGroupLink(true)}
              className="text-muted-foreground hover:text-foreground"
              title="Editar link do grupo"
            >
              <Pencil className="size-3.5" />
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditingGroupLink(true)}
            className="gap-1.5 text-primary hover:text-primary"
          >
            <Users className="size-3.5" /> Adicionar link do grupo
          </Button>
        )}
      </div>

      {isAdmin && (
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-success" />
            {mentee.completedCalls}
            {mentee.effectiveTotalCalls ? ` / ${mentee.effectiveTotalCalls}` : ""}{" "}
            {mentee.completedCalls === 1 ? "chamada realizada" : "chamadas realizadas"}
          </span>
          <span className="flex items-center gap-1.5">
            {mentee.daysRemaining === null ? (
              <>
                <CalendarClock className="size-3.5" /> Sem prazo definido
              </>
            ) : mentee.daysRemaining < 0 ? (
              <>
                <CalendarX2 className="size-3.5 text-destructive" /> Plano expirado
              </>
            ) : (
              <>
                <CalendarClock className="size-3.5" /> {mentee.daysRemaining}{" "}
                {mentee.daysRemaining === 1 ? "dia restante" : "dias restantes"}
              </>
            )}
          </span>
          {!editingLimits && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditingLimits(true)}
              className="text-muted-foreground hover:text-foreground"
              title="Editar limites deste mentorado"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
        </div>
      )}

      {isAdmin && editingLimits && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/30 p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Total de chamadas</label>
            <Input
              type="number"
              min={1}
              placeholder={mentee.plan?.total_calls ? String(mentee.plan.total_calls) : "Sem limite"}
              value={totalCallsInput}
              onChange={(e) => setTotalCallsInput(e.target.value)}
              className="w-32"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data de início</label>
            <Input
              type="date"
              value={startDateInput}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data final</label>
            <Input
              type="date"
              placeholder="Sem prazo"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              className="w-40"
            />
          </div>
          <Button type="button" size="sm" onClick={handleSaveLimits} disabled={isSavingLimits} className="gap-1.5">
            {isSavingLimits && <Loader2 className="size-3.5 animate-spin" />}
            Salvar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingLimits(false);
              setTotalCallsInput(mentee.total_calls_override?.toString() ?? "");
              setStartDateInput(mentee.starts_at);
              setEndDateInput(
                mentee.duration_days_override
                  ? addDaysToDateKey(mentee.starts_at, mentee.duration_days_override)
                  : "",
              );
            }}
            disabled={isSavingLimits}
          >
            Cancelar
          </Button>
          <p className="w-full text-[11px] text-muted-foreground">
            A data final começa preenchida com 4 meses após o início — ajuste se quiser. Deixe em
            branco pra usar o prazo padrão do plano ({mentee.plan?.name ?? "sem plano"}).
          </p>
        </div>
      )}

      {mentee.user_id && (
        <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
          <DialogContent
            className={cn(
              "flex flex-col gap-0 p-0",
              notesMaximized
                ? "top-0 left-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none"
                : "h-[70vh] max-w-4xl sm:max-w-4xl",
            )}
            showCloseButton
          >
            <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 shrink-0 border-b border-border p-4 pr-16">
              <DialogTitle>Anotações · {mentee.full_name || mentee.email}</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setNotesMaximized((prev) => !prev)}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                {notesMaximized ? (
                  <>
                    <Minimize2 className="size-3.5" /> Sair da tela cheia
                  </>
                ) : (
                  <>
                    <Maximize2 className="size-3.5" /> Tela cheia
                  </>
                )}
              </Button>
            </DialogHeader>
            {notes && (
              <NotesWorkspace
                initialNotes={notes}
                menteeId={mentee.user_id}
                revalidateTarget="/dashboard/mentorados"
                className="flex-1"
                focusMode={notesMaximized}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {mentee.user_id && (
        <Dialog open={goalsOpen} onOpenChange={setGoalsOpen}>
          <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton>
            <DialogHeader className="shrink-0 border-b border-border p-4 pr-16">
              <DialogTitle>Progresso · {mentee.full_name || mentee.email}</DialogTitle>
            </DialogHeader>
            {goals && (
              <div className="flex-1 overflow-y-auto">
                <GoalsWorkspace
                  initialGoals={goals}
                  menteeId={mentee.user_id}
                  revalidateTarget="/dashboard/mentorados"
                  canManage
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {mentee.user_id && (
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="flex h-[70vh] max-w-3xl flex-col gap-0 p-0 sm:max-w-3xl" showCloseButton>
            <DialogHeader className="shrink-0 border-b border-border p-4 pr-16">
              <DialogTitle>Resumo · {mentee.full_name || mentee.email}</DialogTitle>
            </DialogHeader>
            {summaryContent !== null && (
              <SummaryWorkspace
                initialContent={summaryContent}
                menteeId={mentee.user_id}
                revalidateTarget="/dashboard/mentorados"
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {mentee.user_id && (
        <Dialog open={productsOpen} onOpenChange={setProductsOpen}>
          <DialogContent className="flex h-[75vh] max-w-3xl flex-col gap-0 p-0 sm:max-w-3xl" showCloseButton>
            <DialogHeader className="shrink-0 border-b border-border p-4 pr-16">
              <DialogTitle>Produtos · {mentee.full_name || mentee.email}</DialogTitle>
            </DialogHeader>
            {products && productCreatives && (
              <ProdutosWorkspace
                initialProducts={products}
                initialCreatives={productCreatives}
                menteeId={mentee.user_id}
                revalidateTarget="/dashboard/mentorados"
                className="flex-1"
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {mentee.user_id && (
        <Dialog
          open={passwordOpen}
          onOpenChange={(open) => {
            setPasswordOpen(open);
            if (!open) setNewPassword("");
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Redefinir senha · {mentee.full_name || mentee.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Define uma senha nova pra esse mentorado entrar. Avise ele por fora (WhatsApp, etc) —
                isso não envia e-mail.
              </p>
              <Input
                type="text"
                autoFocus
                placeholder="Nova senha (mín. 6 caracteres)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSetPassword();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPasswordOpen(false)}
                  disabled={isSavingPassword}
                >
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={handleSetPassword} disabled={isSavingPassword} className="gap-1.5">
                  {isSavingPassword && <Loader2 className="size-3.5 animate-spin" />}
                  Salvar nova senha
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        {mentee.links.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground">Nenhum link salvo.</p>
        )}

        {mentee.links.map((link) => (
          <div key={link.id} className="flex items-center gap-2 text-sm">
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-primary hover:underline"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              <span className="truncate">{link.title}</span>
            </a>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRemoveLink(link.id)}
              disabled={isRemoving && removingId === link.id}
              className="text-muted-foreground hover:text-destructive"
            >
              {isRemoving && removingId === link.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </div>
        ))}

        {showForm ? (
          <form
            key={formKey}
            action={(formData) => {
              formData.set("mentee_id", mentee.id);
              formAction(formData);
            }}
            className="flex flex-wrap items-center gap-2 pt-1"
          >
            <Input name="title" placeholder="Nome do link" className="min-w-32 flex-1" required />
            <Input name="url" placeholder="https://..." className="min-w-40 flex-1" required />
            <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Salvar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Fechar
            </Button>
            {state.status === "error" && (
              <p className="w-full text-xs text-destructive">{state.message}</p>
            )}
          </form>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(true)}
            className="gap-1.5 text-primary hover:text-primary"
          >
            <Plus className="size-3.5" /> Adicionar link
          </Button>
        )}
      </div>
    </div>
  );
}
