import { useCallback, useEffect, useRef, useState } from 'react';
import { LibraryProvider, useLibrary } from './hooks/useLibrary';
import { useStudySession } from './hooks/useStudySession';
import { useKeyboardShortcuts, SHORTCUTS } from './hooks/useKeyboardShortcuts';
import { useWaveform } from './hooks/useWaveform';
import { loadPrefs, savePrefs } from './services/storage/prefs';
import type { Track } from './types';
import { formatRate } from './lib/time';
import { Icon } from './components/ui/Icon';
import { Toasts, type ToastMessage } from './components/ui/controls';
import { PlayerStage } from './components/player/PlayerStage';
import { Timeline } from './components/player/Timeline';
import { Transport } from './components/player/Transport';
import { LoopPanel } from './components/player/LoopPanel';
import { LibraryPanel } from './components/library/LibraryPanel';
import { ClipsPanel } from './components/clips/ClipsPanel';
import { PracticePanel } from './components/practice/PracticePanel';
import { Welcome } from './components/Welcome';

type Tab = 'library' | 'clips' | 'practice';

function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Atalhos de teclado" className="card max-h-full w-full max-w-md animate-fade-in overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icon name="keyboard" size={20} className="text-brand-400" /> Atalhos de teclado
          </h2>
          <button className="icon-btn !size-9" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={18} />
          </button>
        </div>
        <ul className="divide-y divide-ink-700">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span className="text-ink-200">{s.label}</span>
              <kbd className="tabular shrink-0 rounded-md border border-ink-600 bg-ink-700 px-2 py-0.5 text-xs">{s.keys}</kbd>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-400">Os atalhos funcionam no computador, quando o foco está fora de campos de texto. Com o vídeo do YouTube em foco, clique fora dele antes de usar o teclado.</p>
      </div>
    </div>
  );
}

