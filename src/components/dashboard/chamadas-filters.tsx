"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL = "todos";

type MentorOption = { id: string; name: string; count: number };

function shiftDay(dateKey: string, days: number) {
  return format(addDays(new Date(`${dateKey}T12:00:00`), days), "yyyy-MM-dd");
}

export function ChamadasFilters({
  dateKey,
  today,
  mentorId,
  mentors,
  totalCount,
}: {
  dateKey: string;
  today: string;
  mentorId: string;
  mentors: MentorOption[];
  totalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Filtro mora na URL (?data=&mentor=): dá pra salvar/compartilhar o link e
  // o botão voltar do navegador funciona.
  function go(next: { data?: string; mentor?: string }) {
    const data = next.data ?? dateKey;
    const mentor = next.mentor ?? mentorId;
    const params = new URLSearchParams();
    if (data !== today) params.set("data", data);
    if (mentor) params.set("mentor", mentor);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  // Quem tem call no dia aparece primeiro.
  const withCalls = mentors.filter((m) => m.count > 0).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => go({ data: shiftDay(dateKey, -1) })} title="Dia anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            value={dateKey}
            // Enquanto digita o ano, o Chrome já entrega datas como "0002-11-09"
            // — só navega com ano completo e plausível.
            onChange={(e) => /^20\d{2}-\d{2}-\d{2}$/.test(e.target.value) && go({ data: e.target.value })}
            className="h-8 w-40"
            aria-label="Dia"
          />
          <Button variant="outline" size="icon-sm" onClick={() => go({ data: shiftDay(dateKey, 1) })} title="Próximo dia">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {dateKey !== today && (
          <Button variant="ghost" size="sm" onClick={() => go({ data: today })}>
            Hoje
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <Select
            items={{ [ALL]: "Todos os mentores", ...Object.fromEntries(mentors.map((m) => [m.id, m.name])) }}
            value={mentorId || ALL}
            onValueChange={(v) => go({ mentor: !v || v === ALL ? "" : v })}
          >
            <SelectTrigger className="w-56" aria-label="Mentor">
              <SelectValue placeholder="Todos os mentores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os mentores</SelectItem>
              {mentors.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  {m.count > 0 ? ` (${m.count})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {withCalls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!mentorId} onClick={() => go({ mentor: "" })}>
            Todos · {totalCount}
          </Chip>
          {withCalls.map((m) => (
            <Chip key={m.id} active={mentorId === m.id} onClick={() => go({ mentor: m.id })}>
              {m.name} · {m.count}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
