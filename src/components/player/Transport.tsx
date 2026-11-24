import { memo } from 'react';
import { useMediaTime } from '../../hooks/useMedia';
import type { MediaController } from '../../services/media/MediaController';
import type { MediaState } from '../../types';
import { formatClock, formatRate } from '../../lib/time';
import { Icon } from '../ui/Icon';

interface Props {
  controller: MediaController | null;
  media: MediaState;
  canFullscreen: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onTogglePlay: () => void;
  onSkip: (delta: number) => void;
  onRate: (rate: number) => void;
  onStepRate: (dir: 1 | -1) => void;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
}

function Clock({ controller, duration }: { controller: MediaController | null; duration: number }) {
  const t = useMediaTime(controller);
  return (
    <div className="tabular whitespace-nowrap text-sm text-ink-200" aria-label="Tempo atual e duração">
      <span className="font-semibold text-ink-100">{formatClock(t)}</span>
      <span className="text-ink-400"> / {formatClock(duration)}</span>
    </div>
  );
}

function TransportImpl({ controller, media, canFullscreen, isFullscreen, onToggleFullscreen, onTogglePlay, onSkip, onRate, onStepRate, onVolume, onToggleMute }: Props) {
  const disabled = !controller || media.status === 'loading' || media.status === 'error';
  const playing = media.status === 'playing';
  const rates = media.availableRates;
  const volumeIcon = media.muted || media.volume === 0 ? 'volume-x' : media.volume < 0.5 ? 'volume-low' : 'volume';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        <button className="icon-btn !size-12" onClick={() => onSkip(-5)} disabled={disabled} aria-label="Voltar 5 segundos" title="Voltar 5 s (←)">
          <Icon name="back5" size={26} />
        </button>
        <button
          className="inline-flex size-16 items-center justify-center rounded-full bg-brand-500 text-ink-950 shadow-lg shadow-brand-500/20 transition hover:bg-brand-400 active:scale-95 disabled:opacity-40"
          onClick={onTogglePlay}
          disabled={disabled}
          aria-label={playing ? 'Pausar' : 'Reproduzir'}
          title="Reproduzir / pausar (Espaço)"
        >
          <Icon name={playing ? 'pause' : 'play'} size={30} />
        </button>
        <button className="icon-btn !size-12" onClick={() => onSkip(5)} disabled={disabled} aria-label="Avançar 5 segundos" title="Avançar 5 s (→)">
          <Icon name="forward5" size={26} />
        </button>
        <div className="ml-2 hidden sm:block">
          <Clock controller={controller} duration={media.duration} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="sm:hidden">
          <Clock controller={controller} duration={media.duration} />
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Velocidade">
          <button className="icon-btn !size-9" onClick={() => onStepRate(-1)} disabled={disabled} aria-label="Reduzir velocidade" title="Mais lento ([)">
            <Icon name="minus" size={16} />
          </button>
          <label className="sr-only" htmlFor="rate-select">Velocidade</label>
          <select
            id="rate-select"
            className="field tabular !w-[5.2rem] !py-1.5 text-center font-semibold"
            value={rates.find((r) => Math.abs(r - media.rate) < 1e-6) ?? media.rate}
            disabled={disabled}
            onChange={(e) => onRate(parseFloat(e.target.value))}
          >
            {!rates.some((r) => Math.abs(r - media.rate) < 1e-6) && <option value={media.rate}>{formatRate(media.rate)}</option>}
            {rates.map((r) => (
              <option key={r} value={r}>
                {formatRate(r)}
              </option>
            ))}
          </select>
          <button className="icon-btn !size-9" onClick={() => onStepRate(1)} disabled={disabled} aria-label="Aumentar velocidade" title="Mais rápido (])">
            <Icon name="plus" size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button className="icon-btn !size-9" onClick={onToggleMute} disabled={disabled} aria-label={media.muted ? 'Ativar som' : 'Silenciar'} title="Silenciar (M)">
            <Icon name={volumeIcon} size={20} />
          </button>
          <input
            type="range"
            className="range hidden !w-24 md:block"
            min={0}
            max={1}
            step={0.01}
            value={media.muted ? 0 : media.volume}
            disabled={disabled}
            onChange={(e) => onVolume(parseFloat(e.target.value))}
            aria-label="Volume"
          />
        </div>

        {canFullscreen && (
          <button className="icon-btn !size-9" onClick={onToggleFullscreen} aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} title="Tela cheia (F)">
            <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

export const Transport = memo(TransportImpl);
