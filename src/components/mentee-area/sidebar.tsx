"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, History, Link as LinkIcon, NotebookPen, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

const DISCORD_URL = "https://discord.gg/guzFgznCPD";

type NavLink = { href: string; label: string; icon?: LucideIcon; iconSrc?: string; external?: boolean };

const links: NavLink[] = [
  { href: "/agendar", label: "Agendamentos", icon: CalendarDays },
  { href: "/agendar/links", label: "Links importantes", icon: LinkIcon },
  { href: "/agendar/anotacoes", label: "Anotações", icon: NotebookPen },
  { href: DISCORD_URL, label: "Discord Oficial", iconSrc: "/icons/discord.png", external: true },
  { href: "/agendar/historico", label: "Histórico", icon: History },
];

function NavIcon({ link }: { link: NavLink }) {
  if (link.iconSrc) {
    return (
      <Image
        src={link.iconSrc}
        alt=""
        width={16}
        height={16}
        className="size-4 object-contain brightness-0 invert"
      />
    );
  }
  if (link.icon) {
    return <link.icon className="size-4" />;
  }
  return null;
}

export function MenteeSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border/60 px-6">
        <LogoMark className="h-8" tone="cream" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {links.map((link) => {
          const isActive =
            !link.external &&
            (link.href === "/agendar" ? pathname === link.href : pathname.startsWith(link.href));

          const className = cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          );

          if (link.external) {
            return (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={className}>
                <NavIcon link={link} />
                {link.label}
              </a>
            );
          }

          return (
            <Link key={link.href} href={link.href} className={className}>
              <NavIcon link={link} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/50">
        Aristocrata Society · Painel do mentorado
      </div>
    </aside>
  );
}
