/** Preferências simples em LocalStorage (com proteção contra bloqueio de armazenamento). */

export interface Prefs {
  volume: number;
  muted: boolean;
  lastTrackId: string | null;
  sidebarTab: 'library' | 'clips' | 'practice';
  /** Tamanho do vídeo: normal, pequeno ou oculto (só o player). */
  videoView: VideoView;
}

export type VideoView = 'full' | 'compact' | 'hidden';

const KEY = 'loop-musical:prefs:v1';
const DEFAULTS: Prefs = { volume: 0.9, muted: false, lastTrackId: null, sidebarTab: 'library', videoView: 'full' };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      volume: typeof p.volume === 'number' && p.volume >= 0 && p.volume <= 1 ? p.volume : DEFAULTS.volume,
      muted: typeof p.muted === 'boolean' ? p.muted : DEFAULTS.muted,
      lastTrackId: typeof p.lastTrackId === 'string' ? p.lastTrackId : null,
      sidebarTab: p.sidebarTab === 'clips' || p.sidebarTab === 'practice' ? p.sidebarTab : 'library',
      videoView: p.videoView === 'compact' || p.videoView === 'hidden' ? p.videoView : 'full',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...loadPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* armazenamento indisponível: ignora */
  }
  return next;
}
