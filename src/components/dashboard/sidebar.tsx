"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Settings,
  Users,
  Layers,
  ShieldCheck,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

const DISCORD_URL = "https://discord.gg/guzFgznCPD";

type NavLink = { href: string; label: string; icon?: LucideIcon; iconSrc?: string; external?: boolean };

const baseLinks: NavLink[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/dashboard/disponibilidade", label: "Disponibilidade", icon: Clock },
  { href: "/dashboard/mentorados", label: "Mentorados", icon: Users },
  { href: DISCORD_URL, label: "Discord Oficial", iconSrc: "/icons/discord.png", external: true },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
];

const adminLinks: NavLink[] = [
  { href: "/dashboard/aprovacoes", label: "Aprovações", icon: ShieldCheck },
  { href: "/dashboard/equipe", label: "Equipe", icon: UsersRound },
  { href: "/dashboard/planos", label: "Planos", icon: Layers },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: Wallet },
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

export function DashboardSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...baseLinks, ...adminLinks] : baseLinks;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border/60 px-6">
        <LogoMark className="h-8" tone="cream" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {links.map((link) => {
          const isActive =
            !link.external &&
            (link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href));

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
        Aristocrata Society · Painel do mentor
      </div>
    </aside>
  );
}
