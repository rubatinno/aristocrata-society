import { redirect } from "next/navigation";
import { getMenteeIdentity } from "@/lib/mentee-session";
import { listMenteeNotes } from "@/app/agendar/anotacoes/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/setup-notice";
import { NotesWorkspace } from "@/components/mentee-area/notes-workspace";

export default async function MenteeNotesPage() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  // Só o id de quem está logado — vem do header que o proxy já validou, sem
  // uma consulta a mentee_profiles só pra isso.
  const identity = await getMenteeIdentity();
  if (!identity) {
    redirect("/login?next=/agendar/anotacoes");
  }

  const notes = await listMenteeNotes(identity.userId);

  return (
    <NotesWorkspace
      initialNotes={notes}
      menteeId={identity.userId}
      revalidateTarget="/agendar/anotacoes"
      className="h-[calc(100vh-4rem)]"
    />
  );
}
