"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  createCreative,
  createProduct,
  deleteCreative,
  deleteProduct,
  renameProduct,
  updateCreative,
} from "@/app/agendar/produtos/actions";
import type { MenteeProduct, MenteeProductCreative } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  BadgeCheck,
  CircleDashed,
  ExternalLink,
  Link2,
  Loader2,
  Package,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";

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

  function handleNewProduct() {
    setIsCreatingProduct(true);
    createProduct(menteeId, revalidateTarget)
      .then((product) => {
        setProducts((prev) => [...prev, product]);
        setSelectedId(product.id);
        setRenamingId(product.id);
        setRenameValue(product.name);
      })
      .catch(() => toast.error("Não foi possível criar o produto."))
      .finally(() => setIsCreatingProduct(false));
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
            <Button type="button" onClick={handleNewProduct} disabled={isCreatingProduct} className="gap-1.5">
              {isCreatingProduct ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Novo produto
            </Button>
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
  const [isCreating, setIsCreating] = useState(false);

  function handleNewCreative() {
    setIsCreating(true);
    createCreative(product.id, menteeId, revalidateTarget)
      .then((creative) => setCreatives((prev) => [...prev, creative]))
      .catch(() => toast.error("Não foi possível criar o criativo."))
      .finally(() => setIsCreating(false));
  }

  function handleDeleteCreative(id: string) {
    setCreatives((prev) => prev.filter((c) => c.id !== id));
    deleteCreative(id, revalidateTarget).catch(() => toast.error("Não foi possível remover o criativo."));
  }

  function patchCreative(id: string, patch: Partial<MenteeProductCreative>) {
    setCreatives((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

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
        <Button type="button" onClick={handleNewCreative} disabled={isCreating} className="shrink-0 gap-1.5">
          {isCreating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Novo criativo
        </Button>
      </div>

      {creatives.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
          <ShoppingBag className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nenhum criativo ainda</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Adicione os criativos que você está testando pra esse produto.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {creatives.map((creative) => (
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
    </div>
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
  const [title, setTitle] = useState(creative.title);
  const [link, setLink] = useState(creative.link);
  const [sales, setSales] = useState(String(creative.sales));
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(patch: { title?: string; link?: string; sales?: number }) {
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

  function toggleValidated() {
    const nextValidated = !creative.validated;
    onPatch({ validated: nextValidated });
    updateCreative(creative.id, { validated: nextValidated }, revalidateTarget).catch(() => {
      toast.error("Não foi possível atualizar o criativo.");
      onPatch({ validated: creative.validated });
    });
  }

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

      {link.trim() && (
        <a
          href={link.trim()}
          target="_blank"
          rel="noreferrer"
          title="Abrir link"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}

      <button
        type="button"
        onClick={toggleValidated}
        className={cn(
          "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
          creative.validated
            ? "border-success/40 bg-success/15 text-success"
            : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
        )}
      >
        {creative.validated ? <BadgeCheck className="size-3.5" /> : <CircleDashed className="size-3.5" />}
        {creative.validated ? "Validado" : "Não validado"}
      </button>

      <div className="flex h-9 shrink-0 items-center gap-1.5">
        <Input
          type="text"
          inputMode="numeric"
          value={sales}
          onChange={(e) => handleSalesChange(e.target.value)}
          onKeyDown={handleSalesKeyDown}
          className="h-9 w-16 text-center"
        />
        <span className="text-xs text-muted-foreground">venda{sales === "1" ? "" : "s"}</span>
      </div>

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
