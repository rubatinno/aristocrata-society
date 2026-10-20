import { ExternalLink, FileText, LinkIcon } from "lucide-react";
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
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <FileText className="size-4" />
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{link.title}</span>
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          Abrir <ExternalLink className="size-3.5" />
        </a>
      </div>
      <iframe
        src={embedUrl}
        title={link.title}
        className="h-[480px] w-full bg-muted"
        allowFullScreen
      />
    </div>
  );
}
