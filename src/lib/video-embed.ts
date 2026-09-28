/** Extrai o ID de um vídeo do YouTube de vários formatos de link (youtu.be,
 * watch?v=, shorts, embed) — devolve null se não reconhecer o formato. */
export function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }

    if (host === "youtube.com") {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] || null;
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] || null;
    }

    return null;
  } catch {
    return null;
  }
}

/** Painéis de aula normalmente recebem o código de embed inteiro (`<iframe
 * src="...">`) copiado do Panda Video, VTurb etc., não só a URL — extrai o
 * `src` automaticamente quando é isso que veio colado. */
export function extractEmbedSrc(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return match ? match[1] : trimmed;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function getVimeoVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
    const id = parsed.pathname.split("/").filter(Boolean).pop();
    return id && /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Devolve uma URL pronta pra colocar num <iframe> — reconhece YouTube e
 * Vimeo automaticamente; qualquer outro link é usado como veio (assume que
 * já é uma URL de embed direta). */
export function getEmbedUrl(url: string | null): string | null {
  if (!url || !url.trim()) return null;

  const youtubeId = getYouTubeVideoId(url);
  if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}`;

  const vimeoId = getVimeoVideoId(url);
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;

  return url;
}