function Shell({ notify }: { notify: (text: string, kind?: ToastMessage['kind']) => void }) {
  const lib = useLibrary();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => loadPrefs().sidebarTab);
  const [help, setHelp] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  const track = lib.getTrack(activeId);
  const session = useStudySession(track);
  const waveform = useWaveform(session.controller);

  const changeTab = (t: Tab) => {
    setTab(t);
    savePrefs({ sidebarTab: t });
  };

  const openTrack = useCallback((t: Track) => {
    setActiveId(t.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const toggleFullscreen = useCallback(() => {
    if (!canFullscreen) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void cardRef.current?.requestFullscreen?.().catch(() => notify('Não foi possível entrar em tela cheia.', 'error'));
  }, [canFullscreen, notify]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    document.title = track ? `${track.title} — Loop Musical` : 'Loop Musical — Ouça. Repita. Aprenda.';
  }, [track?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // Se a música aberta foi removida (por exemplo, ao importar substituindo tudo)
  useEffect(() => {
    if (activeId && lib.ready && !lib.getTrack(activeId)) setActiveId(null);
  }, [lib, activeId]);

  useKeyboardShortcuts(
    {
      togglePlay: session.togglePlay,
      skip: session.skip,
      volumeStep: (d) => session.setVolume(Math.min(1, Math.max(0, session.media.volume + d))),
      markA: () => void session.markA(),
      markB: () => void session.markB(),
      toggleLoop: session.toggleLoop,
      clearRange: session.clearRange,
      stepRate: session.stepRate,
      toggleMute: session.toggleMute,
      toggleFullscreen,
      escape: () => {
        if (help) setHelp(false);
        else session.stopPractice();
      },
      showHelp: () => setHelp(true),
    },
    !!track,
  );

  const { media, engineSnap } = session;
  const practiceActive = engineSnap.session;
  const disabled = !session.controller || media.status === 'loading' || media.status === 'error';

  const tabs: Array<{ id: Tab; label: string; icon: 'library' | 'bookmark' | 'timer'; badge?: number }> = [
    { id: 'library', label: 'Biblioteca', icon: 'library', badge: lib.library.tracks.length || undefined },
    { id: 'clips', label: 'Trechos', icon: 'bookmark', badge: track ? lib.clipsOf(track.id).length || undefined : undefined },
    { id: 'practice', label: 'Ensaio', icon: 'timer' },
  ];

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-3 py-2.5 lg:px-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-500 text-ink-950">
            <Icon name="repeat" size={20} />
          </span>
          <div className="min-w-0 leading-tight">
            <h1 className="text-lg font-bold tracking-tight">Loop Musical</h1>
            <p className="hidden text-xs text-brand-300 min-[420px]:block">Ouça. Repita. Aprenda.</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button className="icon-btn hidden lg:inline-flex" onClick={() => setHelp(true)} aria-label="Atalhos de teclado" title="Atalhos de teclado (?)">
              <Icon name="keyboard" size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:p-5">
        <div className="min-w-0 space-y-4">
          {!track ? (
            <Welcome onOpen={openTrack} notify={notify} />
          ) : (
            <>
              <section ref={cardRef} className="player-card card space-y-3 p-3 sm:p-4" aria-label="Player">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-brand-400">
                    <Icon name={track.source === 'youtube' ? 'video' : 'music'} size={17} />
                  </span>
                  <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{track.title}</h2>
                  <button className="icon-btn !size-9" onClick={() => setActiveId(null)} aria-label="Fechar música" title="Fechar música">
                    <Icon name="x" size={18} />
                  </button>
                </div>

                <PlayerStage track={track} media={media} fileState={session.fileState} setHost={session.setHost} onProvideFile={(f) => void session.provideFile(f)} countBeat={engineSnap.phase === 'countin' ? engineSnap.countBeat : 0} />

                {(practiceActive || engineSnap.phase === 'finished') && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-500/60 bg-brand-500/10 px-3 py-2 text-sm" aria-live="polite">
                    <span className="tabular">
                      {engineSnap.phase === 'finished'
                        ? `Ensaio concluído · ${engineSnap.completed} repetições`
                        : engineSnap.phase === 'countin' ? `Contagem · ${engineSnap.countBeat} de ${engineSnap.countTotal}` : `Ensaio · ${engineSnap.completed}${engineSnap.total ? ` de ${engineSnap.total}` : ''} · ${formatRate(engineSnap.currentRate)}${engineSnap.phase === 'gap' ? ` · pausa ${engineSnap.gapRemaining.toFixed(1)} s` : ''}`}
                    </span>
                    {practiceActive ? (
                      <button className="btn !py-1 text-xs" onClick={session.stopPractice}>
                        <Icon name="stop" size={14} /> Parar
                      </button>
                    ) : (
                      <button className="btn btn-ghost !py-1 text-xs" onClick={session.dismissFinished}>Fechar</button>
                    )}
                  </div>
                )}

                <Timeline
                  controller={session.controller}
                  duration={media.duration}
                  a={session.a}
                  b={session.b}
                  peaks={waveform.peaks}
                  waveformLoading={waveform.status === 'loading'}
                  onSeek={(t, final) => session.seek(t, final)}
                  onChangeA={(t) => session.setPointA(t)}
                  onChangeB={(t) => session.setPointB(t)}
                />
                <Transport
                  controller={session.controller}
                  media={media}
                  canFullscreen={canFullscreen}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={toggleFullscreen}
                  onTogglePlay={session.togglePlay}
                  onSkip={session.skip}
                  onRate={session.setRate}
                  onStepRate={session.stepRate}
                  onVolume={session.setVolume}
                  onToggleMute={session.toggleMute}
                />
              </section>

              <LoopPanel
                a={session.a}
                b={session.b}
                duration={media.duration}
                loopEnabled={session.loopEnabled}
                disabled={disabled}
                error={session.rangeError}
                isYouTube={track.source === 'youtube'}
                onMarkA={() => void session.markA()}
                onMarkB={() => void session.markB()}
                onSetA={(v) => session.setPointA(v)}
                onSetB={(v) => session.setPointB(v)}
                countIn={session.practice.countIn}
                onCountIn={(n) => session.updatePractice({ countIn: n })}
                onToggleLoop={session.toggleLoop}
                onClear={session.clearRange}
                onSaveClip={(name) => {
                  const clip = session.saveClip(name);
                  if (clip) notify(`Trecho “${clip.name}” salvo.`, 'success');
                }}
              />
            </>
          )}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-[4.25rem] lg:flex lg:max-h-[calc(100dvh-5.5rem)] lg:flex-col lg:self-start">
          <div role="tablist" aria-label="Painéis" className="mb-3 grid grid-cols-3 gap-1 rounded-2xl border border-ink-700 bg-ink-800/80 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => changeTab(t.id)}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-medium transition ${
                  tab === t.id ? 'bg-brand-500 text-ink-950' : 'text-ink-200 hover:bg-ink-700'
                }`}
              >
                <Icon name={t.icon} size={16} /> {t.label}
                {t.badge ? <span className={`tabular rounded-full px-1.5 text-xs ${tab === t.id ? 'bg-ink-950/20' : 'bg-ink-600'}`}>{t.badge}</span> : null}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {tab === 'library' && <LibraryPanel activeId={activeId} onOpen={openTrack} onDeleted={(id) => id === activeId && setActiveId(null)} notify={notify} />}
            {tab === 'clips' && <ClipsPanel session={session} />}
            {tab === 'practice' && <PracticePanel session={session} />}
          </div>
        </aside>
      </main>

      {help && <HelpDialog onClose={() => setHelp(false)} />}
    </div>
  );
}

export default function App() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const notify = useCallback((text: string, kind: ToastMessage['kind'] = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 9000 : 5000);
  }, []);

  return (
    <LibraryProvider onError={(m) => notify(m, 'error')}>
      <Shell notify={notify} />
      <Toasts items={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </LibraryProvider>
  );
}
