"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeOnboarding, type OnboardingState } from "@/app/onboarding/actions";
import { slugify, TIMEZONES } from "@/lib/slug";
import { Loader2 } from "lucide-react";

const initialState: OnboardingState = { status: "idle" };

const DURATIONS = [15, 30, 45, 60];
const BUFFERS = [0, 5, 10, 15, 30];

export function OnboardingForm({ defaultSlug }: { defaultSlug: string }) {
  const [state, action, pending] = useActionState(completeOnboarding, initialState);
  const [slug, setSlug] = useState(defaultSlug);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="full_name">Seu nome</Label>
        <Input
          id="full_name"
          name="full_name"
          placeholder="Ex: Ana Souza"
          required
          onChange={(e) => setSlug(slugify(e.target.value) || defaultSlug)}
        />
      </div>

      <input type="hidden" name="slug" value={slug} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="timezone">Fuso horário</Label>
          <Select name="timezone" defaultValue="America/Sao_Paulo">
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="session_duration_minutes">Duração da sessão</Label>
          <Select name="session_duration_minutes" defaultValue="30">
            <SelectTrigger id="session_duration_minutes" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} minutos
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="buffer_minutes">Intervalo entre chamadas</Label>
        <Select name="buffer_minutes" defaultValue="10">
          <SelectTrigger id="buffer_minutes" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUFFERS.map((b) => (
              <SelectItem key={b} value={String(b)}>
                {b === 0 ? "Sem intervalo" : `${b} minutos`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Criar minha agenda
      </Button>
    </form>
  );
}
