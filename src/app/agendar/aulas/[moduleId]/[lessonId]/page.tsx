import { notFound, redirect } from "next/navigation";
import { getMenteeSession } from "@/app/agendar/mentee-actions";
import { getAulasLock, listCourseContent } from "@/app/agendar/aulas/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { LessonPlayer } from "@/components/mentee-area/lesson-player";
import { AulasLockedNotice } from "@/components/mentee-area/aulas-locked-notice";
import { daysUntil } from "@/lib/drip";

export default async function MenteeLessonPage({
  params,
}: {
  params: Promise<{ moduleId: string; lessonId: string }>;
}) {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const session = await getMenteeSession();
  if (!session) {
    redirect("/login?next=/agendar/aulas");
  }

  const lock = await getAulasLock();
  if (lock.locked) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <AulasLockedNotice message={lock.message} />
      </div>
    );
  }

  const { moduleId, lessonId } = await params;
  const modules = await listCourseContent();
  const courseModule = modules.find((m) => m.id === moduleId);
  const lesson = courseModule?.lessons.find((l) => l.id === lessonId);

  if (!courseModule || !lesson) {
    notFound();
  }

  if (lesson.locked) {
    const days = daysUntil(new Date(lesson.unlocksAt!));
    return (
      <div className="px-4 py-6 sm:px-6">
        <AulasLockedNotice
          message={`Esta aula libera em ${days} dia${days === 1 ? "" : "s"}.`}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <LessonPlayer module={courseModule} lesson={lesson} />
    </div>
  );
}
