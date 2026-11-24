/** Andamento (BPM): limites, "tocar no ritmo" e detecção automática a partir do áudio. */

export const MIN_BPM = 30;
export const MAX_BPM = 300;
export const DEFAULT_BPM = 60;
/** Quadros por segundo do envelope de ataques usado na detecção. */
export const ENVELOPE_FPS = 100;
/** Se o intervalo entre toques passar disto, começa uma nova medição. */
export const TAP_RESET_MS = 2000;
const MAX_TAPS = 9;

export function clampBpm(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(n)));
}

/** Registra um toque. Uma pausa longa recomeça a medição. */
export function addTap(taps: number[], now: number): number[] {
  const last = taps[taps.length - 1];
  const next = last !== undefined && now - last <= TAP_RESET_MS && now > last ? [...taps, now] : [now];
  return next.slice(-MAX_TAPS);
}

/** BPM pelos toques (mediana dos intervalos). Precisa de pelo menos 3 toques. */
export function bpmFromTaps(taps: number[]): number | null {
  if (taps.length < 3) return null;
  const intervals: number[] = [];
  for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
  intervals.sort((x, y) => x - y);
  const mid = Math.floor(intervals.length / 2);
  const median = intervals.length % 2 ? intervals[mid] : (intervals[mid - 1] + intervals[mid]) / 2;
  return median > 0 ? 60000 / median : null;
}

/**
 * Envelope de ataques: aumento de energia (em escala logarítmica) a cada quadro.
 * Os picos marcam onde as notas e batidas começam.
 */
export function onsetEnvelope(channels: Float32Array[], sampleRate: number, fps = ENVELOPE_FPS): Float32Array {
  if (channels.length === 0 || sampleRate <= 0) return new Float32Array(0);
  const hop = Math.max(1, Math.round(sampleRate / fps));
  const n = Math.floor(channels[0].length / hop);
  const energy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const start = i * hop;
    for (const data of channels) {
      for (let j = start; j < start + hop; j++) sum += data[j] * data[j];
    }
    energy[i] = Math.log1p(1000 * Math.sqrt(sum / (hop * channels.length)));
  }
  const env = new Float32Array(n);
  for (let i = 1; i < n; i++) env[i] = Math.max(0, energy[i] - energy[i - 1]);
  return env;
}

const DETECT_MIN_BPM = 60;
const DETECT_MAX_BPM = 200;
/** Trecho mínimo, em segundos, para tentar a detecção. */
export const MIN_DETECT_SECONDS = 4;

/**
 * Estima o BPM de um trecho (start–end, em segundos) do envelope de ataques por autocorrelação.
 * Retorna null quando o trecho é curto demais ou não há pulso regular.
 */
export function detectBpm(env: Float32Array, fps = ENVELOPE_FPS, start = 0, end = Infinity): number | null {
  const i0 = Math.max(0, Math.floor(start * fps));
  const i1 = Math.min(env.length, Math.ceil(end * fps));
  const len = i1 - i0;
  if (len < MIN_DETECT_SECONDS * fps) return null;

  const seg = new Float64Array(len);
  let mean = 0;
  for (let i = 0; i < len; i++) mean += env[i0 + i];
  mean /= len;
  let power = 0;
  for (let i = 0; i < len; i++) {
    seg[i] = env[i0 + i] - mean;
    power += seg[i] * seg[i];
  }
  power /= len;
  if (power <= 1e-12) return null;

  const minLag = Math.floor((60 * fps) / DETECT_MAX_BPM);
  const maxLag = Math.min(Math.ceil((60 * fps) / DETECT_MIN_BPM), Math.floor(len / 2));
  if (maxLag <= minLag + 1) return null;
  const acLimit = Math.min(maxLag * 2 + 1, len - 1);
  const ac = new Float64Array(acLimit + 1);
  for (let lag = minLag - 1; lag <= acLimit; lag++) {
    let s = 0;
    for (let i = 0; i + lag < len; i++) s += seg[i] * seg[i + lag];
    ac[lag] = s / (len - lag) / power;
  }

  // Pontuação: autocorrelação reforçada pelo dobro do período, com leve preferência por ~120 BPM.
  let best = -1;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag;
    const weight = Math.exp(-0.5 * Math.log2(bpm / 120) ** 2);
    const score = (ac[lag] + (2 * lag <= acLimit ? 0.5 * ac[2 * lag] : 0)) * weight;
    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }
  if (best < 0 || ac[best] < 0.05) return null;

  // Refinamento parabólico em torno do pico.
  let lag = best;
  if (best > minLag - 1 && best + 1 <= acLimit) {
    const y0 = ac[best - 1];
    const y1 = ac[best];
    const y2 = ac[best + 1];
    const d = y0 - 2 * y1 + y2;
    if (d < 0) lag = best + (0.5 * (y0 - y2)) / d;
  }
  return clampBpm((60 * fps) / lag);
}
