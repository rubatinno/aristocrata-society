"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Clock, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/dashboard/disponibilidade", label: "Horários", icon: Clock },
  { href: "/dashboard/mentorados", label: "Mentorados", icon: Users },
  { href: "/dashboard/configuracoes", label: "Ajustes", icon: Settings },
];

export function DashboardMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 lg:hidden">
      {links.map((link) => {
        const isActive =
          link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <link.icon className="size-5" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
