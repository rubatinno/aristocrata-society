"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, History, Link as LinkIcon, NotebookPen, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const DISCORD_URL = "https://discord.gg/guzFgznCPD";

type NavLink = { href: string; label: string; icon?: LucideIcon; iconSrc?: string; external?: boolean };

const links: NavLink[] = [
  { href: "/agendar", label: "Agendar", icon: CalendarDays },
  { href: "/agendar/links", label: "Links", icon: LinkIcon },
  { href: "/agendar/anotacoes", label: "Notas", icon: NotebookPen },
  { href: DISCORD_URL, label: "Discord", iconSrc: "/icons/discord.png", external: true },
  { href: "/agendar/historico", label: "Histórico", icon: History },
];

function NavIcon({ link, active }: { link: NavLink; active: boolean }) {
  if (link.iconSrc) {
    return (
      <Image
        src={link.iconSrc}
        alt=""
        width={20}
        height={20}
        className={cn("size-5 object-contain", active ? "opacity-100" : "opacity-70")}
      />
    );
  }
  if (link.icon) {
    return <link.icon className="size-5" />;
  }
  return null;
}

export function MenteeMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 lg:hidden">
      {links.map((link) => {
        const isActive =
          !link.external &&
          (link.href === "/agendar" ? pathname === link.href : pathname.startsWith(link.href));

        const className = cn(
          "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
          isActive ? "text-primary" : "text-muted-foreground",
        );

        if (link.external) {
          return (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={className}>
              <NavIcon link={link} active={isActive} />
              {link.label}
            </a>
          );
        }

        return (
          <Link key={link.href} href={link.href} className={className}>
            <NavIcon link={link} active={isActive} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
