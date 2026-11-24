/** Reconhecimento de links do YouTube (convencionais, curtos, compartilhamento, shorts, embed). */

export interface ParsedYouTube {
  id: string;
  /** Segundos de início, quando o link traz t= ou start=. */
  start?: number;
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
]);

/** "1h2m3s", "90s", "90" -> segundos. */
export function parseYouTubeTimeParam(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(value);
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  return (parseInt(m[1] ?? '0', 10) * 3600) + (parseInt(m[2] ?? '0', 10) * 60) + parseInt(m[3] ?? '0', 10);
}

export type ParseResult =
  | { ok: true; value: ParsedYouTube }
  | { ok: false; error: string };

export function parseYouTubeUrl(raw: string): ParseResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'Cole um link do YouTube.' };

  // ID puro
  if (ID_RE.test(text)) return { ok: true, value: { id: text } };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, error: 'Link inválido. Cole o endereço completo do vídeo.' };
  }

  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return { ok: false, error: 'Este não parece ser um link do YouTube.' };

  const start =
    parseYouTubeTimeParam(url.searchParams.get('t')) ?? parseYouTubeTimeParam(url.searchParams.get('start'));
  const withStart = (id: string): ParseResult => ({ ok: true, value: start ? { id, start } : { id } });

  const segments = url.pathname.split('/').filter(Boolean);

  if (host.endsWith('youtu.be')) {
    const id = segments[0] ?? '';
    return ID_RE.test(id) ? withStart(id) : { ok: false, error: 'Não encontrei o código do vídeo neste link.' };
  }

  const v = url.searchParams.get('v');
  if (v && ID_RE.test(v)) return withStart(v);

  const [first, second] = segments;
  if (first && ['embed', 'shorts', 'live', 'v', 'e'].includes(first) && second && ID_RE.test(second)) {
    return withStart(second);
  }

  if (url.searchParams.get('list') && !v) {
    return { ok: false, error: 'Este link é de uma playlist. Abra um vídeo específico e copie o link dele.' };
  }
  return { ok: false, error: 'Não encontrei o código do vídeo neste link.' };
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
