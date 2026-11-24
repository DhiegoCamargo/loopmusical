import { useState, type ReactNode } from 'react';
import { clamp } from '../../lib/time';
import { Switch, TimeField } from '../ui/controls';
import { Icon } from '../ui/Icon';

interface PointProps {
  letter: 'A' | 'B';
  value: number | null;
  duration: number;
  disabled: boolean;
  onMark: () => void;
  onSet: (v: number | null) => boolean;
}

function Point({ letter, value, duration, disabled, onMark, onSet }: PointProps) {
  const nudge = (d: number) => {
    if (value !== null) onSet(clamp(Math.round((value + d) * 100) / 100, 0, duration));
  };
  return (
    <div className="space-y-2 rounded-xl border border-ink-700 bg-ink-900/60 p-3">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-400 text-sm font-bold text-ink-950">{letter}</span>
        <div className="min-w-0 flex-1">
          <TimeField label={`Tempo do ponto ${letter}`} value={value} onCommit={onSet} disabled={disabled} />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button className="btn !px-2.5" onClick={() => nudge(-0.1)} disabled={disabled || value === null} aria-label={`Ponto ${letter} 0,1 s antes`} title="−0,1 s">
          −0,1
        </button>
        <button className="btn btn-primary flex-1" onClick={onMark} disabled={disabled}>
          Marcar {letter} aqui
        </button>
        <button className="btn !px-2.5" onClick={() => nudge(0.1)} disabled={disabled || value === null} aria-label={`Ponto ${letter} 0,1 s depois`} title="+0,1 s">
          +0,1
        </button>
      </div>
      <input
        type="range"
        className="range"
        min={0}
        max={duration || 1}
        step={0.01}
        value={value ?? 0}
        disabled={disabled || value === null}
        onChange={(e) => onSet(parseFloat(e.target.value))}
        aria-label={`Ajustar ponto ${letter}`}
      />
    </div>
  );
}

interface Props {
  a: number | null;
  b: number | null;
  duration: number;
  loopEnabled: boolean;
  disabled: boolean;
  error: string | null;
  isYouTube: boolean;
  onMarkA: () => void;
  onMarkB: () => void;
  onSetA: (v: number | null) => boolean;
  onSetB: (v: number | null) => boolean;
  onToggleLoop: () => void;
  onClear: () => void;
  onSaveClip: (name: string) => void;
  countIn: number;
  onCountIn: (beats: number) => void;
  countEach: boolean;
  onCountEach: (v: boolean) => void;
  /** Controles de andamento da contagem. */
  tempo?: ReactNode;
}

export function LoopPanel({ a, b, duration, loopEnabled, disabled, error, isYouTube, onMarkA, onMarkB, onSetA, onSetB, onToggleLoop, onClear, onSaveClip, countIn, onCountIn, countEach, onCountEach, tempo }: Props) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const hasRange = a !== null && b !== null;

  const submit = () => {
    onSaveClip(name);
    setName('');
    setNaming(false);
  };

  return (
    <section className="card space-y-3 p-4" aria-labelledby="loop-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="loop-title" className="flex items-center gap-2 text-base font-semibold">
          <Icon name="repeat" size={18} className="text-brand-400" /> Loop A–B
        </h2>
        <label className="flex items-center gap-2 text-sm text-ink-200">
          <span>{loopEnabled ? 'Repetindo' : 'Repetir trecho'}</span>
          <Switch checked={loopEnabled} onChange={onToggleLoop} label="Ativar repetição do trecho" disabled={disabled} />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-2">
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={countIn > 0} onChange={(v) => onCountIn(v ? 3 : 0)} label="Contagem antes de iniciar a repetição" />
          <span>
            <span className="block font-medium">Contagem antes de iniciar</span>
            <span className="block text-xs text-ink-400">{countIn > 0 ? Array.from({ length: countIn }, (_, i) => i + 1).join(' · ') + ' · e toca' : 'Desligada'}</span>
          </span>
        </label>
        {countIn > 0 && (
          <select className="field !w-auto" aria-label="Tempos da contagem" value={countIn} onChange={(e) => onCountIn(parseInt(e.target.value, 10))}>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} tempos</option>
            ))}
          </select>
        )}
        {countIn > 0 && (
          <div className="w-full space-y-3 border-t border-ink-700 pt-3">
            <label className="flex items-center gap-2 text-sm text-ink-200">
              <input type="checkbox" className="accent-[#34e0cc]" checked={countEach} onChange={(e) => onCountEach(e.target.checked)} />
              Contar de novo cada vez que o loop volta
            </label>
            {tempo}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Point letter="A" value={a} duration={duration} disabled={disabled} onMark={onMarkA} onSet={onSetA} />
        <Point letter="B" value={b} duration={duration} disabled={disabled} onMark={onMarkB} onSet={onSetB} />
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          <Icon name="alert" size={16} /> {error}
        </p>
      )}

      {naming ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            className="field min-w-0 flex-1"
            placeholder="Nome do trecho (ex.: Refrão)"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setNaming(false);
            }}
            aria-label="Nome do trecho"
          />
          <button className="btn btn-primary" onClick={submit}>
            <Icon name="check" size={16} /> Salvar
          </button>
          <button className="btn btn-ghost" onClick={() => setNaming(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => setNaming(true)} disabled={disabled || !hasRange}>
            <Icon name="bookmark" size={16} /> Salvar trecho
          </button>
          <button className="btn btn-ghost" onClick={onClear} disabled={disabled || (!hasRange && a === null && b === null)}>
            <Icon name="eraser" size={16} /> Limpar A e B
          </button>
        </div>
      )}

      {isYouTube && (
        <p className="text-xs text-ink-400">
          No YouTube, a repetição depende da API oficial e pode haver uma pequena folga no ponto de retorno. Para precisão máxima, use um arquivo local.
        </p>
      )}
    </section>
  );
}
