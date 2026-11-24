import type { MediaState, SourceKind } from '../../types';

/**
 * Contrato único para qualquer fonte de reprodução (YouTube, arquivo local, futuras).
 * A interface visual e o motor de loop dependem só deste contrato.
 */
export interface MediaController {
  readonly kind: SourceKind;
  /**
   * Antecipação (s) usada pelo motor de loop: o salto para A é disparado um pouco
   * antes de B para compensar a latência da fonte. YouTube precisa de mais margem.
   */
  readonly loopLookahead: number;

  getState(): MediaState;
  getCurrentTime(): number;

  /** Notificação de mudança de estado (compatível com useSyncExternalStore). */
  subscribe(listener: () => void): () => void;
  /** Notificação do tempo atual (alta frequência). */
  subscribeTime(listener: (time: number) => void): () => void;

  play(): void;
  pause(): void;
  /** `final` = false enquanto o usuário ainda arrasta a linha do tempo. */
  seek(time: number, final?: boolean): void;
  setRate(rate: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}

export const INITIAL_MEDIA_STATE: MediaState = {
  status: 'loading',
  duration: 0,
  rate: 1,
  volume: 1,
  muted: false,
  availableRates: [1],
  error: null,
  sourceTitle: null,
};

/** Base com a mecânica de assinaturas; as fontes implementam apenas o controle da mídia. */
export abstract class BaseMediaController implements MediaController {
  abstract readonly kind: SourceKind;
  abstract readonly loopLookahead: number;

  protected state: MediaState = { ...INITIAL_MEDIA_STATE };
  private listeners = new Set<() => void>();
  private timeListeners = new Set<(t: number) => void>();
  protected destroyed = false;

  getState = (): MediaState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  subscribeTime = (listener: (t: number) => void): (() => void) => {
    this.timeListeners.add(listener);
    return () => this.timeListeners.delete(listener);
  };

  protected patch(partial: Partial<MediaState>): void {
    if (this.destroyed) return;
    let changed = false;
    for (const key of Object.keys(partial) as (keyof MediaState)[]) {
      const next = partial[key];
      const prev = this.state[key];
      if (Array.isArray(next) && Array.isArray(prev)) {
        if (next.length !== prev.length || next.some((v, i) => v !== prev[i])) changed = true;
      } else if (next !== prev) {
        changed = true;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l());
  }

  protected emitTime(t: number): void {
    if (this.destroyed) return;
    this.timeListeners.forEach((l) => l(t));
  }

  abstract getCurrentTime(): number;
  abstract play(): void;
  abstract pause(): void;
  abstract seek(time: number, final?: boolean): void;
  abstract setRate(rate: number): void;
  abstract setVolume(volume: number): void;
  abstract setMuted(muted: boolean): void;

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
    this.timeListeners.clear();
  }
}
