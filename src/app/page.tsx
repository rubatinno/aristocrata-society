import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { HeroPreview } from "@/components/landing/hero-preview";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";
import { Users, CalendarCheck2, ShieldCheck, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Escolha seu mentor",
    description:
      "Veja todos os mentores da Aristocrata Society disponíveis e marque com quem tiver mais afinidade.",
  },
  {
    icon: CalendarCheck2,
    title: "Horários sempre atualizados",
    description:
      "Cada mentor configura sua própria agenda — você só vê o que realmente está livre, em tempo real.",
  },
  {
    icon: ShieldCheck,
    title: "Uma mentoria por semana",
    description:
      "Para manter a qualidade do acompanhamento, cada membro pode agendar uma chamada por semana.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/">
            <LogoMark className="h-7" />
          </Link>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }))}>
              Sou mentor
            </Link>
            <Link href="/agendar" className={cn(buttonVariants())}>
              Agendar mentoria
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Members Club · Mentoria individual
            </span>
            <h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Sua próxima mentoria na Aristocrata Society, a um clique de distância.
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
              Escolha o mentor com quem quer conversar, veja os horários livres dele em tempo
              real e agende sua sessão individual — sem trocar uma única mensagem.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/agendar" className={cn(buttonVariants({ size: "lg" }), "gap-1.5")}>
                Agendar minha mentoria <ArrowRight className="size-4" />
              </Link>
              <Link href="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
                Sou mentor da Society
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroPreview />
          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Como funciona o agendamento
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <feature.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-6xl px-6 text-sm text-muted-foreground">
          Aristocrata Society · Members Club MMXXVI
        </div>
      </footer>
    </div>
  );
}
