"use server";

import { createClient } from "@/lib/supabase/server";
import { getMenteeSession } from "@/app/agendar/mentee-actions";
import { computeUnlockDate } from "@/lib/drip";
import type { CourseLesson, CourseLessonMaterial, CourseModule, MenteeLessonProgress } from "@/lib/types";

export interface LessonWithProgress extends CourseLesson {
  completed: boolean;
  bookmarked: boolean;
  materials: CourseLessonMaterial[];
  locked: boolean;
  unlocksAt: string | null;
}

export interface ModuleWithLessons extends CourseModule {
  lessons: LessonWithProgress[];
  locked: boolean;
  unlocksAt: string | null;
}

const DEFAULT_LOCK_MESSAGE = "As Aulas estão sendo Gravadas. Em breve serão disponibilizadas.";

/** Trava global das Aulas enquanto o conteúdo ainda está sendo gravado —
 * se a tabela/linha não existir ainda (migração não rodada) ou a leitura
 * falhar, assume travado (fail-safe fechado). */
export async function getAulasLock(): Promise<{ locked: boolean; message: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("aulas_locked, aulas_locked_message")
    .eq("id", 1)
    .maybeSingle();

  return {
    locked: data?.aulas_locked ?? true,
    message: data?.aulas_locked_message ?? DEFAULT_LOCK_MESSAGE,
  };
}

/**
 * Todo mundo com sessão de mentorado enxerga o conteúdo inteiro — RLS de
 * course_modules/course_lessons libera select pra qualquer mentorado ou
 * mentor logado (não tem trava por plano, de propósito).
 */
export async function listCourseContent(): Promise<ModuleWithLessons[]> {
  const session = await getMenteeSession();
  if (!session) return [];

  const supabase = await createClient();

  const [{ data: modules }, { data: lessons }, { data: progress }, { data: materials }] = await Promise.all([
    supabase.from("course_modules").select("*").order("position", { ascending: true }),
    supabase.from("course_lessons").select("*").order("position", { ascending: true }),
    supabase.from("mentee_lesson_progress").select("*").eq("mentee_id", session.userId),
    supabase.from("course_lesson_materials").select("*").order("position", { ascending: true }),
  ]);

  const progressByLesson = new Map<string, MenteeLessonProgress>();
  for (const row of (progress as MenteeLessonProgress[]) ?? []) {
    progressByLesson.set(row.lesson_id, row);
  }

  const materialsByLesson = new Map<string, CourseLessonMaterial[]>();
  for (const material of (materials as CourseLessonMaterial[]) ?? []) {
    const list = materialsByLesson.get(material.lesson_id) ?? [];
    list.push(material);
    materialsByLesson.set(material.lesson_id, list);
  }

  const registeredAt = session.profile?.created_at ?? new Date().toISOString();
  const now = Date.now();

  const lessonsByModule = new Map<string, LessonWithProgress[]>();
  for (const lesson of (lessons as CourseLesson[]) ?? []) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    const p = progressByLesson.get(lesson.id);
    const unlockDate = computeUnlockDate(registeredAt, lesson.unlock_after_days);
    list.push({
      ...lesson,
      completed: p?.completed ?? false,
      bookmarked: p?.bookmarked ?? false,
      materials: materialsByLesson.get(lesson.id) ?? [],
      locked: unlockDate !== null && unlockDate.getTime() > now,
      unlocksAt: unlockDate?.toISOString() ?? null,
    });
    lessonsByModule.set(lesson.module_id, list);
  }

  return ((modules as CourseModule[]) ?? []).map((module) => {
    const moduleUnlockDate = computeUnlockDate(registeredAt, module.unlock_after_days);
    const moduleLocked = moduleUnlockDate !== null && moduleUnlockDate.getTime() > now;
    const lessons = (lessonsByModule.get(module.id) ?? []).map((lesson) => ({
      ...lesson,
      // Trava do módulo vale pra todas as aulas dele, além da trava
      // individual que cada aula já pode ter.
      locked: lesson.locked || moduleLocked,
      unlocksAt:
        moduleLocked && (!lesson.unlocksAt || moduleUnlockDate! > new Date(lesson.unlocksAt))
          ? moduleUnlockDate!.toISOString()
          : lesson.unlocksAt,
    }));

    return {
      ...module,
      lessons,
      locked: moduleLocked,
      unlocksAt: moduleUnlockDate?.toISOString() ?? null,
    };
  });
}

/**
 * Escrita é sempre em nome do próprio mentorado (auth.uid() = mentee_id na
 * RLS) — desabilitada no modo "visualizar como mentorado" pra não marcar
 * progresso de outra pessoa em nome do admin.
 */
async function requireOwnMenteeSession() {
  const session = await getMenteeSession();
  if (!session) throw new Error("Não autenticado.");
  if (session.impersonating) {
    throw new Error("Ações estão desabilitadas no modo de visualização como mentorado.");
  }
  return session;
}

export async function toggleLessonCompleted(lessonId: string, completed: boolean) {
  const session = await requireOwnMenteeSession();
  const supabase = await createClient();

  const { error } = await supabase.from("mentee_lesson_progress").upsert(
    {
      mentee_id: session.userId,
      lesson_id: lessonId,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "mentee_id,lesson_id" },
  );

  if (error) throw new Error("Não foi possível atualizar a aula.");
}

export async function toggleLessonBookmark(lessonId: string, bookmarked: boolean) {
  const session = await requireOwnMenteeSession();
  const supabase = await createClient();

  const { error } = await supabase.from("mentee_lesson_progress").upsert(
    { mentee_id: session.userId, lesson_id: lessonId, bookmarked, updated_at: new Date().toISOString() },
    { onConflict: "mentee_id,lesson_id" },
  );

  if (error) throw new Error("Não foi possível salvar.");
}
