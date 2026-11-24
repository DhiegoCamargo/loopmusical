import { useEffect, useState } from 'react';
import type { MediaController } from '../services/media/MediaController';
import type { LocalMediaController } from '../services/media/LocalMediaController';
import { onsetEnvelope } from '../lib/tempo';

export type WaveformStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

const MAX_BYTES = 60 * 1024 * 1024;
const BUCKETS = 1600;

export interface Waveform {
  status: WaveformStatus;
  /** Picos reais (0–1) calculados a partir do áudio decodificado. */
  peaks: Float32Array | null;
  /** Envelope de ataques (ENVELOPE_FPS quadros/s), usado para detectar o andamento. */
  envelope: Float32Array | null;
}

const NONE: Waveform = { status: 'idle', peaks: null, envelope: null };

/** Calcula a forma de onda real de um arquivo de áudio local. Nunca gera dados fictícios. */
export function useWaveform(controller: MediaController | null): Waveform {
  const [wf, setWf] = useState<Waveform>(NONE);

  useEffect(() => {
    if (!controller || controller.kind !== 'local') {
      setWf(NONE);
      return;
    }
    const el = (controller as LocalMediaController).element;
    if (!el || el instanceof HTMLVideoElement) {
      setWf({ status: 'unavailable', peaks: null, envelope: null });
      return;
    }
    let cancelled = false;
    setWf({ status: 'loading', peaks: null, envelope: null });

    (async () => {
      const Ctx: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) throw new Error('sem AudioContext');
      const res = await fetch(el.src);
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) throw new Error('arquivo grande demais');
      const ctx = new Ctx();
      try {
        const audio = await ctx.decodeAudioData(buf);
        const peaks = new Float32Array(BUCKETS);
        const size = Math.max(1, Math.floor(audio.length / BUCKETS));
        for (let ch = 0; ch < audio.numberOfChannels; ch++) {
          const data = audio.getChannelData(ch);
          for (let i = 0; i < BUCKETS; i++) {
            let max = peaks[i];
            const start = i * size;
            const end = Math.min(start + size, data.length);
            for (let j = start; j < end; j++) {
              const v = Math.abs(data[j]);
              if (v > max) max = v;
            }
            peaks[i] = max;
          }
        }
        let global = 0;
        for (const p of peaks) if (p > global) global = p;
        if (global > 0) for (let i = 0; i < BUCKETS; i++) peaks[i] /= global;
        const channels = Array.from({ length: audio.numberOfChannels }, (_, ch) => audio.getChannelData(ch));
        const envelope = onsetEnvelope(channels, audio.sampleRate);
        if (!cancelled) setWf({ status: 'ready', peaks, envelope });
      } finally {
        void ctx.close();
      }
    })().catch(() => {
      if (!cancelled) setWf({ status: 'unavailable', peaks: null, envelope: null });
    });

    return () => {
      cancelled = true;
    };
  }, [controller]);

  return wf;
}
