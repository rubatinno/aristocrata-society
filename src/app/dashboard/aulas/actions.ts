"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { startViewAsMentee } from "@/app/agendar/mentee-actions";
import type { AppSettings, CourseLesson, CourseLessonMaterial, CourseModule } from "@/lib/types";

function revalidateAulas() {
  revalidatePath("/dashboard/aulas");
  revalidatePath("/agendar/aulas");
}

/** Aulas são as mesmas pra todo mentorado (sem trava por plano) — não
 * importa qual conta é usada pra "ver como aluno", então pega a primeira
 * disponível só pra abrir a visão de mentorado real. */
export async function viewAulasAsMentee() {
  const supabase = await requireAdmin();

  const { data } = await supabase.from("mentee_profiles").select("id").limit(1).maybeSingle();
  if (!data) throw new Error("Nenhum mentorado cadastrado ainda pra visualizar.");

  await startViewAsMentee(data.id, "/agendar/aulas");
}

export async function getAulasLockSetting(): Promise<Pick<AppSettings, "aulas_locked" | "aulas_locked_message">> {
  const supabase = await requireAdmin();

  const { data } = await supabase
    .from("app_settings")
    .select("aulas_locked, aulas_locked_message")
    .eq("id", 1)
    .maybeSingle();

  return {
    aulas_locked: data?.aulas_locked ?? true,
    aulas_locked_message: data?.aulas_locked_message ?? "As Aulas estão sendo Gravadas. Em breve serão disponibilizadas.",
  };
}

export async function setAulasLocked(locked: boolean) {
  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, aulas_locked: locked, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) throw new Error("Não foi possível atualizar a liberação das aulas.");

  revalidateAulas();
}

export interface ModuleInput {
  title: string;
  description: string;
  coverImageUrl: string;
}

