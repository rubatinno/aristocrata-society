"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { toggleLessonBookmark, toggleLessonCompleted } from "@/app/agendar/aulas/actions";
import type { LessonWithProgress, ModuleWithLessons } from "@/app/agendar/aulas/actions";
import { VideoPlayer } from "@/components/mentee-area/video-player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, BadgeCheck, Bookmark, Check, Download, FileText } from "lucide-react";

export function LessonPlayer({
  module,
  lesson,
}: {
  module: ModuleWithLessons;
  lesson: LessonWithProgress;
}) {
  const [completed, setCompleted] = useState(lesson.completed);
  const [bookmarked, setBookmarked] = useState(lesson.bookmarked);
  const [isPending, startTransition] = useTransition();

  const total = module.lessons.length;
  const completedCount = module.lessons.filter((l) => l.completed).length;
  const index = module.lessons.findIndex((l) => l.id === lesson.id);

  function handleToggleCompleted() {
    const next = !completed;
    setCompleted(next);
    startTransition(async () => {
      try {
        await toggleLessonCompleted(lesson.id, next);
      } catch (e) {
        setCompleted(!next);
        toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
      }
    });
  }

  function handleToggleBookmark() {
    const next = !bookmarked;
    setBookmarked(next);
    toggleLessonBookmark(lesson.id, next).catch((e) => {
      setBookmarked(!next);
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/agendar/aulas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Todos os módulos
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
          <VideoPlayer videoUrl={lesson.video_url} title={lesson.title} />
        </div>

        <div className="flex max-h-[28rem] flex-col rounded-2xl border border-border bg-card lg:max-h-none">
          <div className="border-b border-border p-4">
            <p className="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {module.title}
            </p>
            {total > 0 && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((completedCount / total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {completedCount}/{total}
                </p>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {module.lessons.map((l, i) => (
              <Link
                key={l.id}
                href={`/agendar/aulas/${module.id}/${l.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  l.id === lesson.id ? "bg-primary/10 text-primary" : "hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    l.id === lesson.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.title}</span>
                {l.duration_label && (
                  <span className="shrink-0 text-xs text-muted-foreground">{l.duration_label}</span>
                )}
                {l.completed && <BadgeCheck className="size-4 shrink-0 text-success" />}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 border-t border-border pt-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {module.title} · Aula {index + 1}
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold">{lesson.title}</h1>
          {lesson.duration_label && (
            <p className="mt-1 text-sm text-muted-foreground">{lesson.duration_label}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant={completed ? "outline" : "default"}
            size="sm"
            onClick={handleToggleCompleted}
            disabled={isPending}
            className="gap-1.5"
          >
            <Check className="size-3.5" />
            {completed ? "Concluída" : "Marcar como concluída"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleToggleBookmark}
            title="Favoritar"
          >
            <Bookmark className={cn("size-4", bookmarked && "fill-primary text-primary")} />
          </Button>
        </div>
      </div>

      {lesson.materials.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Materiais da aula
          </p>
          <div className="space-y-2">
            {lesson.materials.map((material) => (
              <a
                key={material.id}
                href={material.file_url}
                target="_blank"
                rel="noreferrer"
                download
                className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <FileText className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-medium">{material.title}</span>
                <Download className="size-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
