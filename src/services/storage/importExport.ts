import {
  DEFAULT_PRACTICE,
  EXPORT_APP,
  EXPORT_VERSION,
  type Category,
  type Clip,
  type ExportFile,
  type Library,
  type PracticeConfig,
  type Setlist,
  type Track,
  type TrackSession,
} from '../../types';
import { uid } from '../../lib/id';
import { MIN_LOOP_LENGTH } from '../../lib/time';

// ---------- Exportação ----------

/** Monta o JSON de exportação. Arquivos de áudio/vídeo nunca são incluídos. */
export function buildExport(lib: Library, now = new Date()): ExportFile {
  return {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    tracks: lib.tracks.map((t) => ({ ...t, local: t.local ? { ...t.local, stored: false } : undefined })),
    clips: lib.clips,
    categories: lib.categories,
    setlists: lib.setlists,
  };
}

export function exportFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `loop-musical-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

// ---------- Validação ----------

const MAX_TEXT = 300;
const MAX_ITEMS = 20000;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = MAX_TEXT): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const nonNeg = (v: unknown, fallback: number): number => {
  const n = num(v);
  return n !== null && n >= 0 ? n : fallback;
};

function sanitizePractice(v: unknown): PracticeConfig {
  const o = isObj(v) ? v : {};
  const rate = (x: unknown, d: number) => {
    const n = num(x);
    return n !== null && n >= 0.25 && n <= 4 ? n : d;
  };
  const startRate = rate(o.startRate, DEFAULT_PRACTICE.startRate);
  const targetRate = rate(o.targetRate, DEFAULT_PRACTICE.targetRate);
  return {
    repetitions: Math.min(999, Math.floor(nonNeg(o.repetitions, DEFAULT_PRACTICE.repetitions))),
    gap: Math.min(60, nonNeg(o.gap, DEFAULT_PRACTICE.gap)),
    progressive: o.progressive === true,
    startRate: Math.min(startRate, targetRate),
    targetRate: Math.max(startRate, targetRate),
    countIn: Math.min(8, Math.floor(nonNeg(o.countIn, 0))),
    countEach: o.countEach === true,
    repsPerStep: Math.min(99, Math.max(1, Math.floor(nonNeg(o.repsPerStep, DEFAULT_PRACTICE.repsPerStep)))),
  };
}

function sanitizeSession(v: unknown): TrackSession {
  const o = isObj(v) ? v : {};
  const a = num(o.a);
  const b = num(o.b);
  const validRange = a !== null && b !== null && a >= 0 && b - a >= MIN_LOOP_LENGTH;
  const rate = num(o.rate);
  return {
    position: nonNeg(o.position, 0),
    a: validRange ? a : null,
    b: validRange ? b : null,
    loopEnabled: validRange && o.loopEnabled === true,
    rate: rate !== null && rate >= 0.25 && rate <= 4 ? rate : 1,
    activeClipId: str(o.activeClipId, 100),
  };
}

function sanitizeTrack(v: unknown, warnings: string[]): Track | null {
  if (!isObj(v)) return null;
  const id = str(v.id, 100);
  const source = v.source === 'youtube' || v.source === 'local' ? v.source : null;
  const title = str(v.title);
  if (!id || !source || !title) {
    warnings.push('Uma música com dados incompletos foi ignorada.');
    return null;
  }
  const now = Date.now();
  const base: Track = {
    id,
    title,
    autoTitle: v.autoTitle === true ? true : undefined,
    source,
    favorite: v.favorite === true,
    categoryId: str(v.categoryId, 100),
    duration: (num(v.duration) ?? 0) > 0 ? (num(v.duration) as number) : undefined,
    practice: sanitizePractice(v.practice),
    session: sanitizeSession(v.session),
    createdAt: nonNeg(v.createdAt, now),
    updatedAt: nonNeg(v.updatedAt, now),
    lastPlayedAt: num(v.lastPlayedAt) ?? undefined,
  };
  if (source === 'youtube') {
    const ytId = str(v.youtubeId, 20);
    if (!ytId || !/^[A-Za-z0-9_-]{11}$/.test(ytId)) {
      warnings.push(`A música "${title}" tem um código de vídeo inválido e foi ignorada.`);
      return null;
    }
    base.youtubeId = ytId;
    base.youtubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
    const start = num(v.youtubeStart);
    if (start !== null && start > 0) base.youtubeStart = start;
  } else {
    const l = isObj(v.local) ? v.local : {};
    const name = str(l.name) ?? title;
    base.local = {
      name,
      size: Math.floor(nonNeg(l.size, 0)),
      mimeType: str(l.mimeType, 100) ?? '',
      isVideo: l.isVideo === true,
      stored: false,
    };
  }
  return base;
}

function sanitizeClip(v: unknown, trackIds: Set<string>): Clip | null {
  if (!isObj(v)) return null;
  const id = str(v.id, 100);
  const trackId = str(v.trackId, 100);
  const start = num(v.start);
  const end = num(v.end);
  if (!id || !trackId || !trackIds.has(trackId) || start === null || end === null) return null;
  if (start < 0 || end - start < MIN_LOOP_LENGTH) return null;
  const rate = num(v.rate);
  return {
    id,
    trackId,
    name: str(v.name) ?? 'Trecho',
    start,
    end,
    rate: rate !== null && rate >= 0.25 && rate <= 4 ? rate : 1,
    repetitions: Math.min(999, Math.floor(nonNeg(v.repetitions, 0))),
    gap: Math.min(60, nonNeg(v.gap, 0)),
    order: nonNeg(v.order, 0),
  };
}

export type ParseResult = { ok: true; data: Library; warnings: string[] } | { ok: false; error: string };

export function parseImport(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }
  if (!isObj(json) || json.app !== EXPORT_APP) {
    return { ok: false, error: 'Este arquivo não foi exportado pelo Loop Musical.' };
  }
  const version = num(json.version);
  if (version === null || version < 1) return { ok: false, error: 'Versão do arquivo desconhecida.' };
  if (version > EXPORT_VERSION) {
    return { ok: false, error: 'Este arquivo foi criado por uma versão mais nova do Loop Musical.' };
  }
  for (const key of ['tracks', 'clips', 'categories', 'setlists'] as const) {
    if (json[key] !== undefined && !Array.isArray(json[key])) return { ok: false, error: `O campo "${key}" está inválido.` };
    if (Array.isArray(json[key]) && (json[key] as unknown[]).length > MAX_ITEMS) {
      return { ok: false, error: 'O arquivo tem itens demais.' };
    }
  }

  const warnings: string[] = [];
  const tracks: Track[] = [];
  const seenTracks = new Set<string>();
  for (const raw of (json.tracks as unknown[]) ?? []) {
    const t = sanitizeTrack(raw, warnings);
    if (t && !seenTracks.has(t.id)) {
      seenTracks.add(t.id);
      tracks.push(t);
    }
  }

  const clips: Clip[] = [];
  const seenClips = new Set<string>();
  let droppedClips = 0;
  for (const raw of (json.clips as unknown[]) ?? []) {
    const c = sanitizeClip(raw, seenTracks);
    if (c && !seenClips.has(c.id)) {
      seenClips.add(c.id);
      clips.push(c);
    } else droppedClips++;
  }
  if (droppedClips) warnings.push(`${droppedClips} trecho(s) inválido(s) foram ignorados.`);

  const categories: Category[] = [];
  const catIds = new Set<string>();
  for (const raw of (json.categories as unknown[]) ?? []) {
    if (!isObj(raw)) continue;
    const id = str(raw.id, 100);
    const name = str(raw.name, 80);
    if (id && name && !catIds.has(id)) {
      catIds.add(id);
      categories.push({ id, name });
    }
  }
  for (const t of tracks) if (t.categoryId && !catIds.has(t.categoryId)) t.categoryId = null;

  const setlists: Setlist[] = [];
  const setIds = new Set<string>();
  for (const raw of (json.setlists as unknown[]) ?? []) {
    if (!isObj(raw)) continue;
    const id = str(raw.id, 100);
    const name = str(raw.name, 80);
    if (!id || !name || setIds.has(id)) continue;
    setIds.add(id);
    const ids = Array.isArray(raw.trackIds) ? raw.trackIds.filter((x): x is string => typeof x === 'string' && seenTracks.has(x)) : [];
    setlists.push({ id, name, trackIds: [...new Set(ids)] });
  }

  return { ok: true, data: { tracks, clips, categories, setlists }, warnings };
}

// ---------- Mesclagem ----------

export function trackKey(t: Track): string {
  return t.source === 'youtube' ? `yt:${t.youtubeId}` : `local:${t.local?.name.toLowerCase()}|${t.local?.size}`;
}

const sameClip = (a: Clip, b: Clip) =>
  Math.abs(a.start - b.start) < 0.01 && Math.abs(a.end - b.end) < 0.01 && a.name.toLowerCase() === b.name.toLowerCase();

export interface MergeReport {
  tracksAdded: number;
  tracksMatched: number;
  clipsAdded: number;
  clipsSkipped: number;
  categoriesAdded: number;
  setlistsAdded: number;
}

export interface MergeResult {
  library: Library;
  report: MergeReport;
  /** Músicas do acervo atual que deixaram de existir (só no modo substituir). */
  removedTrackIds: string[];
}

/**
 * Mescla `incoming` em `existing` sem perder nada do que já existe e sem duplicar:
 * músicas iguais (mesmo vídeo / mesmo arquivo) são unidas e só os trechos novos entram.
 * Com `replace`, o resultado é o conteúdo importado, mas arquivos locais já guardados são reaproveitados.
 */
export function mergeLibraries(existing: Library, incoming: Library, mode: 'merge' | 'replace' = 'merge'): MergeResult {
  const base: Library =
    mode === 'replace'
      ? { tracks: [], clips: [], categories: [], setlists: [] }
      : { tracks: [...existing.tracks], clips: [...existing.clips], categories: [...existing.categories], setlists: existing.setlists.map((s) => ({ ...s, trackIds: [...s.trackIds] })) };

  const report: MergeReport = { tracksAdded: 0, tracksMatched: 0, clipsAdded: 0, clipsSkipped: 0, categoriesAdded: 0, setlistsAdded: 0 };

  const usedIds = new Set<string>([...base.tracks.map((t) => t.id), ...base.clips.map((c) => c.id), ...base.categories.map((c) => c.id), ...base.setlists.map((s) => s.id)]);
  const freeId = (id: string, prefix: string) => {
    let next = id;
    while (usedIds.has(next)) next = uid(prefix);
    usedIds.add(next);
    return next;
  };

  const existingByKey = new Map(existing.tracks.map((t) => [trackKey(t), t]));
  const baseByKey = new Map(base.tracks.map((t) => [trackKey(t), t]));

  // Categorias por nome
  const catMap = new Map<string, string>();
  for (const cat of incoming.categories) {
    const found = base.categories.find((c) => c.name.toLowerCase() === cat.name.toLowerCase());
    if (found) catMap.set(cat.id, found.id);
    else {
      const id = freeId(cat.id, 'cat');
      base.categories.push({ id, name: cat.name });
      catMap.set(cat.id, id);
      report.categoriesAdded++;
    }
  }

  // Músicas
  const trackMap = new Map<string, string>();
  for (const t of incoming.tracks) {
    const key = trackKey(t);
    const match = baseByKey.get(key);
    if (match) {
      trackMap.set(t.id, match.id);
      report.tracksMatched++;
      continue;
    }
    // No modo substituir, reaproveita o ID e o arquivo guardado de uma música equivalente.
    const previous = mode === 'replace' ? existingByKey.get(key) : undefined;
    const id = previous ? freeId(previous.id, 'trk') : freeId(t.id, 'trk');
    const added: Track = {
      ...t,
      id,
      categoryId: t.categoryId ? catMap.get(t.categoryId) ?? null : null,
      local: t.local ? { ...t.local, stored: previous?.local?.stored ?? false } : undefined,
    };
    base.tracks.push(added);
    baseByKey.set(key, added);
    trackMap.set(t.id, id);
    report.tracksAdded++;
  }

  // Trechos (sem duplicar)
  for (const clip of incoming.clips) {
    const trackId = trackMap.get(clip.trackId);
    if (!trackId) continue;
    const siblings = base.clips.filter((c) => c.trackId === trackId);
    const candidate: Clip = { ...clip, trackId, id: clip.id };
    if (siblings.some((c) => sameClip(c, candidate))) {
      report.clipsSkipped++;
      continue;
    }
    candidate.id = freeId(clip.id, 'clip');
    candidate.order = siblings.length ? Math.max(...siblings.map((c) => c.order)) + 1 : clip.order;
    base.clips.push(candidate);
    report.clipsAdded++;
  }

  // Repertórios por nome
  for (const set of incoming.setlists) {
    const ids = set.trackIds.map((id) => trackMap.get(id)).filter((x): x is string => !!x);
    const found = base.setlists.find((s) => s.name.toLowerCase() === set.name.toLowerCase());
    if (found) {
      for (const id of ids) if (!found.trackIds.includes(id)) found.trackIds.push(id);
    } else {
      base.setlists.push({ id: freeId(set.id, 'set'), name: set.name, trackIds: [...new Set(ids)] });
      report.setlistsAdded++;
    }
  }

  const keep = new Set(base.tracks.map((t) => t.id));
  const removedTrackIds = existing.tracks.filter((t) => !keep.has(t.id)).map((t) => t.id);
  return { library: base, report, removedTrackIds };
}
