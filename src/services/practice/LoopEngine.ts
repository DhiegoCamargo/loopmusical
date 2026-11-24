import { DEFAULT_PRACTICE, type PracticeConfig } from '../../types';
import { MIN_LOOP_LENGTH, nearestRate } from '../../lib/time';
import { DEFAULT_BPM } from '../../lib/tempo';
import type { MediaController } from '../media/MediaController';

export type SessionPhase = 'idle' | 'running' | 'gap' | 'countin' | 'finished';

export interface EngineSnapshot {
  phase: SessionPhase;
  /** Repetições concluídas na sessão. */
  completed: number;
  /** Total pedido (0 = infinito). */
  total: number;
  /** Velocidade aplicada na repetição atual. */
  currentRate: number;
  /** Segundos restantes da pausa entre repetições. */
  gapRemaining: number;
  /** Tempo atual da contagem (1, 2, 3…) e total de tempos. */
  countBeat: number;
  countTotal: number;
  /** true quando há uma sessão de ensaio em andamento (inclui pausa e contagem). */
  session: boolean;
}

const IDLE: EngineSnapshot = { phase: 'idle', completed: 0, total: 0, currentRate: 1, gapRemaining: 0, countBeat: 0, countTotal: 0, session: false };

/** Velocidades da rampa progressiva: as suportadas entre a inicial e a-alvo. */
export function buildRateSteps(start: number, target: number, available: number[]): number[] {
  const lo = Math.min(start, target);
  const hi = Math.max(start, target);
  const steps = available.filter((r) => r >= lo - 1e-9 && r <= hi + 1e-9).sort((x, y) => x - y);
  if (steps.length === 0) return [nearestRate(hi, available)];
  return steps;
}

export function rateForRepetition(steps: number[], completed: number, repsPerStep: number): number {
  const per = Math.max(1, Math.floor(repsPerStep));
  return steps[Math.min(Math.floor(completed / per), steps.length - 1)];
}

/** Se o usuário pular para além de B por mais que isto, não contamos como repetição. */
const USER_JUMP_THRESHOLD = 2;
const REARM_TIMEOUT_MS = 1500;
const PAUSE_SETTLE_MS = 700;

/**
 * Motor de loop A/B e modo de ensaio. Independe da fonte: usa apenas MediaController.
 * - Loop simples: ao chegar em B, volta a A, indefinidamente.
 * - Sessão de ensaio: conta repetições, aplica pausa e rampa de velocidade, e termina sozinha.
 */
export class LoopEngine {
  private a: number | null = null;
  private b: number | null = null;
  private loopEnabled = false;

  private snapshot: EngineSnapshot = IDLE;
  private listeners = new Set<() => void>();

  private cfg: PracticeConfig | null = null;
  private steps: number[] = [];
  private originalRate = 1;
  private armed = true;
  private armTimer: ReturnType<typeof setTimeout> | null = null;
  private gapTimer: ReturnType<typeof setInterval> | null = null;
  private gapPausedAt = 0;
  private countTimer: ReturnType<typeof setInterval> | null = null;
  private countKind: 'session' | 'plain' = 'plain';
  private config: PracticeConfig = DEFAULT_PRACTICE;
  private unsub: Array<() => void> = [];

  constructor(private controller: MediaController, private onBeat?: (beat: number, total: number) => void) {
    this.unsub.push(controller.subscribeTime((t) => this.onTime(t)));
    this.unsub.push(controller.subscribe(() => this.onState()));
  }

  // ----- API pública -----

  getSnapshot = (): EngineSnapshot => this.snapshot;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  setRange(a: number | null, b: number | null): void {
    this.a = a;
    this.b = b;
  }

  setLoopEnabled(enabled: boolean): void {
    this.loopEnabled = enabled;
  }

  /** Configuração usada pela contagem fora de uma sessão (play com loop ligado). */
  setConfig(cfg: PracticeConfig): void {
    this.config = cfg;
  }

  /** Inicia a contagem e depois toca. Retorna false se não houver contagem a fazer. */
  playWithCountIn(): boolean {
    if (this.config.countIn <= 0 || !this.hasValidRange() || this.isSessionActive() || this.snapshot.phase === 'countin') return false;
    this.beginCountIn('plain');
    return true;
  }

