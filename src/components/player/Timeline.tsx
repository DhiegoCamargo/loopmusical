import { memo, useEffect, useRef, type PointerEvent as RPointerEvent } from 'react';
import { useMediaTime } from '../../hooks/useMedia';
import type { MediaController } from '../../services/media/MediaController';
import { clamp, formatClock } from '../../lib/time';

interface Props {
  controller: MediaController | null;
  duration: number;
  a: number | null;
  b: number | null;
  /** Picos reais da forma de onda (apenas arquivos de áudio locais). */
  peaks: Float32Array | null;
  waveformLoading: boolean;
  onSeek: (t: number, final: boolean) => void;
  onChangeA: (t: number) => boolean;
  onChangeB: (t: number) => boolean;
}

type Drag = 'seek' | 'a' | 'b' | null;

function Waveform({ peaks, a, b, duration }: { peaks: Float32Array; a: number | null; b: number | null; duration: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      const bars = Math.floor(w / 3);
      const mid = h / 2;
      const inA = a !== null && b !== null && duration > 0 ? a / duration : -1;
      const inB = a !== null && b !== null && duration > 0 ? b / duration : -1;
      for (let i = 0; i < bars; i++) {
        const from = Math.floor((i / bars) * peaks.length);
        const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * peaks.length));
        let p = 0;
        for (let k = from; k < to && k < peaks.length; k++) p = Math.max(p, peaks[k]);
        const frac = i / bars;
        const active = inA >= 0 && frac >= inA && frac <= inB;
        ctx.fillStyle = active ? '#34e0cc' : '#556070';
        const bh = Math.max(2, p * (h - 8));
        ctx.fillRect(i * 3, mid - bh / 2, 2, bh);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [peaks, a, b, duration]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

function TimelineImpl({ controller, duration, a, b, peaks, waveformLoading, onSeek, onChangeA, onChangeB }: Props) {
  const time = useMediaTime(controller);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>(null);
  const lastSeek = useRef(0);

  const pct = (t: number) => (duration > 0 ? clamp((t / duration) * 100, 0, 100) : 0);
  const timeAt = (e: { clientX: number }) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width === 0 || duration <= 0) return 0;
    return clamp(((e.clientX - r.left) / r.width) * duration, 0, duration);
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const handle = (e.target as HTMLElement).dataset.handle;
    drag.current = handle === 'a' ? 'a' : handle === 'b' ? 'b' : 'seek';
    e.currentTarget.setPointerCapture(e.pointerId);
    if (drag.current === 'seek') onSeek(timeAt(e), false);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const t = timeAt(e);
    if (drag.current === 'seek') {
      const now = performance.now();
      if (now - lastSeek.current > 100) {
        lastSeek.current = now;
        onSeek(t, false);
      }
    } else if (drag.current === 'a') onChangeA(t);
    else onChangeB(t);
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    if (drag.current === 'seek') onSeek(timeAt(e), true);
    drag.current = null;
  };

  const hasRange = a !== null && b !== null;
  const hasWave = !!peaks;
  const heightClass = hasWave || waveformLoading ? 'h-24' : 'h-14';

  return (
    <div className="select-none">
      <div
        ref={box}
        role="slider"
        aria-label="Linha do tempo"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${formatClock(time)} de ${formatClock(duration)}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={`relative ${heightClass} w-full cursor-pointer touch-none overflow-visible rounded-xl border border-ink-700 bg-ink-900`}
      >
        {/* Faixa base sem forma de onda: barra convencional */}
        {!hasWave && (
          <>
            <div className="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink-600" />
            <div className="absolute left-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink-300" style={{ width: `calc((100% - 1.5rem) * ${pct(time) / 100})` }} />
          </>
        )}
        {hasWave && peaks && <Waveform peaks={peaks} a={a} b={b} duration={duration} />}
        {waveformLoading && <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-300">Lendo forma de onda…</div>}

        {/* Intervalo A–B */}
        {hasRange && (
          <div
            className="pointer-events-none absolute inset-y-0 border-x-2 border-brand-400 bg-brand-400/15"
            style={{ left: `${pct(a)}%`, width: `${Math.max(0, pct(b) - pct(a))}%` }}
          />
        )}

        {/* Alças A e B */}
        {a !== null && (
          <button
            type="button"
            data-handle="a"
            aria-label="Arrastar ponto A"
            className="absolute -top-2 bottom-[-8px] z-10 w-6 -translate-x-1/2 cursor-ew-resize touch-none"
            style={{ left: `${pct(a)}%` }}
          >
            <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md bg-brand-400 px-1.5 text-xs font-bold text-ink-950">A</span>
          </button>
        )}
        {b !== null && (
          <button
            type="button"
            data-handle="b"
            aria-label="Arrastar ponto B"
            className="absolute -top-2 bottom-[-8px] z-10 w-6 -translate-x-1/2 cursor-ew-resize touch-none"
            style={{ left: `${pct(b)}%` }}
          >
            <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md bg-brand-400 px-1.5 text-xs font-bold text-ink-950">B</span>
          </button>
        )}

        {/* Cabeça de reprodução */}
        <div
          className="pointer-events-none absolute inset-y-0 z-[5] w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_rgba(255,255,255,.6)]"
          style={{ left: `${pct(time)}%` }}
        />
      </div>
      <div className="tabular mt-1.5 flex justify-between px-1 text-xs text-ink-300">
        <span>{formatClock(time)}</span>
        <span>{formatClock(duration)}</span>
      </div>
    </div>
  );
}

export const Timeline = memo(TimelineImpl);
