/** Utilitários de tempo. */

export const MIN_LOOP_LENGTH = 0.2;

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 83.4 -> "1:23"; usa h:mm:ss quando passa de uma hora. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 83.456 -> "1:23.46" (centésimos, para edição precisa). */
export function formatPrecise(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const rounded = Math.round(seconds * 100) / 100;
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded - h * 3600 - m * 60;
  const ss = s.toFixed(2).padStart(5, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * Lê "83", "83.5", "1:23", "1:23.45", "1:02:03" (aceita vírgula decimal).
 * Retorna null quando inválido.
 */
export function parseTime(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (!text) return null;
  const parts = text.split(':');
  if (parts.length > 3) return null;
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!/^\d+(\.\d+)?$/.test(p)) return null;
    const isLast = i === parts.length - 1;
    if (!isLast && p.includes('.')) return null;
    total = total * 60 + parseFloat(p);
  }
  return Number.isFinite(total) ? total : null;
}

export function formatRate(rate: number): string {
  return `${Number.isInteger(rate) ? rate.toFixed(1) : String(parseFloat(rate.toFixed(2)))}×`;
}

/** Retorna a velocidade suportada mais próxima. */
export function nearestRate(rate: number, available: number[]): number {
  if (available.length === 0) return rate;
  let best = available[0];
  for (const r of available) {
    if (Math.abs(r - rate) < Math.abs(best - rate)) best = r;
  }
  return best;
}

export interface LoopRangeCheck {
  ok: boolean;
  message: string | null;
}

/** Valida que B seja posterior a A (com tamanho mínimo) e dentro da duração. */
export function validateRange(a: number | null, b: number | null, duration: number): LoopRangeCheck {
  if (a === null || b === null) return { ok: true, message: null };
  if (a < 0 || b < 0) return { ok: false, message: 'Os tempos não podem ser negativos.' };
  if (duration > 0 && (a > duration + 0.01 || b > duration + 0.01)) {
    return { ok: false, message: 'O tempo ultrapassa a duração da música.' };
  }
  if (b - a < MIN_LOOP_LENGTH) {
    return { ok: false, message: 'O ponto B deve ser posterior ao ponto A.' };
  }
  return { ok: true, message: null };
}
