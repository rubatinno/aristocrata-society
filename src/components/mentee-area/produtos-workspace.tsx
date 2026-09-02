"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import {
  createCreative,
  createProduct,
  deleteCreative,
  deleteProduct,
  renameProduct,
  updateCreative,
  type NewCreativeInput,
} from "@/app/agendar/produtos/actions";
import type { MenteeProduct, MenteeProductCreative } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowUpNarrowWide,
  CalendarDays,
  Check,
  ExternalLink,
  Link2,
  Loader2,
  Package,
  Pencil,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

/** Data de hoje no fuso local do navegador — toISOString() daria a data em
 * UTC, que já é "amanhã" à noite em fusos negativos (ex: Brasil). */
function todayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ProductStats({ creatives }: { creatives: MenteeProductCreative[] }) {
  const validated = creatives.filter((c) => c.validated).length;
  const sales = creatives.reduce((sum, c) => sum + c.sales, 0);
  return (
    <p className="text-xs text-muted-foreground">
      {creatives.length} criativo{creatives.length === 1 ? "" : "s"} · {validated} validado
      {validated === 1 ? "" : "s"} · {sales} venda{sales === 1 ? "" : "s"}
    </p>
  );
}

export function ProdutosWorkspace({
  initialProducts,
  initialCreatives,
  menteeId,
  revalidateTarget,
  className,
}: {
  initialProducts: MenteeProduct[];
  initialCreatives: MenteeProductCreative[];
  menteeId: string;
  revalidateTarget: string;
  className?: string;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [creatives, setCreatives] = useState(initialCreatives);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreatives(initialCreatives);
  }, [initialCreatives]);

  // Compartilhado entre mentorado e mentor — escuta mudanças em tempo real
  // pra refletir o que a outra pessoa acabou de mexer.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`mentee-products-${menteeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentee_products", filter: `mentee_id=eq.${menteeId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setProducts((prev) => prev.filter((p) => p.id !== deletedId));
            setSelectedId((prev) => (prev === deletedId ? null : prev));
            return;
          }
          const incoming = payload.new as MenteeProduct;
          setProducts((prev) => {
            const exists = prev.some((p) => p.id === incoming.id);
            return exists ? prev.map((p) => (p.id === incoming.id ? incoming : p)) : [...prev, incoming];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mentee_product_creatives",
          filter: `mentee_id=eq.${menteeId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setCreatives((prev) => prev.filter((c) => c.id !== deletedId));
            return;
          }
          const incoming = payload.new as MenteeProductCreative;
          setCreatives((prev) => {
            const exists = prev.some((c) => c.id === incoming.id);
            return exists ? prev.map((c) => (c.id === incoming.id ? incoming : c)) : [...prev, incoming];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [menteeId]);

  function commitNewProduct() {
    const name = draftName.trim();
    if (!name) return;
    setIsAddingProduct(false);
    setIsCreatingProduct(true);
    createProduct(menteeId, name, revalidateTarget)
      .then((product) => {
        setProducts((prev) => [...prev, product]);
        setSelectedId(product.id);
        setDraftName("");
      })
      .catch(() => toast.error("Não foi possível criar o produto."))
      .finally(() => setIsCreatingProduct(false));
  }

  function cancelNewProduct() {
    setIsAddingProduct(false);
    setDraftName("");
  }

  function startRename(product: MenteeProduct) {
    setRenamingId(product.id);
    setRenameValue(product.name);
  }

  function commitRename(product: MenteeProduct) {
    const name = renameValue.trim() || "Novo produto";
    setRenamingId(null);
    if (name === product.name) return;
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, name } : p)));
    renameProduct(product.id, name, revalidateTarget).catch(() => {
      toast.error("Não foi possível renomear o produto.");
    });
  }

  function handleDeleteProduct(product: MenteeProduct) {
    if (
      !window.confirm(
        `Remover o produto "${product.name}"? Isso apaga todos os criativos dentro dele. Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    setCreatives((prev) => prev.filter((c) => c.product_id !== product.id));
    if (selectedId === product.id) setSelectedId(null);
    deleteProduct(product.id, revalidateTarget).catch(() => {
      toast.error("Não foi possível remover o produto.");
    });
  }

  const selectedProduct = products.find((p) => p.id === selectedId) ?? null;

  return (
    <div className={cn("flex min-h-0 flex-col overflow-y-auto p-6", className)}>
      {selectedProduct ? (
        <ProductFolder
          product={selectedProduct}
          creatives={creatives.filter((c) => c.product_id === selectedProduct.id)}
          menteeId={menteeId}
          revalidateTarget={revalidateTarget}
          setCreatives={setCreatives}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">Produtos</h2>
              <p className="text-sm text-muted-foreground">
                Sua central pra organizar produtos e criativos testados.
              </p>
            </div>
            {isAddingProduct ? (
              <div className="flex shrink-0 items-center gap-2">
                <Input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Nome do produto"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitNewProduct();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelNewProduct();
                    }
                  }}
                  className="h-9 w-48"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={commitNewProduct}
                  disabled={isCreatingProduct || !draftName.trim()}
                  className="gap-1.5"
                >
                  {isCreatingProduct ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  Criar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={cancelNewProduct}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button type="button" onClick={() => setIsAddingProduct(true)} className="shrink-0 gap-1.5">
                <Plus className="size-3.5" />
                Novo produto
              </Button>
            )}
          </div>

          {products.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
              <Package className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">Nenhum produto ainda</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Crie o primeiro produto pra começar a organizar seus criativos.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const productCreatives = creatives.filter((c) => c.product_id === product.id);
                return (
                  <div
                    key={product.id}
                    className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(product.id)}
                        className="flex min-w-0 items-center gap-2 text-left"
                      >
                        <Package className="size-4 shrink-0 text-primary" />
                        {renamingId === product.id ? (
                          <Input
                            autoFocus
                            value={renameValue}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(product)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitRename(product);
                              }
                            }}
                            className="h-7"
                          />
                        ) : (
                          <span className="truncate text-sm font-medium">{product.name}</span>
                        )}
                      </button>
                      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(product);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          title="Renomear"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(product);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remover"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <button type="button" onClick={() => setSelectedId(product.id)} className="text-left">
                      <ProductStats creatives={productCreatives} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type SortField = "recent" | "test_date" | "sales" | "validated" | "name";
