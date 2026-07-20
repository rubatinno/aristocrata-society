import { DateOverridesEditor } from "@/components/dashboard/date-overrides-editor";
import { requireMentor } from "@/lib/session";
import type { AvailabilityDate } from "@/lib/types";

export default async function DisponibilidadePage() {
  const { supabase, profile } = await requireMentor();

  const { data: dates } = await supabase
    .from("availability_dates")
    .select("*")
    .eq("mentor_id", profile.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Disponibilidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Abra os horários em que você pode receber mentorias. Os horários são exibidos no fuso{" "}
          <span className="font-medium text-foreground">{profile.timezone}</span>.
        </p>
      </div>

      <DateOverridesEditor
        key={(dates as AvailabilityDate[] | null)?.map((d) => d.id).join(",") ?? "empty"}
        initialDates={(dates as AvailabilityDate[]) ?? []}
      />
    </div>
  );
}
