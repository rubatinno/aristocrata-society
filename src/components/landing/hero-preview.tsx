import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Video } from "lucide-react";

const mentors = [
  { initials: "AS", name: "Alexandre Silva", active: true },
  { initials: "CM", name: "Camila Moraes", active: false },
];

const days = [
  { label: "Seg", num: 12, active: false },
  { label: "Ter", num: 13, active: true },
  { label: "Qua", num: 14, active: false },
  { label: "Qui", num: 15, active: false },
  { label: "Sex", num: 16, active: false },
];

const times = ["09:00", "09:30", "10:30", "14:00", "14:30"];

export function HeroPreview() {
  return (
    <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl shadow-primary/10 sm:max-w-md sm:p-6">
      <p className="mb-2.5 text-xs font-medium text-muted-foreground">Escolha seu mentor</p>
      <div className="flex gap-2">
        {mentors.map((mentor) => (
          <div
            key={mentor.name}
            className={`flex flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 text-xs ${
              mentor.active ? "border-primary bg-accent" : "border-border"
            }`}
          >
            <Avatar className="size-7 border border-border" size="sm">
              <AvatarFallback className="bg-primary text-[10px] font-semibold text-primary-foreground">
                {mentor.initials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium">{mentor.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
        Sessão de 30 min · Google Meet
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {days.map((day) => (
          <div
            key={day.num}
            className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-xs ${
              day.active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border text-muted-foreground"
            }`}
          >
            <span>{day.label}</span>
            <span className="text-sm font-semibold">{day.num}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        {times.map((time, i) => (
          <div
            key={time}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${
              i === 2
                ? "border-primary/50 bg-accent text-accent-foreground"
                : "border-border text-foreground"
            }`}
          >
            <span className="font-medium">{time}</span>
            {i === 2 ? (
              <Badge className="gap-1 bg-primary text-primary-foreground hover:bg-primary">
                <Video className="size-3" /> Selecionado
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">Disponível</span>
            )}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-primary/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 size-32 rounded-full bg-chart-2/20 blur-3xl" />
    </div>
  );
}
