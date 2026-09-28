"use client";

import { useState } from "react";
import { getEmbedUrl, getYouTubeVideoId } from "@/lib/video-embed";
import { YouTubePlayer } from "@/components/mentee-area/youtube-player";
import { PlayCircle } from "lucide-react";

/** Embed genérico (Panda Video, VTurb, Vimeo, iframe direto) — mesma
 * otimização de carregamento do player do YouTube: nada de iframe na tela
 * até o clique. */
function LazyEmbed({ embedUrl, title }: { embedUrl: string; title: string }) {
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <button
        type="button"
        onClick={() => setStarted(true)}
        className="group flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-card text-muted-foreground"
        aria-label={`Assistir ${title}`}
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-105">
          <PlayCircle className="size-8" />
        </span>
        <span className="text-sm">Carregar vídeo</span>
      </button>
    );
  }

  return (
    <iframe
      src={embedUrl}
      title={title}
      className="size-full"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}

export function VideoPlayer({ videoUrl, title }: { videoUrl: string | null; title: string }) {
  if (!videoUrl || !videoUrl.trim()) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <PlayCircle className="size-8" />
        <p className="text-sm">Nenhum vídeo cadastrado pra essa aula ainda.</p>
      </div>
    );
  }

  const youtubeId = getYouTubeVideoId(videoUrl);
  if (youtubeId) return <YouTubePlayer videoId={youtubeId} title={title} />;

  const embedUrl = getEmbedUrl(videoUrl);
  if (!embedUrl) return null;
  return <LazyEmbed embedUrl={embedUrl} title={title} />;
}