export async function createModule(input: ModuleInput) {
  const supabase = await requireAdmin();

  if (!input.title.trim()) throw new Error("Informe o nome do módulo.");

  const { data: last } = await supabase
    .from("course_modules")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("course_modules")
    .insert({
      title: input.title.trim(),
      description: input.description.trim() || null,
      cover_image_url: input.coverImageUrl.trim() || null,
      position: (last?.position ?? -1) + 1,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("Não foi possível criar o módulo.");

  revalidateAulas();
  return data as CourseModule;
}

export async function updateModule(id: string, patch: Partial<ModuleInput>) {
  const supabase = await requireAdmin();

  const dbPatch: Partial<CourseModule> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title.trim() || "Novo módulo";
  if (patch.description !== undefined) dbPatch.description = patch.description.trim() || null;
  if (patch.coverImageUrl !== undefined) dbPatch.cover_image_url = patch.coverImageUrl.trim() || null;

  const { error } = await supabase.from("course_modules").update(dbPatch).eq("id", id);
  if (error) throw new Error("Não foi possível salvar o módulo.");

  revalidateAulas();
}

export async function moveModule(id: string, direction: "up" | "down") {
  const supabase = await requireAdmin();

  const { data: modules } = await supabase
    .from("course_modules")
    .select("id, position")
    .order("position", { ascending: true });

  const list = modules ?? [];
  const index = list.findIndex((m) => m.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= list.length) return;

  const current = list[index];
  const swap = list[swapIndex];

  await Promise.all([
    supabase.from("course_modules").update({ position: swap.position }).eq("id", current.id),
    supabase.from("course_modules").update({ position: current.position }).eq("id", swap.id),
  ]);

  revalidateAulas();
}

export async function deleteModule(id: string) {
  const supabase = await requireAdmin();

  const { error } = await supabase.from("course_modules").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover o módulo.");

  revalidateAulas();
}

export interface LessonInput {
  title: string;
  videoUrl: string;
  durationLabel: string;
}

export async function createLesson(moduleId: string, input: LessonInput) {
  const supabase = await requireAdmin();

  if (!input.title.trim()) throw new Error("Informe o nome da aula.");

  const { data: last } = await supabase
    .from("course_lessons")
    .select("position")
    .eq("module_id", moduleId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("course_lessons")
    .insert({
      module_id: moduleId,
      title: input.title.trim(),
      video_url: input.videoUrl.trim() || null,
      duration_label: input.durationLabel.trim() || null,
      position: (last?.position ?? -1) + 1,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("Não foi possível criar a aula.");

  revalidateAulas();
  return data as CourseLesson;
}

export async function updateLesson(id: string, patch: Partial<LessonInput>) {
  const supabase = await requireAdmin();

  const dbPatch: Partial<CourseLesson> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title.trim() || "Nova aula";
  if (patch.videoUrl !== undefined) dbPatch.video_url = patch.videoUrl.trim() || null;
  if (patch.durationLabel !== undefined) dbPatch.duration_label = patch.durationLabel.trim() || null;

  const { error } = await supabase.from("course_lessons").update(dbPatch).eq("id", id);
  if (error) throw new Error("Não foi possível salvar a aula.");

  revalidateAulas();
}

export async function moveLesson(id: string, moduleId: string, direction: "up" | "down") {
  const supabase = await requireAdmin();

  const { data: lessons } = await supabase
    .from("course_lessons")
    .select("id, position")
    .eq("module_id", moduleId)
    .order("position", { ascending: true });

  const list = lessons ?? [];
  const index = list.findIndex((l) => l.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= list.length) return;

  const current = list[index];
  const swap = list[swapIndex];

  await Promise.all([
    supabase.from("course_lessons").update({ position: swap.position }).eq("id", current.id),
    supabase.from("course_lessons").update({ position: current.position }).eq("id", swap.id),
  ]);

  revalidateAulas();
}

export async function deleteLesson(id: string) {
  const supabase = await requireAdmin();

  const { error } = await supabase.from("course_lessons").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover a aula.");

  revalidateAulas();
}

export async function listLessonMaterials(lessonId: string): Promise<CourseLessonMaterial[]> {
  const supabase = await requireAdmin();

  const { data } = await supabase
    .from("course_lesson_materials")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: true });

  return (data as CourseLessonMaterial[]) ?? [];
}

/** Recebe o arquivo direto (PDF, etc.), sobe pro bucket "lesson-materials"
 * e registra a linha — tudo num só passo pro admin. */
export async function uploadLessonMaterial(formData: FormData) {
  const supabase = await requireAdmin();

  const lessonId = String(formData.get("lessonId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file");

  if (!lessonId) throw new Error("Aula não encontrada.");
  if (!title) throw new Error("Informe um nome pro material.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo.");

  const { data: last } = await supabase
    .from("course_lesson_materials")
    .select("position")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${lessonId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from("lesson-materials").upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) throw new Error("Não foi possível enviar o arquivo.");

  const { data: publicUrl } = supabase.storage.from("lesson-materials").getPublicUrl(path);

  const { data, error } = await supabase
    .from("course_lesson_materials")
    .insert({
      lesson_id: lessonId,
      title,
      file_url: publicUrl.publicUrl,
      position: (last?.position ?? -1) + 1,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("Não foi possível salvar o material.");

  revalidateAulas();
  return data as CourseLessonMaterial;
}

export async function deleteLessonMaterial(id: string, fileUrl: string) {
  const supabase = await requireAdmin();

  const marker = "/lesson-materials/";
  const markerIndex = fileUrl.indexOf(marker);
  if (markerIndex !== -1) {
    const path = fileUrl.slice(markerIndex + marker.length);
    await supabase.storage.from("lesson-materials").remove([path]);
  }

  const { error } = await supabase.from("course_lesson_materials").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover o material.");

  revalidateAulas();
}

export interface AdminModuleWithLessons extends CourseModule {
  lessons: CourseLesson[];
}

export async function listAllModulesWithLessons(): Promise<AdminModuleWithLessons[]> {
  const supabase = await requireAdmin();

  const [{ data: modules }, { data: lessons }] = await Promise.all([
    supabase.from("course_modules").select("*").order("position", { ascending: true }),
    supabase.from("course_lessons").select("*").order("position", { ascending: true }),
  ]);

  const lessonsByModule = new Map<string, CourseLesson[]>();
  for (const lesson of (lessons as CourseLesson[]) ?? []) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push(lesson);
    lessonsByModule.set(lesson.module_id, list);
  }

  return ((modules as CourseModule[]) ?? []).map((module) => ({
    ...module,
    lessons: lessonsByModule.get(module.id) ?? [],
  }));
}
