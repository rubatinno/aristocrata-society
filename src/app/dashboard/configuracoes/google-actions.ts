"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildGoogleAuthUrl } from "@/lib/google-calendar";

export async function connectGoogleCalendar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autenticado.");

  redirect(buildGoogleAuthUrl(user.id));
}

export async function disconnectGoogleCalendar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autenticado.");

  const admin = createAdminClient();
  await admin.from("mentor_google_tokens").delete().eq("mentor_id", user.id);
  await admin.from("profiles").update({ google_calendar_connected: false }).eq("id", user.id);

  revalidatePath("/dashboard/configuracoes");
}
