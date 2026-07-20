"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfile, type SettingsState } from "@/app/dashboard/configuracoes/actions";
import { TIMEZONES } from "@/lib/slug";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { Loader2 } from "lucide-react";

const initialState: SettingsState = { status: "idle" };
const DURATIONS = [15, 30, 45, 60];
const BUFFERS = [0, 5, 10, 15, 30];
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function AvatarUploader({
  fullName,
  initialAvatarUrl,
}: {
  fullName: string;
  initialAvatarUrl: string | null;
}) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("A imagem deve ter até 4MB.");
      return;
    }

    setIsUploading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Sessão expirada, faça login novamente.");
      setIsUploading(false);
      return;
    }

    const extension = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      toast.error("Não foi possível enviar a foto. Tente novamente.");
      setIsUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setIsUploading(false);
    toast.success("Foto atualizada — clique em Salvar para confirmar.");
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16 border border-border" size="lg">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
        <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground">
          {initials(fullName)}
        </AvatarFallback>
      </Avatar>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading && <Loader2 className="size-3.5 animate-spin" />}
          {avatarUrl ? "Trocar foto" : "Adicionar foto"}
        </Button>
        <p className="mt-1.5 text-xs text-muted-foreground">JPG ou PNG, até 4MB.</p>
      </div>

      <input type="hidden" name="avatar_url" value={avatarUrl} />
    </div>
  );
}

export function SettingsForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, initialState);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="space-y-8">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Perfil público</h2>

        <AvatarUploader fullName={profile.full_name} initialAvatarUrl={profile.avatar_url} />

        <div className="space-y-2">
          <Label htmlFor="full_name">Nome</Label>
          <Input id="full_name" name="full_name" defaultValue={profile.full_name} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="headline">Headline</Label>
          <Textarea
            id="headline"
            name="headline"
            defaultValue={profile.headline ?? ""}
            placeholder="Ex: Mentoria de carreira em Produto e Tecnologia"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="booking_instructions">Regras e instruções para o mentorado</Label>
          <Textarea
            id="booking_instructions"
            name="booking_instructions"
            defaultValue={profile.booking_instructions ?? ""}
            placeholder="Ex: Cancelamentos com até 24h de antecedência. Traga suas dúvidas por escrito antes da call."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Aparece na página de agendamento, junto com o seu horário selecionado.
          </p>
        </div>

        <input type="hidden" name="slug" value={profile.slug} />
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Sessão de mentoria</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="session_duration_minutes">Duração</Label>
            <Select name="session_duration_minutes" defaultValue={String(profile.session_duration_minutes)}>
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

          <div className="space-y-2">
            <Label htmlFor="buffer_minutes">Intervalo entre chamadas</Label>
            <Select name="buffer_minutes" defaultValue={String(profile.buffer_minutes)}>
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Fuso horário</Label>
          <Select name="timezone" defaultValue={profile.timezone}>
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
          <Label htmlFor="meeting_location">Local da call</Label>
          <Input
            id="meeting_location"
            name="meeting_location"
            defaultValue={profile.meeting_location ?? ""}
            placeholder="Ex: Google Meet, Zoom..."
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="text-sm font-semibold">Janela de agendamento</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Limite o período em que é possível reservar horários com você.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="booking_window_days">Antecedência máxima (dias)</Label>
            <Input
              id="booking_window_days"
              name="booking_window_days"
              type="number"
              min={1}
              max={365}
              defaultValue={profile.booking_window_days}
            />
            <p className="text-xs text-muted-foreground">
              Até quantos dias no futuro o mentorado pode marcar.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_notice_hours">Antecedência mínima (horas)</Label>
            <Input
              id="min_notice_hours"
              name="min_notice_hours"
              type="number"
              min={0}
              max={168}
              step={0.5}
              defaultValue={profile.min_notice_hours}
            />
            <p className="text-xs text-muted-foreground">
              Com quanta antecedência o mentorado precisa marcar. Use 0 para sem mínimo.
            </p>
          </div>
        </div>
      </section>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}
