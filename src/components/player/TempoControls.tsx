import { useRef, useState } from 'react';
import type { Waveform } from '../../hooks/useWaveform';
import { playCountClick } from '../../services/audio/click';
import { addTap, bpmFromTaps, clampBpm, detectBpm, ENVELOPE_FPS, MAX_BPM, MIN_BPM, MIN_DETECT_SECONDS } from '../../lib/tempo';
import { formatRate } from '../../lib/time';
import { NumberField } from '../ui/controls';
import { Icon } from '../ui/Icon';

interface Props {
  bpm: number;
  /** Velocidade de reprodução atual (o BPM guardado é sempre o da música em 1×). */
  rate: number;
  onChange: (bpm: number) => void;
  waveform: Waveform;
  isYouTube: boolean;
  a: number | null;
  b: number | null;
  disabled?: boolean;
}

/** Andamento da contagem: ajuste manual, "tocar no ritmo" e detecção automática. */
export function TempoControls({ bpm, rate, onChange, waveform, isYouTube, a, b, disabled }: Props) {
  const taps = useRef<number[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const r = rate > 0 ? rate : 1;

  const tap = () => {
    taps.current = addTap(taps.current, performance.now());
    playCountClick(1, 2);
    const measured = bpmFromTaps(taps.current);
    if (measured === null) {
      setMsg(`Continue tocando no ritmo da música… (${taps.current.length} toque${taps.current.length > 1 ? 's' : ''})`);
      return;
    }
    // Os toques acompanham a música na velocidade atual; guardamos o andamento original.
    const value = clampBpm(measured / r);
    onChange(value);
    setMsg(`Medido pelos toques: ${value} BPM. Continue tocando para refinar.`);
  };

  const canDetect = waveform.status === 'ready' && !!waveform.envelope;
  const detect = () => {
    if (!waveform.envelope) return;
    const useRange = a !== null && b !== null && b - a >= MIN_DETECT_SECONDS;
    const found = detectBpm(waveform.envelope, ENVELOPE_FPS, useRange ? (a as number) : 0, useRange ? (b as number) : Infinity);
    if (found === null) {
      setMsg('Não encontrei um pulso claro. Use “Tocar no ritmo” ou ajuste o BPM manualmente.');
      return;
    }
    onChange(found);
    setMsg(`Andamento identificado${useRange ? ' no trecho A–B' : ''}: ${found} BPM. Se soar no dobro ou na metade, ajuste manualmente.`);
  };

  const detectHint = canDetect
    ? null
    : waveform.status === 'loading'
      ? 'Analisando o áudio…'
      : isYouTube
        ? 'A detecção automática não está disponível no YouTube (o áudio do vídeo não é acessível). Use “Tocar no ritmo”.'
        : 'A detecção automática funciona com arquivos de áudio enviados. Use “Tocar no ritmo”.';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-200">Andamento</span>
        <NumberField label="Andamento da contagem em BPM" value={bpm} onChange={(v) => onChange(clampBpm(v))} min={MIN_BPM} max={MAX_BPM} suffix="BPM" disabled={disabled} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={tap} disabled={disabled} title="Toque no ritmo da música, pelo menos 3 vezes">
          <Icon name="music" size={16} /> Tocar no ritmo
        </button>
        <button type="button" className="btn" onClick={detect} disabled={disabled || !canDetect}>
          <Icon name="search" size={16} /> Detectar automaticamente
        </button>
      </div>
      {Math.abs(r - 1) > 1e-6 && (
        <p className="tabular text-xs text-ink-300">
          Na velocidade {formatRate(r)}, a contagem soa a {Math.round(bpm * r)} BPM.
        </p>
      )}
      {msg && <p className="text-xs text-brand-300" aria-live="polite">{msg}</p>}
      {detectHint && <p className="text-xs text-ink-400">{detectHint}</p>}
    </div>
  );
}
