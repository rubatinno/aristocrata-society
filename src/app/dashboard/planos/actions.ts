"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export interface PlanFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

function parseOptionalInt(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export async function createPlan(_prevState: PlanFormState, formData: FormData): Promise<PlanFormState> {
  let supabase;
  try {
    supabase = await requireAdmin();
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Não autorizado." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { status: "error", message: "Dê um nome para o plano." };

  const { error } = await supabase.from("plans").insert({
    name,
    calls_per_week: parseOptionalInt(formData.get("calls_per_week")),
    calls_per_month: parseOptionalInt(formData.get("calls_per_month")),
    total_calls: parseOptionalInt(formData.get("total_calls")),
    duration_days: parseOptionalInt(formData.get("duration_days")),
  });

  if (error) return { status: "error", message: "Não foi possível criar o plano." };

  revalidatePath("/dashboard/planos");
  return { status: "success", message: "Plano criado." };
}

export async function deletePlan(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover o plano.");
  revalidatePath("/dashboard/planos");
}
