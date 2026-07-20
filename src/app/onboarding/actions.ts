"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";

export interface OnboardingState {
  status: "idle" | "error";
  message?: string;
}

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const slug = slugify(rawSlug);
  const timezone = String(formData.get("timezone") ?? "America/Sao_Paulo");
  const sessionDuration = Number(formData.get("session_duration_minutes") ?? 30);
  const bufferMinutes = Number(formData.get("buffer_minutes") ?? 10);

  if (!fullName) return { status: "error", message: "Informe seu nome." };
  if (!slug || slug.length < 3) {
    return { status: "error", message: "Escolha um link com pelo menos 3 caracteres." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      slug,
      timezone,
      session_duration_minutes: sessionDuration,
      buffer_minutes: bufferMinutes,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "Esse link já está em uso, escolha outro." };
    }
    return { status: "error", message: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
