import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PRACTICE, type Clip, type PracticeConfig, type Track } from '../types';
import { clamp, nearestRate, validateRange, MIN_LOOP_LENGTH } from '../lib/time';
import { useLibrary } from './useLibrary';
import { useEngineSnapshot, useMediaState } from './useMedia';
import type { MediaController } from '../services/media/MediaController';
import { YouTubeController } from '../services/media/YouTubeController';
import { LocalMediaController } from '../services/media/LocalMediaController';
import { LoopEngine } from '../services/practice/LoopEngine';
import { loadPrefs, savePrefs } from '../services/storage/prefs';
import { playCountClick } from '../services/audio/click';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type FileState = 'ok' | 'loading' | 'missing';

/**
 * Orquestra uma sessão de estudo: cria a fonte de mídia da música ativa, mantém os
 * pontos A/B, o loop, o modo de ensaio e salva tudo automaticamente.
 */
export function useStudySession(track: Track | null) {
  const lib = useLibrary();
  const trackId = track?.id ?? null;

  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [controller, setController] = useState<MediaController | null>(null);
  const [engine, setEngine] = useState<LoopEngine | null>(null);
  const [fileState, setFileState] = useState<FileState>('ok');
  const [fileVersion, setFileVersion] = useState(0);

  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [practice, setPractice] = useState<PracticeConfig>(DEFAULT_PRACTICE);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const media = useMediaState(controller);
  const engineSnap = useEngineSnapshot(engine);

  // Cópias mutáveis para uso em callbacks e no salvamento automático
  const live = useRef({ a, b, loopEnabled, practice, activeClipId, controller, trackId, engine });
  live.current = { a, b, loopEnabled, practice, activeClipId, controller, trackId, engine };

  // ---------- Salvamento automático ----------
  const flush = useCallback(
    (forTrackId?: string | null, forController?: MediaController | null) => {
      const l = live.current;
      const id = forTrackId ?? l.trackId;
      const c = forController ?? l.controller;
      if (!id || !c) return;
      const st = c.getState();
      if (st.status === 'loading' || st.status === 'error') return;
      lib.updateTrack(
        id,
        {
          session: { position: round2(c.getCurrentTime()), a: l.a, b: l.b, loopEnabled: l.loopEnabled, rate: st.rate, activeClipId: l.activeClipId },
          practice: l.practice,
        },
        false,
      );
    },
    [lib],
  );
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // ---------- Criação / destruição do controlador ----------
  useEffect(() => {
    if (!trackId || !host) {
      setController(null);
      setEngine(null);
      return;
    }
    const t = lib.getTrack(trackId);
    if (!t) return;

    // Restaura o estado de estudo salvo
    setA(t.session.a);
    setB(t.session.b);
    setLoopEnabled(t.session.loopEnabled);
    setActiveClipId(t.session.activeClipId);
    setPractice({ ...DEFAULT_PRACTICE, ...t.practice });
    setRangeError(null);
    setFileState('ok');

    const prefs = loadPrefs();
    let cancelled = false;
    let ctrl: MediaController | null = null;
    let eng: LoopEngine | null = null;
    let unsubReady: (() => void) | null = null;

    const finish = (c: MediaController) => {
      ctrl = c;
      eng = new LoopEngine(c, playCountClick);
      eng.setConfig({ ...DEFAULT_PRACTICE, ...t.practice });
      eng.setRange(t.session.a, t.session.b);
      eng.setLoopEnabled(t.session.loopEnabled);
      setController(c);
      setEngine(eng);
      savePrefs({ lastTrackId: trackId });
      // Ao ficar pronto: restaura velocidade e posição
      let applied = false;
      unsubReady = c.subscribe(() => {
        const s = c.getState();
        if (applied || s.status === 'loading' || s.status === 'error') return;
        applied = true;
        const rate = nearestRate(t.session.rate, s.availableRates);
        if (rate !== s.rate) c.setRate(rate);
        if (c.kind === 'local' && t.session.position > 0) c.seek(t.session.position);
      });
    };

    if (t.source === 'youtube' && t.youtubeId) {
      finish(
        new YouTubeController(host, {
          videoId: t.youtubeId,
          startSeconds: t.session.position > 0 ? t.session.position : t.youtubeStart,
          volume: prefs.volume,
          muted: prefs.muted,
        }),
      );
    } else if (t.source === 'local' && t.local) {
      setFileState('loading');
      void lib.getFile(trackId).then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setFileState('missing');
          return;
        }
        setFileState('ok');
        finish(new LocalMediaController(host, { blob, isVideo: !!t.local?.isVideo, volume: prefs.volume, muted: prefs.muted }));
      });
    }

    return () => {
      cancelled = true;
      flushRef.current(trackId, ctrl);
      unsubReady?.();
      eng?.dispose();
      ctrl?.destroy();
      setController(null);
      setEngine(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, host, fileVersion]);

  useEffect(() => {
    engine?.setConfig(practice);
  }, [engine, practice]);

  // Mantém o motor sincronizado com A/B/loop
  useEffect(() => {
    engine?.setRange(a, b);
    engine?.setLoopEnabled(loopEnabled);
  }, [engine, a, b, loopEnabled]);

  // Salvamento: debounce nas mudanças e batimento enquanto toca
  useEffect(() => {
    if (!controller) return;
    const id = window.setTimeout(() => flushRef.current(), 1200);
    return () => window.clearTimeout(id);
  }, [controller, a, b, loopEnabled, practice, activeClipId, media.rate]);

  useEffect(() => {
    if (!controller) return;
    if (media.status === 'paused') flushRef.current();
    if (media.status !== 'playing') return;
    if (trackId) lib.updateTrack(trackId, { lastPlayedAt: Date.now() }, false);
    const id = window.setInterval(() => flushRef.current(), 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, media.status, trackId]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushRef.current();
    };
    const onUnload = () => flushRef.current();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onUnload);
    };
  }, []);

  // Metadados descobertos durante a reprodução (duração, título do YouTube)
  useEffect(() => {
    if (!trackId) return;
    const t = lib.getTrack(trackId);
    if (!t) return;
    if (media.duration > 0 && Math.abs((t.duration ?? 0) - media.duration) > 0.5) {
      lib.updateTrack(trackId, { duration: media.duration }, false);
    }
    if (t.source === 'youtube' && t.autoTitle && media.sourceTitle) {
      lib.updateTrack(trackId, { title: media.sourceTitle, autoTitle: false }, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, media.duration, media.sourceTitle]);

  // ---------- Ações ----------
  const duration = media.duration;

  const togglePlay = useCallback(() => {
    const c = live.current.controller;
    if (!c) return;
    const st = c.getState();
    if (st.status === 'playing') {
      c.pause();
      return;
    }
    const { a: pa, b: pb, loopEnabled: le } = live.current;
    const t = c.getCurrentTime();
    if (le && pa !== null && pb !== null && (t < pa - 0.05 || t >= pb - 0.05)) c.seek(pa);
    else if (st.status === 'ended') c.seek(0);
    if (le && live.current.engine?.playWithCountIn()) return;
    c.play();
  }, []);

  const seek = useCallback((t: number, final = true) => {
    const c = live.current.controller;
    if (!c) return;
    const d = c.getState().duration;
    c.seek(clamp(t, 0, d > 0 ? d : Math.max(t, 0)), final);
  }, []);

  const skip = useCallback(
    (delta: number) => {
      const c = live.current.controller;
      if (c) seek(c.getCurrentTime() + delta);
    },
    [seek],
  );

  const setRate = useCallback((rate: number) => {
    const c = live.current.controller;
    if (!c) return;
    c.setRate(nearestRate(rate, c.getState().availableRates));
  }, []);

  const stepRate = useCallback((dir: 1 | -1) => {
    const c = live.current.controller;
    if (!c) return;
    const { rate, availableRates } = c.getState();
    const sorted = [...availableRates].sort((x, y) => x - y);
    const i = sorted.findIndex((r) => Math.abs(r - rate) < 1e-6);
    const next = sorted[clamp((i < 0 ? sorted.length - 1 : i) + dir, 0, sorted.length - 1)];
    if (next !== undefined) c.setRate(next);
  }, []);

  const setVolume = useCallback((v: number) => {
    live.current.controller?.setVolume(v);
    savePrefs({ volume: v, muted: false });
  }, []);

  const toggleMute = useCallback(() => {
    const c = live.current.controller;
    if (!c) return;
    const m = !c.getState().muted;
    c.setMuted(m);
    savePrefs({ muted: m });
  }, []);

  /** Aplica um intervalo validado; retorna se foi aceito. */
  const applyRange = useCallback(
    (na: number | null, nb: number | null): boolean => {
      const check = validateRange(na, nb, duration);
      if (!check.ok) {
        setRangeError(check.message);
        return false;
      }
      setRangeError(null);
      setA(na);
      setB(nb);
      setActiveClipId(null);
      if (na === null || nb === null) {
        setLoopEnabled(false);
        engine?.stopSession();
      }
      return true;
    },
    [duration, engine],
  );

  const setPointA = useCallback((v: number | null) => applyRange(v === null ? null : round2(Math.max(0, v)), live.current.b), [applyRange]);
  const setPointB = useCallback(
    (v: number | null) => applyRange(live.current.a, v === null ? null : round2(Math.max(0, duration > 0 ? Math.min(v, duration) : v))),
    [applyRange, duration],
  );

  const markA = useCallback(() => {
    const c = live.current.controller;
    if (!c) return false;
    const ok = setPointA(c.getCurrentTime());
    if (!ok) setRangeError('O ponto A deve ser anterior ao ponto B.');
    return ok;
  }, [setPointA]);

  const markB = useCallback(() => {
    const c = live.current.controller;
    if (!c) return false;
    if (live.current.a === null) {
      setRangeError('Marque primeiro o ponto A.');
      return false;
    }
    const ok = setPointB(c.getCurrentTime());
    if (!ok) setRangeError('O ponto B deve ser posterior ao ponto A.');
    return ok;
  }, [setPointB]);

  const clearRange = useCallback(() => {
    engine?.stopSession();
    setA(null);
    setB(null);
    setLoopEnabled(false);
    setActiveClipId(null);
    setRangeError(null);
  }, [engine]);

  const toggleLoop = useCallback(() => {
    const { a: pa, b: pb, loopEnabled: le } = live.current;
    if (le) {
      setLoopEnabled(false);
      return;
    }
    if (pa === null || pb === null) {
      setRangeError('Marque os pontos A e B para ativar o loop.');
      return;
    }
    setRangeError(null);
    setLoopEnabled(true);
  }, []);

  const saveClip = useCallback(
    (name?: string): Clip | null => {
      const { a: pa, b: pb, practice: pr, controller: c } = live.current;
      if (!trackId || pa === null || pb === null || !c) {
        setRangeError('Marque os pontos A e B antes de salvar um trecho.');
        return null;
      }
      const n = lib.clipsOf(trackId).length + 1;
      const clip = lib.addClip(trackId, {
        name: name?.trim() || `Trecho ${n}`,
        start: pa,
        end: pb,
        rate: c.getState().rate,
        repetitions: pr.repetitions,
        gap: pr.gap,
      });
      setActiveClipId(clip.id);
      return clip;
    },
    [lib, trackId],
  );

  const selectClip = useCallback(
    (clip: Clip) => {
      const c = live.current.controller;
      engine?.stopSession();
      setRangeError(null);
      setA(clip.start);
      setB(clip.end);
      setLoopEnabled(true);
      setActiveClipId(clip.id);
      setPractice((p) => ({ ...p, repetitions: clip.repetitions, gap: clip.gap }));
      if (c) {
        c.setRate(nearestRate(clip.rate, c.getState().availableRates));
        c.seek(clip.start);
      }
    },
    [engine],
  );

  const updatePractice = useCallback((patch: Partial<PracticeConfig>) => setPractice((p) => ({ ...p, ...patch })), []);

  const startPractice = useCallback((): boolean => {
    const { a: pa, b: pb, practice: pr } = live.current;
    if (!engine || pa === null || pb === null || pb - pa < MIN_LOOP_LENGTH) {
      setRangeError('Marque os pontos A e B para iniciar o ensaio.');
      return false;
    }
    setRangeError(null);
    return engine.startSession(pr);
  }, [engine]);

  const stopPractice = useCallback(() => engine?.stopSession(), [engine]);
  const dismissFinished = useCallback(() => engine?.dismissFinished(), [engine]);

  const provideFile = useCallback(
    async (file: File) => {
      if (!trackId) return;
      await lib.attachFile(trackId, file, true);
      setFileVersion((v) => v + 1);
    },
    [lib, trackId],
  );

  return {
    track,
    setHost,
    controller,
    media,
    fileState,
    provideFile,
    a,
    b,
    loopEnabled,
    rangeError,
    clearRangeError: () => setRangeError(null),
    practice,
    engineSnap,
    activeClipId,
    togglePlay,
    seek,
    skip,
    setRate,
    stepRate,
    setVolume,
    toggleMute,
    setPointA,
    setPointB,
    markA,
    markB,
    clearRange,
    toggleLoop,
    saveClip,
    selectClip,
    updatePractice,
    startPractice,
    stopPractice,
    dismissFinished,
  };
}

export type StudySession = ReturnType<typeof useStudySession>;
