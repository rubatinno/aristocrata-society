"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";

export interface SettingsState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function updateProfile(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "error", message: "Sessão expirada, faça login novamente." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? ""));
  const timezone = String(formData.get("timezone") ?? "America/Sao_Paulo");
  const meetingLocation = String(formData.get("meeting_location") ?? "").trim();
  const bookingInstructions = String(formData.get("booking_instructions") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim();
  const sessionDuration = Number(formData.get("session_duration_minutes") ?? 30);
  const bufferMinutes = Number(formData.get("buffer_minutes") ?? 10);
  const bookingWindowDays = Number(formData.get("booking_window_days") ?? 45);
  const minNoticeHours = Number(formData.get("min_notice_hours") ?? 1);

  if (!fullName) return { status: "error", message: "Informe seu nome." };
  if (!slug || slug.length < 3) {
    return { status: "error", message: "Escolha um link com pelo menos 3 caracteres." };
  }
  if (!Number.isFinite(bookingWindowDays) || bookingWindowDays < 1 || bookingWindowDays > 365) {
    return { status: "error", message: "A antecedência máxima deve ser entre 1 e 365 dias." };
  }
  if (!Number.isFinite(minNoticeHours) || minNoticeHours < 0 || minNoticeHours > 168) {
    return { status: "error", message: "A antecedência mínima deve ser entre 0 e 168 horas." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      headline: headline || null,
      slug,
      timezone,
      meeting_location: meetingLocation || null,
      booking_instructions: bookingInstructions || null,
      avatar_url: avatarUrl || null,
      session_duration_minutes: sessionDuration,
      buffer_minutes: bufferMinutes,
      booking_window_days: bookingWindowDays,
      min_notice_hours: minNoticeHours,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "Esse link já está em uso, escolha outro." };
    }
    return { status: "error", message: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard");
  revalidatePath("/agendar");

  return { status: "success", message: "Configurações salvas." };
}
