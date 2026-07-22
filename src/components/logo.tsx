import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brasão da Aristocrata Society, sem fundo.
 * `tone="auto"` troca a tinta com o tema (claro/escuro). Use `tone="cream"`
 * em superfícies que são sempre escuras (ex: sidebar do painel).
 */
export function LogoMark({
  className,
  tone = "auto",
}: {
  className?: string;
  tone?: "auto" | "cream" | "ink";
}) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center", className)}>
      <Image
        src="/logo-mark.png"
        alt="Aristocrata Society"
        width={800}
        height={455}
        sizes="140px"
        className={cn(
          "h-full w-auto object-contain",
          tone === "auto" && "hidden dark:block",
          tone === "ink" && "hidden",
        )}
        priority
      />
      <Image
        src="/logo-mark-dark.png"
        alt={tone === "cream" ? "" : "Aristocrata Society"}
        width={800}
        height={455}
        sizes="140px"
        className={cn(
          "h-full w-auto object-contain",
          tone === "auto" && "block dark:hidden",
          tone === "cream" && "hidden",
        )}
        priority
      />
    </span>
  );
}

