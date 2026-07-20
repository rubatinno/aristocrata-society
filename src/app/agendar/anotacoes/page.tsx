import { redirect } from "next/navigation";
import { getMenteeSession } from "@/app/agendar/mentee-actions";
import { listMenteeNotes } from "@/app/agendar/anotacoes/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { NotesWorkspace } from "@/components/mentee-area/notes-workspace";

export default async function MenteeNotesPage() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const session = await getMenteeSession();
  if (!session) {
    redirect("/login?next=/agendar/anotacoes");
  }

  const notes = await listMenteeNotes(session.userId);

  return (
    <NotesWorkspace
      initialNotes={notes}
      menteeId={session.userId}
      revalidateTarget="/agendar/anotacoes"
      className="h-[calc(100vh-4rem)]"
    />
  );
}
