import { useLibrary } from '../hooks/useLibrary';
import { loadPrefs } from '../services/storage/prefs';
import type { Track } from '../types';
import { formatClock } from '../lib/time';
import { AddSource } from './library/AddSource';
import { Icon } from './ui/Icon';

export function Welcome({ onOpen, notify }: { onOpen: (t: Track) => void; notify: (t: string, k?: 'info' | 'error' | 'success') => void }) {
  const lib = useLibrary();
  const last = lib.getTrack(loadPrefs().lastTrackId);

  return (
    <section className="card mx-auto w-full max-w-xl space-y-5 p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
          <Icon name="repeat" size={26} />
        </span>
        <div>
          <h2 className="text-xl font-bold">Comece a ensaiar</h2>
          <p className="text-sm text-ink-300">Abra um vídeo do YouTube ou um arquivo seu e marque o trecho que quer repetir.</p>
        </div>
      </div>

      {last && (
        <button
          className="flex w-full items-center gap-3 rounded-xl border border-brand-500/50 bg-brand-500/10 p-3 text-left transition hover:bg-brand-500/20"
          onClick={() => onOpen(last)}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-ink-950">
            <Icon name="play" size={18} />
          </span>
          <span className="min-w-0">
            <span className="label block !text-brand-300">Retomar último ensaio</span>
            <span className="block truncate font-medium">{last.title}</span>
            <span className="tabular block truncate text-xs text-ink-300">
              Parou em {formatClock(last.session.position)}
              {last.session.a !== null && last.session.b !== null ? ` · trecho ${formatClock(last.session.a)}–${formatClock(last.session.b)}` : ''}
            </span>
          </span>
        </button>
      )}

      <AddSource onOpen={onOpen} notify={notify} />
    </section>
  );
}
