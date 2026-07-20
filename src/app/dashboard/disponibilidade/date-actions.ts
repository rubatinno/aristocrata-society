"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";

export interface DateOverrideInput {
  date: string; // yyyy-MM-dd
  start_time: string;
  end_time: string;
}

export async function saveDateOverrides(overrides: DateOverrideInput[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autenticado.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone || "America/Sao_Paulo";

  const validRows = overrides.filter((o) => o.date && o.start_time < o.end_time);

  // Compara o início de cada horário (já convertido do fuso do mentor pra
  // UTC) contra o instante atual — pega tanto data inteira no passado quanto
  // um horário de hoje que já passou, não só o dia.
  const now = new Date();
  const pastRow = validRows.find(
    (row) => fromZonedTime(`${row.date}T${row.start_time}`, timezone) <= now,
  );
  if (pastRow) {
    const [year, month, day] = pastRow.date.split("-");
    throw new Error(
      `O horário ${pastRow.start_time} de ${day}/${month}/${year} já passou. Remova ou corrija antes de salvar.`,
    );
  }

  const { error: deleteError } = await supabase
    .from("availability_dates")
    .delete()
    .eq("mentor_id", user.id);

  if (deleteError) throw new Error("Não foi possível salvar as datas específicas.");

  if (validRows.length > 0) {
    const { error: insertError } = await supabase.from("availability_dates").insert(
      validRows.map((row) => ({
        mentor_id: user.id,
        date: row.date,
        start_time: row.start_time,
        end_time: row.end_time,
        is_active: true,
      })),
    );

    if (insertError) throw new Error("Não foi possível salvar as datas específicas.");
  }

  revalidatePath("/dashboard/disponibilidade");
  revalidatePath("/agendar");
}
