"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  completeMenteeProfile,
  getMenteeSession,
  loginMenteeInline,
  registerMenteeInline,
  type MenteeAuthState,
  type MenteeSession,
} from "@/app/agendar/mentee-actions";
import { createBooking } from "@/app/agendar/actions";
import { formatTime } from "@/lib/format";
import type { Slot } from "@/lib/scheduling";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

const PENDING_BOOKING_KEY = "pending_booking";

export function storePendingBooking(mentorId: string, slot: Slot) {
  try {
    sessionStorage.setItem(
      PENDING_BOOKING_KEY,
      JSON.stringify({ mentorId, startsAt: slot.startsAt.toISOString() }),
    );
  } catch {
    // sessionStorage indisponível — segue sem restaurar após o redirect.
  }
}

export function readPendingBooking(): { mentorId: string; startsAt: string } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_BOOKING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_BOOKING_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type Step =
  | { kind: "loading" }
  | { kind: "auth" }
  | { kind: "complete-profile" }
  | { kind: "confirm" }
  | { kind: "needs-approval"; message: string };

const authInitialState: MenteeAuthState = { status: "idle" };

export function BookingDialog({
  slot,
  dateLabel,
  mentorId,
  timeZone,
  onOpenChange,
  onBooked,
}: {
  slot: Slot | null;
  dateLabel: string;
  mentorId: string;
  timeZone: string;
  onOpenChange: (open: boolean) => void;
  onBooked: (slot: Slot) => void;
}) {
  return (
    <Dialog open={slot !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar agendamento</DialogTitle>
          <DialogDescription>
            {slot ? `${dateLabel} às ${formatTime(slot.startsAt, timeZone)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {slot && (
          <BookingDialogSteps
            key={slot.startsAt.toISOString()}
            slot={slot}
            mentorId={mentorId}
            onBooked={onBooked}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BookingDialogSteps({
  slot,
  mentorId,
  onBooked,
}: {
  slot: Slot;
  mentorId: string;
  onBooked: (slot: Slot) => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [session, setSession] = useState<MenteeSession | null>(null);

  async function refreshSession() {
    const result = await getMenteeSession();
    setSession(result);
    if (!result) setStep({ kind: "auth" });
    else if (!result.isComplete) setStep({ kind: "complete-profile" });
    else setStep({ kind: "confirm" });
  }

  useEffect(() => {
    let cancelled = false;

    getMenteeSession().then((result) => {
      if (cancelled) return;
      setSession(result);
      if (!result) setStep({ kind: "auth" });
      else if (!result.isComplete) setStep({ kind: "complete-profile" });
      else setStep({ kind: "confirm" });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {step.kind === "loading" && (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {step.kind === "auth" && (
        <MenteeAuthStep mentorId={mentorId} slot={slot} onAuthenticated={refreshSession} />
      )}

      {step.kind === "complete-profile" && session && (
        <CompleteProfileForm
          defaultName={session.profile?.full_name ?? ""}
          defaultPhone={session.profile?.phone ?? ""}
          onDone={() => setStep({ kind: "confirm" })}
        />
      )}

      {step.kind === "confirm" && session && (
        <ConfirmBookingForm
          mentorId={mentorId}
          slot={slot}
          defaultName={session.profile?.full_name ?? ""}
          defaultPhone={session.profile?.phone ?? ""}
          email={session.email}
          onNeedsApproval={(message) => setStep({ kind: "needs-approval", message })}
          onBooked={() => onBooked(slot)}
        />
      )}

      {step.kind === "needs-approval" && (
        <div className="space-y-3 rounded-xl border border-accent bg-accent/40 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-accent-foreground">
            <Mail className="size-4" /> Aprovação necessária
          </div>
          <p className="text-muted-foreground">{step.message}</p>
        </div>
      )}
    </>
  );
}

function MenteeAuthStep({
  mentorId,
  slot,
  onAuthenticated,
}: {
  mentorId: string;
  slot: Slot;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="space-y-4">
      {mode === "login" ? (
        <MenteeLoginFields onAuthenticated={onAuthenticated} />
      ) : (
        <MenteeRegisterFields mentorId={mentorId} slot={slot} onAuthenticated={onAuthenticated} />
      )}

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            Não tem conta?{" "}
            <button
              type="button"
              onClick={() => setMode("register")}
              className="font-medium text-primary hover:underline"
            >
              Criar conta
            </button>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <button
              type="button"
              onClick={() => setMode("login")}
              className="font-medium text-primary hover:underline"
            >
              Entrar
            </button>
          </>
        )}
      </p>
    </div>
  );
}

function MenteeLoginFields({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [state, formAction, pending] = useActionState(loginMenteeInline, authInitialState);

  useEffect(() => {
    if (state.status === "success") onAuthenticated();
  }, [state, onAuthenticated]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="mentee_login_email">Seu e-mail</Label>
        <Input id="mentee_login_email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mentee_login_password">Senha</Label>
        <Input id="mentee_login_password" name="password" type="password" required />
      </div>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <DialogFooter>
        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Entrar
        </Button>
      </DialogFooter>
    </form>
  );
}

function MenteeRegisterFields({
  mentorId,
  slot,
  onAuthenticated,
}: {
  mentorId: string;
  slot: Slot;
  onAuthenticated: () => void;
}) {
  const [state, formAction, pending] = useActionState(registerMenteeInline, authInitialState);

  useEffect(() => {
    if (state.status === "success") onAuthenticated();
  }, [state, onAuthenticated]);

  if (state.status === "check-email") {
    return (
      <div className="space-y-2 rounded-xl border border-accent bg-accent/40 p-4 text-sm">
        <p className="font-medium text-accent-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={() => storePendingBooking(mentorId, slot)}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="mentee_register_name">Seu nome</Label>
        <Input id="mentee_register_name" name="full_name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mentee_register_email">Seu e-mail</Label>
        <Input id="mentee_register_email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mentee_register_phone">Seu telefone</Label>
        <Input
          id="mentee_register_phone"
          name="phone"
          type="tel"
          placeholder="(11) 91234-5678"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mentee_register_password">Senha</Label>
        <Input id="mentee_register_password" name="password" type="password" required minLength={6} />
      </div>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <DialogFooter>
        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Criar conta
        </Button>
      </DialogFooter>
    </form>
  );
}

function CompleteProfileForm({
  defaultName,
  defaultPhone,
  onDone,
}: {
  defaultName: string;
  defaultPhone: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await completeMenteeProfile(name, phone);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Falta pouco — confirme seu nome e telefone pra concluir o agendamento.
      </p>
      <div className="space-y-2">
        <Label htmlFor="complete_name">Seu nome</Label>
        <Input id="complete_name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="complete_phone">Seu telefone</Label>
        <Input
          id="complete_phone"
          type="tel"
          placeholder="(11) 91234-5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Continuar
        </Button>
      </DialogFooter>
    </form>
  );
}

function ConfirmBookingForm({
  mentorId,
  slot,
  defaultName,
  defaultPhone,
  email,
  onNeedsApproval,
  onBooked,
}: {
  mentorId: string;
  slot: Slot;
  defaultName: string;
  defaultPhone: string;
  email: string;
  onNeedsApproval: (message: string) => void;
  onBooked: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      // Salva nome/telefone (caso o mentorado tenha ajustado aqui) antes de
      // confirmar — createBooking lê esses dados frescos de mentee_profiles.
      await completeMenteeProfile(name, phone);
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Não foi possível salvar seus dados.");
      return;
    }

    const result = await createBooking({
      mentorId,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      notes,
    });

    setPending(false);

    if (!result.ok) {
      if (result.needsApproval) {
        onNeedsApproval(result.message ?? "");
      } else {
        setError(result.message ?? "Não foi possível agendar. Tente novamente.");
      }
      return;
    }

    setBooked(true);
    onBooked();
  }

  if (booked) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <CheckCircle2 className="size-8 text-success" />
        <p className="text-sm font-medium">Agendado!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="confirm_name">Nome</Label>
        <Input id="confirm_name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_email">E-mail</Label>
        <Input id="confirm_email" type="email" value={email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_phone">Telefone</Label>
        <Input
          id="confirm_phone"
          type="tel"
          placeholder="(11) 91234-5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">O que você quer discutir? (opcional)</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Confirmar
        </Button>
      </DialogFooter>
    </form>
  );
}
