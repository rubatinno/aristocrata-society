import { redirect } from "next/navigation";
import { getMenteeSession } from "@/app/agendar/mentee-actions";
import { listMenteeGoals } from "@/app/agendar/progresso/actions";
import { GoalsWorkspace } from "@/components/mentee-area/goals-workspace";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/setup-notice";

export default async function ProgressoPage() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const session = await getMenteeSession();
  if (!session) {
    redirect("/login?next=/agendar/progresso");
  }

  const goals = await listMenteeGoals(session.userId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight">Progresso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          As etapas da sua mentoria, definidas pelo seu mentor.
        </p>
      </div>
      <GoalsWorkspace
        initialGoals={goals}
        menteeId={session.userId}
        revalidateTarget="/agendar/progresso"
        canManage={false}
        className="px-0"
      />
    </div>
  );
}
