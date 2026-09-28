"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createLesson,
  createModule,
  deleteLesson,
  deleteLessonMaterial,
  deleteModule,
  listLessonMaterials,
  moveLesson,
  moveModule,
  updateLesson,
  updateModule,
  uploadLessonMaterial,
  type AdminModuleWithLessons,
  type LessonInput,
  type ModuleInput,
} from "@/app/dashboard/aulas/actions";
import type { CourseLesson, CourseLessonMaterial } from "@/lib/types";
import { extractEmbedSrc } from "@/lib/video-embed";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Lock,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

const DEFAULT_UNLOCK_DAYS = 7;

export function AulasAdminView({ initialModules }: { initialModules: AdminModuleWithLessons[] }) {
  const [modules, setModules] = useState(initialModules);
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(initialModules[0]?.id ?? null);

  async function handleCreateModule(input: ModuleInput) {
    try {
      const created = await createModule(input);
      setModules((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, { ...created, lessons: [] }]));
      setExpandedId(created.id);
      setIsModuleDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o módulo.");
    }
  }

  function patchModule(id: string, patch: Partial<AdminModuleWithLessons>) {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function handleDeleteModule(module: AdminModuleWithLessons) {
    if (
      !window.confirm(
        `Remover o módulo "${module.title}"? Isso apaga todas as ${module.lessons.length} aula(s) dentro dele — nenhum mentorado vai mais ver esse conteúdo. Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setModules((prev) => prev.filter((m) => m.id !== module.id));
    deleteModule(module.id).catch(() => toast.error("Não foi possível remover o módulo."));
  }

  function handleMoveModule(id: string, direction: "up" | "down") {
    const sorted = [...modules].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((m) => m.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[swapIndex];
    setModules((prev) =>
      prev.map((m) => {
        if (m.id === a.id) return { ...m, position: b.position };
        if (m.id === b.id) return { ...m, position: a.position };
        return m;
      }),
    );
    moveModule(id, direction).catch(() => toast.error("Não foi possível reordenar."));
  }

  function setLessonsForModule(moduleId: string, updater: (lessons: CourseLesson[]) => CourseLesson[]) {
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, lessons: updater(m.lessons) } : m)));
  }

  const sortedModules = [...modules].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {modules.length} módulo{modules.length === 1 ? "" : "s"} · {modules.reduce((sum, m) => sum + m.lessons.length, 0)}{" "}
          aula{modules.reduce((sum, m) => sum + m.lessons.length, 0) === 1 ? "" : "s"} no total
        </p>
        <Button type="button" onClick={() => setIsModuleDialogOpen(true)} className="gap-1.5">
          <Plus className="size-3.5" /> Novo módulo
        </Button>
      </div>

      <ModuleDialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen} onSave={handleCreateModule} />

      {sortedModules.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
          <BookOpen className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nenhum módulo ainda</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Crie o primeiro módulo pra começar a montar a central de aulas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedModules.map((module, index) => (
            <ModuleCard
              key={module.id}
              module={module}
              index={index}
              isFirst={index === 0}
              isLast={index === sortedModules.length - 1}
              isExpanded={expandedId === module.id}
              onToggle={() => setExpandedId((prev) => (prev === module.id ? null : module.id))}
              onPatch={(patch) => patchModule(module.id, patch)}
              onDelete={() => handleDeleteModule(module)}
              onMove={(dir) => handleMoveModule(module.id, dir)}
              setLessons={(updater) => setLessonsForModule(module.id, updater)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleDialog({
  open,
  onOpenChange,
  onSave,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: ModuleInput) => Promise<void>;
  initial?: ModuleInput;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.coverImageUrl ?? "");
  const [isLocked, setIsLocked] = useState((initial?.unlockAfterDays ?? null) !== null);
  const [unlockDays, setUnlockDays] = useState(initial?.unlockAfterDays ?? DEFAULT_UNLOCK_DAYS);
  const [isSaving, setIsSaving] = useState(false);

  function handleSubmit() {
    if (!title.trim()) return;
    setIsSaving(true);
    onSave({ title, description, coverImageUrl, unlockAfterDays: isLocked ? unlockDays : null }).finally(() =>
      setIsSaving(false),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) {
          setTitle(initial?.title ?? "");
          setDescription(initial?.description ?? "");
          setCoverImageUrl(initial?.coverImageUrl ?? "");
          setIsLocked((initial?.unlockAfterDays ?? null) !== null);
          setUnlockDays(initial?.unlockAfterDays ?? DEFAULT_UNLOCK_DAYS);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {initial ? "Editar módulo" : "Novo módulo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do módulo</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Fundamentos"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que o mentorado vai aprender nesse módulo"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Link da imagem de capa (opcional)</Label>
            <Input
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2 rounded-xl border border-border/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" /> Bloquear módulo por dias
              </Label>
              <Switch checked={isLocked} onCheckedChange={setIsLocked} size="sm" />
            </div>
            {isLocked && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={unlockDays}
                  onChange={(e) => setUnlockDays(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  dias após o registro do mentorado (todas as aulas dele ficam travadas até lá)
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSaving || !title.trim()} className="gap-1.5">
            {isSaving && <Loader2 className="size-3.5 animate-spin" />}
            {initial ? "Salvar" : "Criar módulo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModuleCard({
  module,
  index,
  isFirst,
  isLast,
  isExpanded,
  onToggle,
  onPatch,
  onDelete,
  onMove,
  setLessons,
}: {
  module: AdminModuleWithLessons;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<AdminModuleWithLessons>) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
  setLessons: (updater: (lessons: CourseLesson[]) => CourseLesson[]) => void;
}) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLessonDialogOpen, setIsLessonDialogOpen] = useState(false);

  async function handleSaveEdit(input: ModuleInput) {
    onPatch({
      title: input.title,
      description: input.description || null,
      cover_image_url: input.coverImageUrl || null,
      unlock_after_days: input.unlockAfterDays,
    });
    try {
      await updateModule(module.id, input);
      setIsEditDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  async function handleCreateLesson(input: LessonInput) {
    try {
      const lesson = await createLesson(module.id, input);
      setLessons((prev) => (prev.some((l) => l.id === lesson.id) ? prev : [...prev, lesson]));
      setIsLessonDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a aula.");
    }
  }

  function patchLesson(id: string, patch: Partial<CourseLesson>) {
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function handleDeleteLesson(lesson: CourseLesson) {
    if (!window.confirm(`Remover a aula "${lesson.title}"? Essa ação não pode ser desfeita.`)) return;
    setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
    deleteLesson(lesson.id).catch(() => toast.error("Não foi possível remover a aula."));
  }

  function handleMoveLesson(id: string, direction: "up" | "down") {
    const sorted = [...module.lessons].sort((a, b) => a.position - b.position);
    const lessonIndex = sorted.findIndex((l) => l.id === id);
    const swapIndex = direction === "up" ? lessonIndex - 1 : lessonIndex + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;
    const a = sorted[lessonIndex];
    const b = sorted[swapIndex];
    setLessons((prev) =>
      prev.map((l) => {
        if (l.id === a.id) return { ...l, position: b.position };
        if (l.id === b.id) return { ...l, position: a.position };
        return l;
      }),
    );
    moveLesson(id, module.id, direction).catch(() => toast.error("Não foi possível reordenar."));
  }

  const sortedLessons = [...module.lessons].sort((a, b) => a.position - b.position);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {isExpanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{module.title}</span>
          {module.unlock_after_days !== null && (
            <span
              className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
              title={`Libera ${module.unlock_after_days} dia(s) após o registro do mentorado`}
            >
              <Lock className="size-3" /> {module.unlock_after_days}d
            </span>
          )}
          <span className="shrink-0 text-xs text-muted-foreground">
            {module.lessons.length} aula{module.lessons.length === 1 ? "" : "s"}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove("up")}
            disabled={isFirst}
            className="text-muted-foreground hover:text-foreground"
            title="Mover pra cima"
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove("down")}
            disabled={isLast}
            className="text-muted-foreground hover:text-foreground"
            title="Mover pra baixo"
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsEditDialogOpen(true)}
            className="text-muted-foreground hover:text-foreground"
            title="Editar módulo"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            title="Remover módulo"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <ModuleDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={handleSaveEdit}
        initial={{
          title: module.title,
          description: module.description ?? "",
          coverImageUrl: module.cover_image_url ?? "",
          unlockAfterDays: module.unlock_after_days,
        }}
      />

      {isExpanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {sortedLessons.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma aula nesse módulo ainda.</p>
          ) : (
            sortedLessons.map((lesson, i) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                index={i}
                isFirst={i === 0}
                isLast={i === sortedLessons.length - 1}
                onPatch={(patch) => patchLesson(lesson.id, patch)}
                onDelete={() => handleDeleteLesson(lesson)}
                onMove={(dir) => handleMoveLesson(lesson.id, dir)}
              />
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsLessonDialogOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-3.5" /> Nova aula
          </Button>
          <LessonDialog open={isLessonDialogOpen} onOpenChange={setIsLessonDialogOpen} onSave={handleCreateLesson} />
        </div>
      )}
    </div>
  );
}

function LessonDialog({
  open,
  onOpenChange,
  onSave,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: LessonInput) => Promise<void>;
  initial?: LessonInput;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [durationLabel, setDurationLabel] = useState(initial?.durationLabel ?? "");
  const [isLocked, setIsLocked] = useState((initial?.unlockAfterDays ?? null) !== null);
  const [unlockDays, setUnlockDays] = useState(initial?.unlockAfterDays ?? DEFAULT_UNLOCK_DAYS);
  const [isSaving, setIsSaving] = useState(false);

  function handleSubmit() {
    if (!title.trim()) return;
    setIsSaving(true);
    onSave({
      title,
      videoUrl: extractEmbedSrc(videoUrl),
      durationLabel,
      unlockAfterDays: isLocked ? unlockDays : null,
    }).finally(() => setIsSaving(false));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) {
          setTitle(initial?.title ?? "");
          setVideoUrl(initial?.videoUrl ?? "");
          setDurationLabel(initial?.durationLabel ?? "");
          setIsLocked((initial?.unlockAfterDays ?? null) !== null);
          setUnlockDays(initial?.unlockAfterDays ?? DEFAULT_UNLOCK_DAYS);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {initial ? "Editar aula" : "Nova aula"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da aula</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Visão geral do método"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Link do vídeo</Label>
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Link do YouTube, ou cole o embed do Panda Video, VTurb, Vimeo..."
            />
            <p className="text-xs text-muted-foreground">
              Pode colar o link direto ou o código de incorporação (&lt;iframe&gt;) inteiro — a gente extrai o link
              sozinho.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Duração (opcional)</Label>
            <Input
              value={durationLabel}
              onChange={(e) => setDurationLabel(e.target.value)}
              placeholder="Ex: 18:24"
            />
          </div>
          <div className="space-y-2 rounded-xl border border-border/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" /> Bloquear aula por dias
              </Label>
              <Switch checked={isLocked} onCheckedChange={setIsLocked} size="sm" />
            </div>
            {isLocked && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={unlockDays}
                  onChange={(e) => setUnlockDays(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">dias após o registro do mentorado</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSaving || !title.trim()} className="gap-1.5">
            {isSaving && <Loader2 className="size-3.5 animate-spin" />}
            {initial ? "Salvar" : "Criar aula"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LessonRow({
  lesson,
  index,
  isFirst,
  isLast,
  onPatch,
  onDelete,
  onMove,
}: {
  lesson: CourseLesson;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onPatch: (patch: Partial<CourseLesson>) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function handleSaveEdit(input: LessonInput) {
    onPatch({
      title: input.title,
      video_url: input.videoUrl || null,
      duration_label: input.durationLabel || null,
      unlock_after_days: input.unlockAfterDays,
    });
    try {
      await updateLesson(lesson.id, input);
      setIsEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  function handleMove(direction: "up" | "down") {
    startTransition(() => onMove(direction));
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm",
        !lesson.video_url && "border-dashed",
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{lesson.title}</span>
      {!lesson.video_url && <span className="shrink-0 text-xs text-muted-foreground">sem vídeo</span>}
      {lesson.unlock_after_days !== null && (
        <span
          className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
          title={`Libera ${lesson.unlock_after_days} dia(s) após o registro do mentorado`}
        >
          <Lock className="size-3" /> {lesson.unlock_after_days}d
        </span>
      )}
      {lesson.duration_label && (
        <span className="shrink-0 text-xs text-muted-foreground">{lesson.duration_label}</span>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => handleMove("up")}
          disabled={isFirst}
          className="text-muted-foreground hover:text-foreground"
          title="Mover pra cima"
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => handleMove("down")}
          disabled={isLast}
          className="text-muted-foreground hover:text-foreground"
          title="Mover pra baixo"
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsMaterialsOpen(true)}
          className="text-muted-foreground hover:text-foreground"
          title="Materiais da aula"
        >
          <Paperclip className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsEditOpen(true)}
          className="text-muted-foreground hover:text-foreground"
          title="Editar aula"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
          title="Remover aula"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <LessonDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSave={handleSaveEdit}
        initial={{
          title: lesson.title,
          videoUrl: lesson.video_url ?? "",
          durationLabel: lesson.duration_label ?? "",
          unlockAfterDays: lesson.unlock_after_days,
        }}
      />

      <MaterialsDialog
        open={isMaterialsOpen}
        onOpenChange={setIsMaterialsOpen}
        lessonId={lesson.id}
        lessonTitle={lesson.title}
      />
    </div>
  );
}

function MaterialsDialog({
  open,
  onOpenChange,
  lessonId,
  lessonTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string;
  lessonTitle: string;
}) {
  const [materials, setMaterials] = useState<CourseLessonMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function loadMaterials() {
    setIsLoading(true);
    try {
      setMaterials(await listLessonMaterials(lessonId));
    } catch {
      toast.error("Não foi possível carregar os materiais.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) {
      setTitle("");
      setFile(null);
      void loadMaterials();
    }
  }

  async function handleUpload() {
    if (!title.trim() || !file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("lessonId", lessonId);
      formData.set("title", title.trim());
      formData.set("file", file);
      const created = await uploadLessonMaterial(formData);
      setMaterials((prev) => [...prev, created]);
      setTitle("");
      setFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o material.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(material: CourseLessonMaterial) {
    if (!window.confirm(`Remover "${material.title}"? Essa ação não pode ser desfeita.`)) return;
    setMaterials((prev) => prev.filter((m) => m.id !== material.id));
    try {
      await deleteLessonMaterial(material.id, material.file_url);
    } catch {
      toast.error("Não foi possível remover o material.");
      void loadMaterials();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="size-4 text-primary" />
            Materiais — {lessonTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : materials.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">Nenhum material anexado ainda.</p>
          ) : (
            <div className="space-y-1.5">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm"
                >
                  <FileText className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-medium">{material.title}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(material)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remover material"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
            <Label>Novo material</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Apostila da aula" />
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button
              type="button"
              size="sm"
              onClick={handleUpload}
              disabled={isUploading || !title.trim() || !file}
              className="w-full gap-1.5"
            >
              {isUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              Enviar material
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
