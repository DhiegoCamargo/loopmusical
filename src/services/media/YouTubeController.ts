/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseMediaController } from './MediaController';
import { loadYouTubeApi, youtubeErrorMessage } from './youtubeApi';

export interface YouTubeOptions {
  videoId: string;
  startSeconds?: number;
  volume: number;
  muted: boolean;
}

const PLAYING_POLL_MS = 50;
const IDLE_POLL_MS = 250;

/**
 * Fonte YouTube, usando somente a IFrame Player API oficial.
 * Precisão do loop limitada pela taxa de consulta (~50 ms) e pela latência do seek.
 */
export class YouTubeController extends BaseMediaController {
  readonly kind = 'youtube' as const;
  readonly loopLookahead = 0.12;

  private player: any = null;
  private pollTimer: number | null = null;
  private lastTime = 0;
  private mountEl: HTMLElement;

  constructor(private host: HTMLElement, private opts: YouTubeOptions) {
    super();
    this.state = { ...this.state, volume: opts.volume, muted: opts.muted };
    this.mountEl = document.createElement('div');
    this.mountEl.className = 'h-full w-full';
    host.appendChild(this.mountEl);
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      const YT = await loadYouTubeApi();
      if (this.destroyed) return;
      this.player = new YT.Player(this.mountEl, {
        videoId: this.opts.videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          disablekb: 1,
          fs: 0,
          start: this.opts.startSeconds ? Math.floor(this.opts.startSeconds) : undefined,
          origin: window.location.origin,
        },
        events: {
          onReady: () => this.onReady(),
          onStateChange: (e: any) => this.onStateChange(e.data),
          onPlaybackRateChange: () => this.syncRate(),
          onError: (e: any) => this.patch({ status: 'error', error: youtubeErrorMessage(e.data) }),
        },
      });
    } catch (err) {
      this.patch({ status: 'error', error: err instanceof Error ? err.message : 'Falha ao iniciar o YouTube.' });
    }
  }

  private onReady(): void {
    if (this.destroyed) return;
    try {
      this.player.setVolume(Math.round(this.opts.volume * 100));
      if (this.opts.muted) this.player.mute();
    } catch {
      /* ignore */
    }
    const rates: number[] = this.safe(() => this.player.getAvailablePlaybackRates(), [1]);
    this.patch({
      status: 'ready',
      availableRates: rates.length ? [...rates].sort((a, b) => a - b) : [1],
      duration: this.safe(() => this.player.getDuration(), 0) || 0,
      rate: this.safe(() => this.player.getPlaybackRate(), 1) || 1,
      sourceTitle: this.readTitle(),
    });
    this.restartPoll();
  }

  private readTitle(): string | null {
    const data = this.safe<any>(() => this.player.getVideoData(), null);
    return data && data.title ? String(data.title) : null;
  }

  private safe<T>(fn: () => T, fallback: T): T {
    try {
      const v = fn();
      return v === undefined || v === null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  private onStateChange(code: number): void {
    // -1 não iniciado, 0 terminado, 1 reproduzindo, 2 pausado, 3 carregando, 5 pronto
    switch (code) {
      case 1:
      case 3:
        this.patch({ status: 'playing' });
        break;
      case 2:
        this.patch({ status: 'paused' });
        break;
      case 0:
        this.patch({ status: 'ended' });
        break;
      default:
        if (this.state.status !== 'error') this.patch({ status: 'ready' });
    }
    const duration = this.safe(() => this.player.getDuration(), 0);
    const title = this.readTitle();
    this.patch({ ...(duration > 0 ? { duration } : {}), ...(title ? { sourceTitle: title } : {}) });
    this.syncRate();
    this.restartPoll();
  }

  private syncRate(): void {
    if (!this.player) return;
    const rate = this.safe(() => this.player.getPlaybackRate(), 1);
    this.patch({ rate });
  }

  private restartPoll(): void {
    if (this.pollTimer !== null) window.clearInterval(this.pollTimer);
    const playing = this.state.status === 'playing';
    this.pollTimer = window.setInterval(() => this.tick(), playing ? PLAYING_POLL_MS : IDLE_POLL_MS);
  }

  private tick(): void {
    if (!this.player || this.destroyed) return;
    const t = this.safe(() => this.player.getCurrentTime(), this.lastTime);
    if (this.state.duration <= 0) {
      const d = this.safe(() => this.player.getDuration(), 0);
      if (d > 0) this.patch({ duration: d });
    }
    if (t !== this.lastTime || this.state.status === 'playing') {
      this.lastTime = t;
      this.emitTime(t);
    }
  }

  getCurrentTime(): number {
    return this.lastTime;
  }

  play(): void {
    this.safe(() => this.player.playVideo(), undefined);
  }

  pause(): void {
    this.safe(() => this.player.pauseVideo(), undefined);
  }

  seek(time: number, final = true): void {
    const t = Math.max(0, time);
    this.safe(() => this.player.seekTo(t, final), undefined);
    this.lastTime = t;
    this.emitTime(t);
  }

  setRate(rate: number): void {
    this.safe(() => this.player.setPlaybackRate(rate), undefined);
    this.patch({ rate });
  }

  setVolume(volume: number): void {
    const v = Math.min(1, Math.max(0, volume));
    this.safe(() => this.player.setVolume(Math.round(v * 100)), undefined);
    if (v > 0 && this.state.muted) this.setMuted(false);
    this.patch({ volume: v });
  }

  setMuted(muted: boolean): void {
    this.safe(() => (muted ? this.player.mute() : this.player.unMute()), undefined);
    this.patch({ muted });
  }

  override destroy(): void {
    if (this.pollTimer !== null) window.clearInterval(this.pollTimer);
    this.pollTimer = null;
    try {
      this.player?.destroy?.();
    } catch {
      /* ignore */
    }
    this.player = null;
    this.mountEl.remove();
    this.host.replaceChildren();
    super.destroy();
  }
}
