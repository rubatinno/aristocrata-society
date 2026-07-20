"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Weekday } from "@/lib/types";

export interface AvailabilityRuleInput {
  weekday: Weekday;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export async function saveAvailability(rules: AvailabilityRuleInput[], enabled: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autenticado.");

  const validRows = rules.filter(
    (rule) => rule.is_active && rule.start_time < rule.end_time,
  );

  const [{ error: deleteError }, { error: profileError }] = await Promise.all([
    supabase.from("availability_rules").delete().eq("mentor_id", user.id),
    supabase.from("profiles").update({ recurring_enabled: enabled }).eq("id", user.id),
  ]);

  if (deleteError || profileError) throw new Error("Não foi possível salvar a disponibilidade.");

  if (validRows.length > 0) {
    const { error: insertError } = await supabase.from("availability_rules").insert(
      validRows.map((rule) => ({
        mentor_id: user.id,
        weekday: rule.weekday,
        start_time: rule.start_time,
        end_time: rule.end_time,
        is_active: true,
      })),
    );

    if (insertError) throw new Error("Não foi possível salvar a disponibilidade.");
  }

  revalidatePath("/dashboard/disponibilidade");
  revalidatePath("/agendar");
}
