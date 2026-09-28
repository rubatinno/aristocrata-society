"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { LessonWithProgress, ModuleWithLessons } from "@/app/agendar/aulas/actions";
import { daysUntil } from "@/lib/drip";
import { cn } from "@/lib/utils";
import {
  BadgeCheck,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Lock,
  PlayCircle,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

function moduleProgress(module: ModuleWithLessons) {
  const total = module.lessons.length;
  const completed = module.lessons.filter((l) => l.completed).length;
  return { total, completed, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

export function AulasWorkspace({ modules }: { modules: ModuleWithLessons[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(modules[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCards(direction: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: direction * 280, behavior: "smooth" });
  }

  const trimmedQuery = query.trim().toLowerCase();
  const filteredModules = trimmedQuery
    ? modules.filter(
        (m) =>
          m.title.toLowerCase().includes(trimmedQuery) ||
          m.lessons.some((l) => l.title.toLowerCase().includes(trimmedQuery)),
      )
    : modules;

  const selected = modules.find((m) => m.id === selectedId) ?? null;
  const selectedIndex = selected ? modules.findIndex((m) => m.id === selected.id) : -1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Aulas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo o conteúdo do mentorado organizado por módulos e tópicos.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar aulas, módulos ou tópicos..."
            className="pl-8"
          />
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <BookOpen className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nenhuma aula publicada ainda</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Assim que o time adicionar módulos e aulas, elas aparecem aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Módulos</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => scrollByCards(-1)}
                className="rounded-full border border-border p-1.5 transition-colors hover:border-primary hover:text-primary"
                aria-label="Módulos anteriores"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollByCards(1)}
                className="rounded-full border border-border p-1.5 transition-colors hover:border-primary hover:text-primary"
                aria-label="Próximos módulos"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div>
            <div
              ref={scrollerRef}
              className="flex gap-4 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {filteredModules.map((module) => {
              const index = modules.findIndex((m) => m.id === module.id);
              const { total } = moduleProgress(module);
              const isSelected = module.id === selectedId;
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => setSelectedId(module.id)}
                  className={cn(
                    "group relative flex h-40 w-64 shrink-0 flex-col justify-end overflow-hidden rounded-xl border p-4 text-left transition-colors",
                    isSelected ? "border-primary" : "border-border hover:border-primary/40",
                  )}
                  style={
                    module.cover_image_url
                      ? {
                          backgroundImage: `url(${module.cover_image_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {!module.cover_image_url && (
                    <div className="absolute inset-0 bg-gradient-to-br from-muted to-card" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
                  {module.locked && (
                    <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs font-medium">
                      <Lock className="size-3" /> {daysUntil(new Date(module.unlocksAt!))}d
                    </span>
                  )}
                  <span className="relative text-xs font-semibold text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="relative truncate text-base font-semibold">{module.title}</span>
                  <span className="relative text-xs text-muted-foreground">
                    {total} aula{total === 1 ? "" : "s"}
                  </span>
                </button>
                );
              })}
            </div>
          </div>

          {selected && <ModuleDetail module={selected} index={selectedIndex} />}
        </>
      )}
    </div>
  );
}

function ModuleDetail({ module, index }: { module: ModuleWithLessons; index: number }) {
  const { total, completed, percent } = moduleProgress(module);
  const nextLesson = module.lessons.find((l) => !l.completed && !l.locked) ?? module.lessons.find((l) => !l.locked);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div
        className="relative flex min-h-72 flex-col justify-end overflow-hidden rounded-2xl border border-border p-6"
        style={
          module.cover_image_url
            ? {
                backgroundImage: `url(${module.cover_image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {!module.cover_image_url && <div className="absolute inset-0 bg-gradient-to-br from-muted to-card" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="relative space-y-3">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Módulo {String(index + 1).padStart(2, "0")}
          </p>
          <h2 className="font-heading text-3xl font-semibold">{module.title}</h2>
          {total > 0 && (
            <div className="max-w-xs space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{percent}% concluído</p>
            </div>
          )}
          {module.description && (
            <p className="max-w-md text-sm text-muted-foreground">{module.description}</p>
          )}
          {module.locked ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-4 py-2 text-sm font-semibold text-muted-foreground">
              <Lock className="size-4" />
              Libera em {daysUntil(new Date(module.unlocksAt!))} dia
              {daysUntil(new Date(module.unlocksAt!)) === 1 ? "" : "s"}
            </span>
          ) : (
            nextLesson && (
              <Link
                href={`/agendar/aulas/${module.id}/${nextLesson.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <CirclePlay className="size-4" />
                {completed > 0 ? "Continuar assistindo" : "Começar"}
              </Link>
            )
          )}
        </div>
      </div>

      <div className="max-h-96 space-y-1.5 overflow-y-auto rounded-2xl border border-border bg-card p-2">
        {module.lessons.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma aula nesse módulo ainda.</p>
        ) : (
          module.lessons.map((lesson, i) => <LessonListRow key={lesson.id} lesson={lesson} moduleId={module.id} index={i} />)
        )}
      </div>
    </div>
  );
}

function LessonListRow({
  lesson,
  moduleId,
  index,
}: {
  lesson: LessonWithProgress;
  moduleId: string;
  index: number;
}) {
  if (lesson.locked) {
    const days = daysUntil(new Date(lesson.unlocksAt!));
    return (
      <div className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 opacity-60">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{lesson.title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          Libera em {days} dia{days === 1 ? "" : "s"}
        </span>
        <Lock className="size-4 shrink-0 text-muted-foreground" />
      </div>
    );
  }

  return (
    <Link
      href={`/agendar/aulas/${moduleId}/${lesson.id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{lesson.title}</span>
      {lesson.duration_label && <span className="shrink-0 text-xs text-muted-foreground">{lesson.duration_label}</span>}
      {lesson.completed ? (
        <BadgeCheck className="size-4 shrink-0 text-success" />
      ) : (
        <PlayCircle className="size-4 shrink-0 text-muted-foreground" />
      )}
    </Link>
  );
}
