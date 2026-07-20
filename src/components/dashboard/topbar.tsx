"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/dashboard/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Check, Copy, LogOut } from "lucide-react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function DashboardTopbar({
  fullName,
  email,
  bookingUrl,
}: {
  fullName: string;
  email: string;
  bookingUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <Button variant="outline" size="sm" onClick={copyLink} className="gap-2">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        <span className="hidden sm:inline">{copied ? "Link copiado" : "Copiar link de agendamento"}</span>
        <span className="sm:hidden">{copied ? "Copiado" : "Copiar link"}</span>
      </Button>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Avatar className="size-8 border border-border">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {initials(fullName || email)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium">{fullName || "Mentor"}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
              <LogOut className="size-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
