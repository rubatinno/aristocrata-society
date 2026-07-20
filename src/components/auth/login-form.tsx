"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginUser, registerUser, type AuthFormState } from "@/app/login/actions";
import {
  CheckCircle2,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";

const initialState: AuthFormState = { status: "idle" };

type Role = "mentor" | "mentee";
type Mode = "login" | "register";

export function LoginForm({ next }: { next: string }) {
  const [role, setRole] = useState<Role>("mentee");

  return (
    <div className="space-y-6">
      <Tabs value={role} onValueChange={(value) => setRole(value as Role)}>
        <TabsList className="h-auto w-full gap-1.5 rounded-2xl bg-muted/60 p-1.5 group-data-horizontal/tabs:h-auto">
          <TabsTrigger
            value="mentee"
            className="flex-col gap-1.5 rounded-xl py-3 text-[11px] font-bold tracking-wide uppercase data-active:bg-card data-active:shadow-md"
          >
            <GraduationCap className="size-4" />
            Sou mentorado
          </TabsTrigger>
          <TabsTrigger
            value="mentor"
            className="flex-col gap-1.5 rounded-xl py-3 text-[11px] font-bold tracking-wide uppercase data-active:bg-card data-active:shadow-md"
          >
            <ShieldCheck className="size-4" />
            Sou mentor
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <AuthForms role={role} mentorNext={next} />
    </div>
  );
}

function AuthForms({ role, mentorNext }: { role: Role; mentorNext: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const resolvedNext = role === "mentor" ? mentorNext : "/agendar";

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <h2 className="font-heading text-base font-semibold">
          {mode === "login" ? "Entrar na sua conta" : "Criar sua conta"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {role === "mentee" ? "Acesso de mentorado" : "Acesso de mentor"}
        </p>
      </div>

      {mode === "login" ? (
        <LoginFields role={role} next={resolvedNext} />
      ) : (
        <RegisterFields role={role} next={resolvedNext} />
      )}

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            Não tem conta?{" "}
            <button
              type="button"
              onClick={() => setMode("register")}
              className="font-semibold text-primary hover:underline"
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
              className="font-semibold text-primary hover:underline"
            >
              Entrar
            </button>
          </>
        )}
      </p>
    </div>
  );
}

function IconField({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      {children}
    </div>
  );
}

const fieldInputClass = "h-11 rounded-xl pl-9 text-sm";

function LoginFields({ role, next }: { role: Role; next: string }) {
  const [state, action, pending] = useActionState(loginUser, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <Label htmlFor="login_email">E-mail</Label>
        <IconField icon={<Mail className="size-4" />}>
          <Input
            id="login_email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={fieldInputClass}
          />
        </IconField>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login_password">Senha</Label>
        <IconField icon={<Lock className="size-4" />}>
          <Input
            id="login_password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={fieldInputClass}
          />
        </IconField>
      </div>

      {state.status === "error" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}

function RegisterFields({ role, next }: { role: Role; next: string }) {
  const [state, action, pending] = useActionState(registerUser, initialState);

  if (state.status === "check-email") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
        <CheckCircle2 className="size-8 text-success" />
        <p className="text-sm font-medium">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <Label htmlFor="register_name">Nome</Label>
        <IconField icon={<User className="size-4" />}>
          <Input
            id="register_name"
            name="full_name"
            autoComplete="name"
            required
            className={fieldInputClass}
          />
        </IconField>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="register_email">E-mail</Label>
        <IconField icon={<Mail className="size-4" />}>
          <Input
            id="register_email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={fieldInputClass}
          />
        </IconField>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="register_phone">Telefone</Label>
        <IconField icon={<Phone className="size-4" />}>
          <Input
            id="register_phone"
            name="phone"
            type="tel"
            placeholder="(11) 91234-5678"
            autoComplete="tel"
            required
            className={fieldInputClass}
          />
        </IconField>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="register_password">Senha</Label>
        <IconField icon={<Lock className="size-4" />}>
          <Input
            id="register_password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className={fieldInputClass}
          />
        </IconField>
      </div>

      {state.status === "error" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Criar conta
      </Button>
    </form>
  );
}
