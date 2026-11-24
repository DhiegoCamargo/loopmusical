import { BaseMediaController } from './MediaController';

/** Velocidades oferecidas para arquivos locais (0,5× a 2×). */
export const LOCAL_RATES = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

export interface LocalOptions {
  blob: Blob;
  isVideo: boolean;
  volume: number;
  muted: boolean;
}

function mediaErrorMessage(el: HTMLMediaElement): string {
  const code = el.error?.code;
  if (code === 4) return 'O navegador não consegue reproduzir este formato de arquivo.';
  if (code === 3) return 'O arquivo parece estar corrompido ou incompleto.';
  if (code === 2) return 'Erro ao ler o arquivo.';
  return 'Não foi possível reproduzir este arquivo.';
}

/** Fonte de arquivo local via HTMLMediaElement, com verificação de tempo a cada quadro. */
export class LocalMediaController extends BaseMediaController {
  readonly kind = 'local' as const;
  readonly loopLookahead = 0.03;
  readonly element: HTMLMediaElement;
  private url: string;
  private raf = 0;

  constructor(host: HTMLElement, opts: LocalOptions) {
    super();
    this.element = document.createElement(opts.isVideo ? 'video' : 'audio');
    const el = this.element;
    el.preload = 'auto';
    el.controls = false;
    if (el instanceof HTMLVideoElement) {
      el.playsInline = true;
      el.className = 'h-full w-full bg-black object-contain';
    } else {
      el.style.display = 'none';
    }
    this.url = URL.createObjectURL(opts.blob);
    el.src = this.url;
    el.volume = opts.volume;
    el.muted = opts.muted;
    this.setPitchPreservation();
    this.state = {
      ...this.state,
      volume: opts.volume,
      muted: opts.muted,
      availableRates: LOCAL_RATES,
    };
    this.bind();
    host.appendChild(el);
  }

  private setPitchPreservation(): void {
    const el = this.element as HTMLMediaElement & {
      preservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
      mozPreservesPitch?: boolean;
    };
    el.preservesPitch = true;
    el.webkitPreservesPitch = true;
    el.mozPreservesPitch = true;
  }

  private bind(): void {
    const el = this.element;
    const on = (type: string, fn: () => void) => el.addEventListener(type, fn);
    on('loadedmetadata', () => {
      this.patch({ status: 'ready', duration: Number.isFinite(el.duration) ? el.duration : 0 });
      this.emitTime(el.currentTime);
    });
    on('durationchange', () => this.patch({ duration: Number.isFinite(el.duration) ? el.duration : 0 }));
    on('play', () => {
      this.patch({ status: 'playing' });
      this.startFrames();
    });
    on('playing', () => this.patch({ status: 'playing' }));
    on('pause', () => {
      if (!el.ended) this.patch({ status: 'paused' });
      this.emitTime(el.currentTime);
    });
    on('ended', () => {
      this.patch({ status: 'ended' });
      this.emitTime(el.currentTime);
    });
    on('seeked', () => this.emitTime(el.currentTime));
    on('timeupdate', () => this.emitTime(el.currentTime));
    on('ratechange', () => this.patch({ rate: el.playbackRate }));
    on('volumechange', () => this.patch({ volume: el.volume, muted: el.muted }));
    on('error', () => this.patch({ status: 'error', error: mediaErrorMessage(el) }));
  }

  private startFrames(): void {
    cancelAnimationFrame(this.raf);
    const loop = () => {
      if (this.destroyed) return;
      this.emitTime(this.element.currentTime);
      if (!this.element.paused && !this.element.ended) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  getCurrentTime(): number {
    return this.element.currentTime;
  }

  play(): void {
    void this.element.play().catch(() => {
      /* bloqueio de autoplay ou interrupção: o usuário pode tentar de novo */
    });
  }

  pause(): void {
    this.element.pause();
  }

  seek(time: number): void {
    const d = Number.isFinite(this.element.duration) ? this.element.duration : Infinity;
    this.element.currentTime = Math.min(Math.max(0, time), d);
    this.emitTime(this.element.currentTime);
  }

  setRate(rate: number): void {
    this.element.playbackRate = rate;
    this.setPitchPreservation();
  }

  setVolume(volume: number): void {
    const v = Math.min(1, Math.max(0, volume));
    this.element.volume = v;
    if (v > 0 && this.element.muted) this.element.muted = false;
  }

  setMuted(muted: boolean): void {
    this.element.muted = muted;
  }

  override destroy(): void {
    cancelAnimationFrame(this.raf);
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    this.element.remove();
    URL.revokeObjectURL(this.url);
    super.destroy();
  }
}