  hasValidRange(): boolean {
    return this.a !== null && this.b !== null && this.b - this.a >= MIN_LOOP_LENGTH;
  }

  isSessionActive(): boolean {
    return this.snapshot.session;
  }

  startSession(cfg: PracticeConfig): boolean {
    if (!this.hasValidRange()) return false;
    this.clearGap();
    this.clearCount();
    this.cfg = { ...cfg };
    const state = this.controller.getState();
    const available = state.availableRates;
    this.originalRate = state.rate;
    this.steps = cfg.progressive
      ? buildRateSteps(cfg.startRate, cfg.targetRate, available)
      : [nearestRate(state.rate, available)];
    const rate = cfg.progressive ? rateForRepetition(this.steps, 0, cfg.repsPerStep) : state.rate;
    if (rate !== state.rate) this.controller.setRate(rate);
    this.set({ ...IDLE, phase: 'running', session: true, total: Math.max(0, Math.floor(cfg.repetitions)), currentRate: rate });
    if (cfg.countIn > 0) {
      this.beginCountIn('session');
      return true;
    }
    this.disarmUntilBackInside();
    this.controller.seek(this.a as number);
    this.controller.play();
    return true;
  }

  /** Interrompe a sessão a qualquer momento. */
  stopSession(restoreRate = true): void {
    const wasActive = this.snapshot.phase !== 'idle';
    const wasCounting = this.snapshot.phase === 'countin';
    this.clearGap();
    this.clearCount();
    if (wasCounting) this.controller.pause();
    if (this.isSessionActive() && restoreRate && this.cfg?.progressive) {
      this.controller.setRate(this.originalRate);
    }
    this.cfg = null;
    if (wasActive) this.set(IDLE);
  }

  dismissFinished(): void {
    if (this.snapshot.phase === 'finished') this.set(IDLE);
  }

  dispose(): void {
    this.clearGap();
    this.clearCount();
    if (this.armTimer) clearTimeout(this.armTimer);
    this.unsub.forEach((u) => u());
    this.unsub = [];
    this.listeners.clear();
  }

  // ----- Internos -----

  private set(next: EngineSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }

  private patchSnap(p: Partial<EngineSnapshot>): void {
    this.set({ ...this.snapshot, ...p });
  }

  private clearGap(): void {
    if (this.gapTimer) clearInterval(this.gapTimer);
    this.gapTimer = null;
  }

  private clearCount(): void {
    if (this.countTimer) clearInterval(this.countTimer);
    this.countTimer = null;
  }

  private beginCountIn(kind: 'session' | 'plain'): void {
    const total = this.config.countIn > 0 && kind === 'plain' ? this.config.countIn : (this.cfg?.countIn ?? 0);
    this.clearCount();
    this.clearGap();
    this.countKind = kind;
    this.gapPausedAt = Date.now();
    this.controller.pause();
    this.controller.seek(this.a as number);
    const beatMs = this.beatMs(kind);
    let beat = 1;
    this.set({ ...this.snapshot, phase: 'countin', countBeat: 1, countTotal: total, gapRemaining: 0 });
    this.onBeat?.(1, total);
    this.countTimer = setInterval(() => {
      beat++;
      if (beat > total) this.finishCountIn();
      else {
        this.patchSnap({ countBeat: beat });
        this.onBeat?.(beat, total);
      }
    }, beatMs);
  }

  /** Duração de um tempo da contagem: segue o BPM da música na velocidade atual. */
  private beatMs(kind: 'session' | 'plain'): number {
    const bpm = (kind === 'session' ? this.cfg?.bpm : this.config.bpm) ?? DEFAULT_BPM;
    const rate = kind === 'session' ? this.snapshot.currentRate : this.controller.getState().rate;
    const effective = Math.max(1, (bpm > 0 ? bpm : DEFAULT_BPM) * (rate > 0 ? rate : 1));
    return 60000 / effective;
  }

  private finishCountIn(): void {
    if (this.snapshot.phase !== 'countin') return;
    this.clearCount();
    if (this.countKind === 'session') this.patchSnap({ phase: 'running', countBeat: 0, countTotal: 0 });
    else this.set(IDLE);
    this.disarmUntilBackInside();
    this.controller.seek(this.a as number);
    this.controller.play();
  }

