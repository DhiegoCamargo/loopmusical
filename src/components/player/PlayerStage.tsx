import { useRef } from 'react';
import type { FileState } from '../../hooks/useStudySession';
import type { MediaState, Track } from '../../types';
import { Icon } from '../ui/Icon';

interface Props {
  track: Track | null;
  media: MediaState;
  fileState: FileState;
  setHost: (el: HTMLDivElement | null) => void;
  onProvideFile: (file: File) => void;
  /** Tempo atual da contagem (1, 2, 3…); 0 = sem contagem. */
  countBeat?: number;
}

/**
 * Área de vídeo. O elemento `host` sempre existe: o controlador de mídia (YouTube ou local)
 * monta nele o player. Mensagens e estados vazios ficam sobrepostos.
 */
export function PlayerStage({ track, media, fileState, setHost, onProvideFile, countBeat = 0 }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const isAudio = track?.source === 'local' && track.local && !track.local.isVideo;
  const loading = !!track && media.status === 'loading' && fileState !== 'missing';

  return (
    <div className={`stage relative w-full overflow-hidden rounded-2xl bg-black ${isAudio ? 'h-40 sm:h-48' : 'aspect-video'}`}>
      <div ref={setHost} className={`absolute inset-0 ${isAudio ? 'invisible' : ''}`} />

      {isAudio && track && media.status !== 'error' && (
        <div className="absolute inset-0 flex items-center gap-4 bg-gradient-to-br from-ink-800 to-ink-950 px-6">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
            <Icon name="headphones" size={40} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{track.title}</p>
            <p className="truncate text-sm text-ink-300">{track.local?.name}</p>
          </div>
        </div>
      )}

      {countBeat > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ink-950/70" role="status" aria-live="assertive">
          <span key={countBeat} className="tabular animate-fade-in text-8xl font-bold text-brand-300 drop-shadow-lg sm:text-9xl">{countBeat}</span>
        </div>
      )}

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-950/60">
          <div className="size-9 animate-spin rounded-full border-4 border-ink-600 border-t-brand-400" role="status" aria-label="Carregando" />
        </div>
      )}

      {track && fileState === 'missing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900 p-6 text-center">
          <Icon name="file" size={36} className="text-warn" />
          <p className="font-medium">Selecione novamente o arquivo desta música</p>
          <p className="max-w-sm text-sm text-ink-300">
            O arquivo “{track.local?.name}” não está guardado neste navegador. Escolha-o de novo para continuar; seus trechos continuam salvos.
          </p>
          <button className="btn btn-primary" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={18} /> Escolher arquivo
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="audio/*,video/*,.mp3,.wav,.mp4,.m4a,.ogg,.webm,.flac,.aac"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onProvideFile(f);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {media.status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900 p-6 text-center" role="alert">
          <Icon name="alert" size={36} className="text-danger" />
          <p className="max-w-md font-medium">{media.error}</p>
          {track?.source === 'youtube' && track.youtubeUrl && (
            <a className="btn" href={track.youtubeUrl} target="_blank" rel="noreferrer noopener">
              Abrir no YouTube
            </a>
          )}
        </div>
      )}
    </div>
  );
}
