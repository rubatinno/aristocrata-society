/** Reconhece links do Google Docs/Sheets/Slides/Forms/Drive e devolve a
 * URL de preview embutível (iframe). Qualquer outro link volta `null` e
 * continua se comportando como um link externo comum. */
export function googleEmbedUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const docMatch = parsed.pathname.match(
    /^\/(document|spreadsheets|presentation|forms)\/d\/([^/]+)/,
  );
  if (docMatch && parsed.hostname === "docs.google.com") {
    const [, kind, id] = docMatch;
    return kind === "forms"
      ? `https://docs.google.com/forms/d/${id}/viewform?embedded=true`
      : `https://docs.google.com/${kind}/d/${id}/preview`;
  }

  const driveMatch = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
  if (driveMatch && parsed.hostname === "drive.google.com") {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  return null;
}
