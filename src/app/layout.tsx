import type { Metadata } from "next";
import { DM_Sans, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, THEME_BOOTSTRAP_SCRIPT } from "@/components/theme-provider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-playfair",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aristocrata Society — Agendamento de Mentorias",
  description:
    "Escolha um mentor da Aristocrata Society e agende sua sessão de mentoria individual no horário que preferir.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${dmSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP_SCRIPT}
        </Script>
        <ThemeProvider>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
