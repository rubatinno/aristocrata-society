"use client";

import { ExternalLink, FileText, LinkIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { googleEmbedUrl } from "@/lib/links";
import type { MenteeLink } from "@/lib/types";

export function MenteeLinkRow({ link }: { link: MenteeLink }) {
  const embedUrl = googleEmbedUrl(link.url);

  if (!embedUrl) {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <LinkIcon className="size-4" />
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{link.title}</span>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
      </a>
    );
  }

  return (
    <Dialog>
      <DialogTrigger className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <FileText className="size-4" />
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{link.title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">Pré-visualizar</span>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{link.title}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
          <iframe src={embedUrl} title={link.title} className="size-full" allowFullScreen />
        </div>
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
        >
          Abrir no Google Docs <ExternalLink className="size-3.5" />
        </a>
      </DialogContent>
    </Dialog>
  );
}