  private disarmUntilBackInside(): void {
    this.armed = false;
    if (this.armTimer) clearTimeout(this.armTimer);
    this.armTimer = setTimeout(() => (this.armed = true), REARM_TIMEOUT_MS);
  }

  private active(): boolean {
    const p = this.snapshot.phase;
    return this.hasValidRange() && (p === 'running' || (this.loopEnabled && (p === 'idle' || p === 'finished')));
  }

  private onTime(t: number): void {
    if (!this.active()) return;
    if (this.controller.getState().status !== 'playing') return;
    const a = this.a as number;
    const b = this.b as number;
    const edge = b - this.controller.loopLookahead;

    if (!this.armed) {
      // Rearma quando o tempo realmente voltou para dentro do trecho
      if (t < edge - 0.02) {
        this.armed = true;
        if (this.armTimer) clearTimeout(this.armTimer);
      }
      return;
    }
    if (t > b + USER_JUMP_THRESHOLD) {
      // O usuário saiu do trecho: volta sem contar repetição.
      this.disarmUntilBackInside();
      this.controller.seek(a);
      return;
    }
    if (t >= edge) this.boundary();
  }

  private onState(): void {
    const state = this.controller.getState();
    // Vídeo terminou exatamente em B (ou B no fim da música)
    if (state.status === 'ended' && this.active() && this.b !== null && state.duration - this.b < 0.5) {
      this.boundary();
      return;
    }
    // Durante a contagem, tocar manualmente pula a contagem.
    if (this.snapshot.phase === 'countin' && state.status === 'playing' && Date.now() - this.gapPausedAt > PAUSE_SETTLE_MS) {
      this.finishCountIn();
      return;
    }
    // Durante a pausa entre repetições, tocar manualmente encerra a espera.
    if (this.snapshot.phase === 'gap' && state.status === 'playing' && Date.now() - this.gapPausedAt > PAUSE_SETTLE_MS) {
      this.resumeFromGap();
    }
  }

  private boundary(): void {
    const a = this.a as number;
    this.disarmUntilBackInside();

    if (this.snapshot.phase !== 'running' || !this.cfg) {
      // Loop simples
      if (this.config.countEach && this.config.countIn > 0) {
        // A contagem recomeça assim que o loop volta para A.
        this.beginCountIn('plain');
        return;
      }
      this.controller.seek(a);
      if (this.controller.getState().status === 'ended') this.controller.play();
      return;
    }

    const completed = this.snapshot.completed + 1;
    const { total } = this.snapshot;

    if (total > 0 && completed >= total) {
      this.controller.pause();
      this.controller.seek(a);
      this.set({ ...IDLE, phase: 'finished', completed, total, currentRate: this.snapshot.currentRate });
      this.cfg = null;
      return;
    }

    let currentRate = this.snapshot.currentRate;
    if (this.cfg.progressive) {
      const next = rateForRepetition(this.steps, completed, this.cfg.repsPerStep);
      if (next !== currentRate) {
        this.controller.setRate(next);
        currentRate = next;
      }
    }

    if (this.cfg.gap > 0) {
      this.gapPausedAt = Date.now();
      this.controller.pause();
      this.controller.seek(a);
      this.set({ ...this.snapshot, phase: 'gap', completed, currentRate, gapRemaining: this.cfg.gap });
      this.clearGap();
      const startedAt = Date.now();
      const gapMs = this.cfg.gap * 1000;
      this.gapTimer = setInterval(() => {
        const remaining = Math.max(0, (gapMs - (Date.now() - startedAt)) / 1000);
        if (remaining <= 0) this.resumeFromGap();
        else this.patchSnap({ gapRemaining: remaining });
      }, 100);
      return;
    }

    if (this.cfg.countEach && this.cfg.countIn > 0) {
      this.set({ ...this.snapshot, completed, currentRate });
      this.beginCountIn('session');
      return;
    }
    this.set({ ...this.snapshot, completed, currentRate });
    this.controller.seek(a);
  }

  private resumeFromGap(): void {
    if (this.snapshot.phase !== 'gap') return;
    this.clearGap();
    if (this.cfg && this.cfg.countEach && this.cfg.countIn > 0) {
      this.beginCountIn('session');
      return;
    }
    this.disarmUntilBackInside();
    this.patchSnap({ phase: 'running', gapRemaining: 0 });
    this.controller.seek(this.a as number);
    this.controller.play();
  }
}
