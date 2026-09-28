import { redirect } from "next/navigation";
import { getMenteeSession } from "@/app/agendar/mentee-actions";
import { getAulasLock, listCourseContent } from "@/app/agendar/aulas/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { AulasWorkspace } from "@/components/mentee-area/aulas-workspace";
import { AulasLockedNotice } from "@/components/mentee-area/aulas-locked-notice";

export default async function MenteeAulasPage() {
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

  const modules = await listCourseContent();

  return (
    <div className="px-4 py-6 sm:px-6">
      <AulasWorkspace modules={modules} />
    </div>
  );
}
