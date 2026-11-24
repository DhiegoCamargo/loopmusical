import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { MediaState } from '../types';
import { INITIAL_MEDIA_STATE, type MediaController } from '../services/media/MediaController';
import type { EngineSnapshot, LoopEngine } from '../services/practice/LoopEngine';

const EMPTY_STATE: MediaState = { ...INITIAL_MEDIA_STATE };
const NOOP = () => {};

/** Estado de baixa frequência do player (status, duração, velocidade, volume...). */
export function useMediaState(controller: MediaController | null): MediaState {
  const subscribe = useCallback((cb: () => void) => (controller ? controller.subscribe(cb) : NOOP), [controller]);
  const getSnapshot = useCallback(() => (controller ? controller.getState() : EMPTY_STATE), [controller]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Tempo atual (alta frequência). Use só em componentes pequenos (relógio, linha do tempo). */
export function useMediaTime(controller: MediaController | null): number {
  const [time, setTime] = useState(0);
  useEffect(() => {
    if (!controller) {
      setTime(0);
      return;
    }
    setTime(controller.getCurrentTime());
    return controller.subscribeTime(setTime);
  }, [controller]);
  return time;
}

const IDLE_ENGINE: EngineSnapshot = { phase: 'idle', completed: 0, total: 0, currentRate: 1, gapRemaining: 0, countBeat: 0, countTotal: 0, session: false };

export function useEngineSnapshot(engine: LoopEngine | null): EngineSnapshot {
  const subscribe = useCallback((cb: () => void) => (engine ? engine.subscribe(cb) : NOOP), [engine]);
  const getSnapshot = useCallback(() => (engine ? engine.getSnapshot() : IDLE_ENGINE), [engine]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
