import { useId, useRef, useState, type FormEvent } from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import { parseYouTubeUrl } from '../../lib/youtube';
import type { Track } from '../../types';
import { Icon } from '../ui/Icon';

interface Props {
  onOpen: (track: Track) => void;
  notify: (text: string, kind?: 'info' | 'error' | 'success') => void;
  compact?: boolean;
}

/** Adiciona uma música: link do YouTube ou arquivo local. */
export function AddSource({ onOpen, notify, compact }: Props) {
  const lib = useLibrary();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [storeLocal, setStoreLocal] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const urlId = useId();

  const submitUrl = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseYouTubeUrl(url);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    const { track, existed } = await lib.addYouTubeTrack(parsed.value);
    if (existed) notify('Esta música já estava na biblioteca. Abrindo.', 'info');
    setUrl('');
    onOpen(track);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/^(audio|video)\//.test(file.type) && !/\.(mp3|wav|mp4|m4a|m4v|ogg|oga|opus|webm|flac|aac|mov)$/i.test(file.name)) {
      setError('Escolha um arquivo de áudio ou vídeo (MP3, WAV, MP4…).');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { track, existed, storedOk } = await lib.addLocalTrack(file, storeLocal);
      if (existed) notify('Este arquivo já estava na biblioteca. Abrindo.', 'info');
      else if (storeLocal && !storedOk) notify('Não foi possível guardar o arquivo neste navegador (espaço ou permissão). Ele toca agora, mas será preciso selecioná-lo de novo depois.', 'error');
      onOpen(track);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submitUrl} className="space-y-2">
        <label htmlFor={urlId} className="label">
          Link do YouTube
        </label>
        <div className="flex gap-2">
          <input
            id={urlId}
            className="field min-w-0 flex-1"
            placeholder="Cole o link do vídeo aqui"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-primary" disabled={!url.trim()}>
            <Icon name="video" size={18} /> {compact ? '' : 'Abrir'}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-3 text-xs text-ink-400">
        <span className="h-px flex-1 bg-ink-700" /> ou <span className="h-px flex-1 bg-ink-700" />
      </div>

      <div className="space-y-2">
        <button className="btn w-full" onClick={() => fileInput.current?.click()} disabled={busy}>
          <Icon name="upload" size={18} /> {busy ? 'Abrindo…' : 'Escolher arquivo de áudio ou vídeo'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,video/*,.mp3,.wav,.mp4,.m4a,.ogg,.webm,.flac,.aac"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <label className="flex items-start gap-2 text-xs text-ink-300">
          <input type="checkbox" className="mt-0.5 accent-[#34e0cc]" checked={storeLocal} onChange={(e) => setStoreLocal(e.target.checked)} />
          <span>Guardar o arquivo neste navegador para reabrir depois. Nada é enviado a servidores.</span>
        </label>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