type SortDirection = "asc" | "desc";

const SORT_FIELD_ITEMS: Record<SortField, string> = {
  recent: "Data de criação",
  test_date: "Data de teste",
  sales: "Vendas",
  validated: "Validado",
  name: "Nome",
};

function compareCreatives(a: MenteeProductCreative, b: MenteeProductCreative, field: SortField) {
  switch (field) {
    case "sales":
      return a.sales - b.sales;
    case "validated":
      return Number(a.validated) - Number(b.validated);
    case "name":
      return a.title.localeCompare(b.title);
    case "test_date":
      return (a.test_date ?? "").localeCompare(b.test_date ?? "");
    case "recent":
    default:
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }
}

function ProductFolder({
  product,
  creatives,
  menteeId,
  revalidateTarget,
  setCreatives,
  onBack,
}: {
  product: MenteeProduct;
  creatives: MenteeProductCreative[];
  menteeId: string;
  revalidateTarget: string;
  setCreatives: React.Dispatch<React.SetStateAction<MenteeProductCreative[]>>;
  onBack: () => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("recent");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function handleCreateCreative(input: NewCreativeInput) {
    try {
      const creative = await createCreative(product.id, menteeId, input, revalidateTarget);
      setCreatives((prev) => [...prev, creative]);
      setIsDialogOpen(false);
    } catch {
      toast.error("Não foi possível criar o criativo.");
    }
  }

  function handleDeleteCreative(id: string) {
    setCreatives((prev) => prev.filter((c) => c.id !== id));
    deleteCreative(id, revalidateTarget).catch(() => toast.error("Não foi possível remover o criativo."));
  }

  function patchCreative(id: string, patch: Partial<MenteeProductCreative>) {
    setCreatives((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  const hasDateFilter = dateFrom !== "" || dateTo !== "";

  const visibleCreatives = useMemo(() => {
    let list = creatives;
    if (hasDateFilter) {
      list = list.filter((c) => {
        if (!c.test_date) return false;
        if (dateFrom && c.test_date < dateFrom) return false;
        if (dateTo && c.test_date > dateTo) return false;
        return true;
      });
    }
    const sorted = [...list].sort((a, b) => compareCreatives(a, b, sortField));
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [creatives, sortField, sortDirection, dateFrom, dateTo, hasDateFilter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} title="Voltar">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-lg font-semibold">{product.name}</h2>
          <ProductStats creatives={creatives} />
        </div>
        <Button type="button" onClick={() => setIsDialogOpen(true)} className="shrink-0 gap-1.5">
          <Plus className="size-3.5" />
          Novo criativo
        </Button>
      </div>

      <NewCreativeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        defaultTitle={`Criativo ${creatives.length + 1}`}
        onCreate={handleCreateCreative}
      />

      {creatives.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
          <ShoppingBag className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nenhum criativo ainda</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Adicione os criativos que você está testando pra esse produto.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Ordenar por</span>
            <Select
              value={sortField}
              onValueChange={(v) => v && setSortField(v as SortField)}
              items={SORT_FIELD_ITEMS}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORT_FIELD_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
              className="h-8 gap-1.5 text-xs"
            >
              {sortDirection === "asc" ? (
                <ArrowUpNarrowWide className="size-3.5" />
              ) : (
                <ArrowDownWideNarrow className="size-3.5" />
              )}
              {sortDirection === "asc" ? "Crescente" : "Decrescente"}
            </Button>

            <span className="ml-2 text-xs text-muted-foreground">Data de teste</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-36 text-xs"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-36 text-xs"
            />
            {hasDateFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="h-8 gap-1 text-xs"
              >
                <X className="size-3.5" /> Limpar
              </Button>
            )}
          </div>

          {visibleCreatives.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Nenhum criativo com data de teste nesse período.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {visibleCreatives.map((creative) => (
                <CreativeRow
                  key={creative.id}
                  creative={creative}
                  revalidateTarget={revalidateTarget}
                  onPatch={(patch) => patchCreative(creative.id, patch)}
                  onDelete={() => handleDeleteCreative(creative.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NewCreativeDialog({
  open,
  onOpenChange,
  defaultTitle,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle: string;
  onCreate: (input: NewCreativeInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [link, setLink] = useState("");
  const [testDate, setTestDate] = useState(todayKey());
  const [validated, setValidated] = useState(false);
  const [sales, setSales] = useState("0");
  const [isSaving, setIsSaving] = useState(false);

  // Sempre que o popup abre, começa do zero — inclusive o nome sugerido, que
  // muda conforme quantos criativos o produto já tem.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta o formulário ao reabrir, não sincroniza com nada externo
      setTitle(defaultTitle);
      setLink("");
      setTestDate(todayKey());
      setValidated(false);
      setSales("0");
    }
  }, [open, defaultTitle]);

  function handleCreate() {
    setIsSaving(true);
    onCreate({
      title: title.trim() || defaultTitle,
      link: link.trim(),
      validated,
      sales: sales === "" ? 0 : Number.parseInt(sales, 10),
      testDate: testDate || null,
    }).finally(() => setIsSaving(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Novo criativo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome do criativo</label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reels — gancho novo"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Link do criativo</label>
            <div className="relative">
              <Link2 className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://..."
                className="pl-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Data de teste</label>
              <Input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Vendas iniciais</label>
              <Input
                type="text"
                inputMode="numeric"
                value={sales}
                onChange={(e) => setSales(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <ValidatedSelect validated={validated} onChange={setValidated} />
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleCreate} disabled={isSaving} className="gap-1.5">
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Criar criativo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SalesField({
  value,
  onChange,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1.5">
      <Input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="h-9 w-16 text-center"
        title="Número de vendas"
      />
      <span className="text-xs text-muted-foreground">venda{value === "1" ? "" : "s"}</span>
    </div>
  );
}

function TestDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1.5" title="Data de teste">
      <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-36 text-xs" />
    </div>
  );
}

const VALIDATED_ITEMS = { validado: "Validado", nao_validado: "Não validado" };

function ValidatedSelect({
  validated,
  onChange,
}: {
  validated: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Select
      value={validated ? "validado" : "nao_validado"}
      onValueChange={(v) => v && onChange(v === "validado")}
      items={VALIDATED_ITEMS}
    >
      <SelectTrigger
        className={cn(
          "h-9 w-40 shrink-0 text-xs font-medium",
          validated
            ? "border-success/40 bg-success/15 text-success"
            : "border-border bg-muted/40 text-muted-foreground",
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(VALIDATED_ITEMS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreativeRow({
  creative,
  revalidateTarget,
  onPatch,
  onDelete,
}: {
  creative: MenteeProductCreative;
  revalidateTarget: string;
  onPatch: (patch: Partial<MenteeProductCreative>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(creative.title);
  const [link, setLink] = useState(creative.link);
  const [sales, setSales] = useState(String(creative.sales));
  const [testDate, setTestDate] = useState(creative.test_date ?? "");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(patch: { title?: string; link?: string; sales?: number; test_date?: string | null }) {
    onPatch(patch);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      updateCreative(creative.id, patch, revalidateTarget).catch(() => {
        toast.error("Não foi possível salvar o criativo.");
      });
    }, 700);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave({ title: value });
  }

  function handleLinkChange(value: string) {
    setLink(value);
    scheduleSave({ link: value });
  }

  function handleSalesChange(value: string) {
    const digitsOnly = value.replace(/[^0-9]/g, "");
    setSales(digitsOnly);
    scheduleSave({ sales: digitsOnly === "" ? 0 : Number.parseInt(digitsOnly, 10) });
  }

  function handleSalesKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
  }

  function handleTestDateChange(value: string) {
    setTestDate(value);
    scheduleSave({ test_date: value || null });
  }

  function handleValidatedChange(nextValidated: boolean) {
    onPatch({ validated: nextValidated });
    updateCreative(creative.id, { validated: nextValidated }, revalidateTarget).catch(() => {
      toast.error("Não foi possível atualizar o criativo.");
      onPatch({ validated: creative.validated });
    });
  }

  // "Salvar" confirma na hora, sem esperar o debounce — evita que o campo
  // pareça "não salvo" se a pessoa clica em Salvar logo após digitar.
  function handleSave() {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    const parsedSales = sales === "" ? 0 : Number.parseInt(sales, 10);
    onPatch({ title, link, sales: parsedSales });
    updateCreative(creative.id, { title, link, sales: parsedSales }, revalidateTarget).catch(() => {
      toast.error("Não foi possível salvar o criativo.");
    });
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Nome do criativo"
          className="h-9 w-40 shrink-0"
        />

        <div className="relative min-w-48 flex-1">
          <Link2 className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={link}
            onChange={(e) => handleLinkChange(e.target.value)}
            placeholder="Link do criativo"
            className="h-9 pl-8"
          />
        </div>

        <ValidatedSelect validated={creative.validated} onChange={handleValidatedChange} />

        <SalesField value={sales} onChange={handleSalesChange} onKeyDown={handleSalesKeyDown} />

        <TestDateField value={testDate} onChange={handleTestDateChange} />

        <Button type="button" size="sm" onClick={handleSave} className="shrink-0 gap-1.5">
          <Check className="size-3.5" />
          Salvar
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
          title="Remover criativo"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{title || "Sem nome"}</span>

      {link.trim() ? (
        <a
          href={link.trim()}
          target="_blank"
          rel="noreferrer"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <ExternalLink className="size-3.5" />
          Abrir Criativo
        </a>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">Sem link</span>
      )}

      <ValidatedSelect validated={creative.validated} onChange={handleValidatedChange} />

      <SalesField value={sales} onChange={handleSalesChange} onKeyDown={handleSalesKeyDown} />

      <TestDateField value={testDate} onChange={handleTestDateChange} />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setIsEditing(true)}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        title="Editar nome e link"
      >
        <Pencil className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onDelete}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        title="Remover criativo"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
