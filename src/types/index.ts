/** Tipos centrais do Loop Musical. */

export type SourceKind = 'youtube' | 'local';

/** Configuração do modo de ensaio (salva por música e exportada no JSON). */
export interface PracticeConfig {
  /** Número de repetições da sessão. 0 = infinito. */
  repetitions: number;
  /** Pausa entre repetições, em segundos (0 = sem pausa). */
  gap: number;
  /** Aumento progressivo de velocidade. */
  progressive: boolean;
  startRate: number;
  targetRate: number;
  /** Quantas repetições em cada degrau de velocidade. */
  repsPerStep: number;
  /** Contagem antes de iniciar (1, 2, 3…): número de tempos. 0 = desligada. */
  countIn: number;
  /** Repetir a contagem a cada volta do ensaio. */
  countEach: boolean;
}

export const DEFAULT_PRACTICE: PracticeConfig = {
  repetitions: 0,
  gap: 0,
  progressive: false,
  startRate: 0.75,
  targetRate: 1,
  repsPerStep: 2,
  countIn: 0,
  countEach: false,
};

/** Estado de estudo salvo automaticamente por música. */
export interface TrackSession {
  position: number;
  a: number | null;
  b: number | null;
  loopEnabled: boolean;
  rate: number;
  activeClipId: string | null;
}

export interface LocalFileInfo {
  name: string;
  size: number;
  mimeType: string;
  isVideo: boolean;
  /** Se o arquivo foi guardado no IndexedDB deste navegador. */
  stored: boolean;
}

export interface Track {
  id: string;
  title: string;
  /** Título ainda é o provisório e pode ser substituído pelo do YouTube. */
  autoTitle?: boolean;
  source: SourceKind;
  youtubeId?: string;
  youtubeUrl?: string;
  /** Início sugerido (segundos) lido do link (parâmetro t=). */
  youtubeStart?: number;
  local?: LocalFileInfo;
  favorite: boolean;
  categoryId: string | null;
  duration?: number;
  practice: PracticeConfig;
  session: TrackSession;
  createdAt: number;
  updatedAt: number;
  lastPlayedAt?: number;
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  start: number;
  end: number;
  rate: number;
  /** 0 = infinito */
  repetitions: number;
  gap: number;
  order: number;
}

export interface Category {
  id: string;
  name: string;
}

/** Repertório: lista ordenada de músicas. */
export interface Setlist {
  id: string;
  name: string;
  trackIds: string[];
}

export interface Library {
  tracks: Track[];
  clips: Clip[];
  categories: Category[];
  setlists: Setlist[];
}

export const EMPTY_LIBRARY: Library = { tracks: [], clips: [], categories: [], setlists: [] };

export const EXPORT_APP = 'loop-musical';
export const EXPORT_VERSION = 1;

export interface ExportFile extends Library {
  app: typeof EXPORT_APP;
  version: number;
  exportedAt: string;
}

/** Interface comum a todas as fontes de reprodução. */
export type MediaStatus = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export interface MediaState {
  status: MediaStatus;
  duration: number;
  rate: number;
  volume: number;
  muted: boolean;
  availableRates: number[];
  error: string | null;
  /** Título informado pela própria fonte (YouTube). */
  sourceTitle: string | null;
}
