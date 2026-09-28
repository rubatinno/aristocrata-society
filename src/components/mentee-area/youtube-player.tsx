"use client";

import { useEffect, useRef, useState } from "react";
import { getYouTubeThumbnail } from "@/lib/video-embed";
import { cn } from "@/lib/utils";
import { Maximize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";

const YT_ORIGIN = "https://www.youtube-nocookie.com";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Player do YouTube sem cara de YouTube: some com o vídeo real só depois do
 * clique (nada de iframe carregado à toa — é o maior ganho de performance
 * aqui) e os controles nativos ficam escondidos (controls=0) atrás de um
 * overlay transparente nosso, que também bloqueia o hover do YouTube
 * (pointer-events: none no iframe) pra nunca aparecer título/sugestões
 * dele. Comando/estado via postMessage cru — sem carregar o script pesado
 * da IFrame API.
 */
export function YouTubePlayer({ videoId, title }: { videoId: string; title: string }) {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  // O YouTube demora uns segundos pra esconder o próprio título/sugestões
  // depois que o vídeo começa (de novo, toda vez que sai da pausa) — a
  // camada preta some com esse atraso, não junto com `playing`, senão dá
  // tempo de ver a marca dele por baixo antes de sumir.
  const [showScrim, setShowScrim] = useState(true);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!started) return;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== YT_ORIGIN) return;
      let data: unknown;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;
      const payload = data as { event?: string; info?: { currentTime?: number; duration?: number; playerState?: number } };
      if (payload.event !== "infoDelivery" || !payload.info) return;
      if (typeof payload.info.currentTime === "number") setCurrentTime(payload.info.currentTime);
      if (typeof payload.info.duration === "number") setDuration(payload.info.duration);
      if (typeof payload.info.playerState === "number") {
        const isPlaying = payload.info.playerState === 1;
        setPlaying(isPlaying);
        if (scrimTimerRef.current) clearTimeout(scrimTimerRef.current);
        if (isPlaying) {
          scrimTimerRef.current = setTimeout(() => setShowScrim(false), 3500);
        } else {
          setShowScrim(true);
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (scrimTimerRef.current) clearTimeout(scrimTimerRef.current);
    };
  }, [started]);

  function sendCommand(func: string, args: unknown[] = []) {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), YT_ORIGIN);
  }

  function handleStart() {
    setStarted(true);
  }

  function handleIframeLoad() {
    const win = iframeRef.current?.contentWindow;
    win?.postMessage(JSON.stringify({ event: "listening", id: videoId }), YT_ORIGIN);
    // autoplay via URL param nem sempre dispara a tempo — reforça com o comando direto.
    win?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: "" }), YT_ORIGIN);
  }

  function togglePlay() {
    // Não muda `playing` otimisticamente — só quando o YouTube confirmar via
    // infoDelivery, senão a camada escura que esconde a marca dele some cedo
    // demais (ainda carregando) e o player pisca com a cara do YouTube.
    sendCommand(playing ? "pauseVideo" : "playVideo");
  }

  function skip(seconds: number) {
    const next = Math.max(0, Math.min(duration || Infinity, currentTime + seconds));
    sendCommand("seekTo", [next, true]);
    setCurrentTime(next);
  }

  function toggleMute() {
    sendCommand(muted ? "unMute" : "mute");
    setMuted((prev) => !prev);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const next = Number(e.target.value);
    setCurrentTime(next);
    sendCommand("seekTo", [next, true]);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }

  if (!started) {
    return (
      <button
        type="button"
        onClick={handleStart}
        className="group relative flex size-full items-center justify-center overflow-hidden bg-black"
        style={{
          backgroundImage: `url(${getYouTubeThumbnail(videoId)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-label={`Assistir ${title}`}
      >
        <div className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/45" />
        <span className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-105">
          <Play className="ml-1 size-7 fill-current" />
        </span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative size-full bg-black">
      <iframe
        ref={iframeRef}
        src={`${YT_ORIGIN}/embed/${videoId}?enablejsapi=1&autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&fs=0&disablekb=1&playsinline=1&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`}
        title={title}
        className="pointer-events-none size-full"
        allow="autoplay; encrypted-media; picture-in-picture"
        onLoad={handleIframeLoad}
      />

      {/* Só a faixa de cima precisa de tarja — é onde o YouTube desenha
          título/canal quando pausado ou carregando. A de baixo já fica
          coberta pelo degradê da nossa própria barra de controles. Assim o
          quadro do vídeo continua visível (sem tela preta no meio) e só a
          marca do YouTube some. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-16 bg-black transition-opacity duration-500",
          showScrim ? "opacity-100" : "opacity-0",
        )}
      />

      <button
        type="button"
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center"
        aria-label={playing ? "Pausar" : "Reproduzir"}
      >
        {!playing && (
          <span className="flex size-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg">
            <Play className="ml-1 size-7 fill-current" />
          </span>
        )}
      </button>

      {/* Sólido, não degradê — um degradê deixava a "Mais vídeos"/logo do
          YouTube vazar na parte de cima da barra, onde a opacidade era
          menor. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-black px-4 pt-4 pb-3">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="h-1.5 w-full cursor-pointer accent-primary"
        />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            className="flex size-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/15"
            title={playing ? "Pausar" : "Reproduzir"}
          >
            {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => skip(-10)}
            className="flex size-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-primary"
            title="Voltar 10s"
          >
            <RotateCcw className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => skip(10)}
            className="flex size-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-primary"
            title="Avançar 10s"
          >
            <RotateCw className="size-5" />
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="flex size-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-primary"
            title={muted ? "Ativar som" : "Mudo"}
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <span className="text-sm font-medium tabular-nums text-primary">
            {formatTime(currentTime)} <span className="text-white/50">/ {formatTime(duration)}</span>
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex size-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-primary"
            title="Tela cheia"
          >
            <Maximize className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
