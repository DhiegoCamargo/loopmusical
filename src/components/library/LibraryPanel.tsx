import { useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import { exportFileName } from '../../services/storage/importExport';
import type { Track } from '../../types';
import { formatClock } from '../../lib/time';
import { Icon } from '../ui/Icon';
import { AddSource } from './AddSource';

type Notify = (text: string, kind?: 'info' | 'error' | 'success') => void;

interface Props {
  activeId: string | null;
  onOpen: (track: Track) => void;
  onDeleted: (id: string) => void;
  notify: Notify;
}

function TrackEditor({ track, onClose }: { track: Track; onClose: () => void }) {
  const lib = useLibrary();
  const [title, setTitle] = useState(track.title);
  const saveTitle = () => {
    const t = title.trim();
    if (t && t !== track.title) lib.updateTrack(track.id, { title: t, autoTitle: false });
    else setTitle(track.title);
  };
  return (
    <div className="space-y-3 border-t border-ink-700 bg-ink-900/60 p-3">
      <div className="space-y-1.5">
        <label className="label" htmlFor={`t-${track.id}`}>Título</label>
        <input
          id={`t-${track.id}`}
          className="field"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
      <div className="space-y-1.5">
        <label className="label" htmlFor={`c-${track.id}`}>Categoria</label>
        <select id={`c-${track.id}`} className="field" value={track.categoryId ?? ''} onChange={(e) => lib.updateTrack(track.id, { categoryId: e.target.value || null })}>
          <option value="">Sem categoria</option>
          {lib.library.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {lib.library.setlists.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="label">Repertórios</legend>
          {lib.library.setlists.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm text-ink-200">
              <input type="checkbox" className="accent-[#34e0cc]" checked={s.trackIds.includes(track.id)} onChange={(e) => lib.setTrackInSetlist(track.id, s.id, e.target.checked)} />
              {s.name}
            </label>
          ))}
        </fieldset>
      )}
      {track.source === 'youtube' && track.youtubeUrl && (
        <p className="break-all text-xs text-ink-400">{track.youtubeUrl}</p>
      )}
      {track.source === 'local' && track.local && (
        <p className="text-xs text-ink-400">
          Arquivo: {track.local.name} · {track.local.stored ? 'guardado neste navegador' : 'não guardado (será preciso selecioná-lo de novo)'}
        </p>
      )}
      <button className="btn btn-primary" onClick={onClose}>
        <Icon name="check" size={16} /> Concluir
      </button>
    </div>
  );
}

function TrackRow({ track, active, onOpen, onDeleted }: { track: Track; active: boolean; onOpen: () => void; onDeleted: () => void }) {
  const lib = useLibrary();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const clips = lib.clipsOf(track.id).length;
  const category = lib.library.categories.find((c) => c.id === track.categoryId)?.name;
  const needsFile = track.source === 'local' && !track.local?.stored;

  return (
    <li className={`overflow-hidden rounded-xl border transition ${active ? 'border-brand-500 bg-brand-500/10' : 'border-ink-700 bg-ink-800/60 hover:border-ink-600'}`}>
      <div className="flex items-center gap-1 pr-1">
        <button className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left" onClick={onOpen} aria-current={active ? 'true' : undefined}>
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-brand-500 text-ink-950' : 'bg-ink-700 text-ink-200'}`}>
            <Icon name={track.source === 'youtube' ? 'video' : 'music'} size={20} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{track.title}</span>
            <span className="block truncate text-xs text-ink-300">
              {track.source === 'youtube' ? 'YouTube' : 'Arquivo local'}
              {track.duration ? ` · ${formatClock(track.duration)}` : ''}
              {clips ? ` · ${clips} ${clips === 1 ? 'trecho' : 'trechos'}` : ''}
              {category ? ` · ${category}` : ''}
              {needsFile ? ' · reselecionar arquivo' : ''}
            </span>
          </span>
        </button>
        <button className={`icon-btn !size-9 ${track.favorite ? 'text-warn' : ''}`} onClick={() => lib.toggleFavorite(track.id)} aria-label={track.favorite ? 'Remover dos favoritos' : 'Favoritar'} aria-pressed={track.favorite}>
          <Icon name={track.favorite ? 'star-filled' : 'star'} size={18} />
        </button>
        <button className="icon-btn !size-9" onClick={() => setEditing((v) => !v)} aria-label="Editar música" aria-expanded={editing}>
          <Icon name="pencil" size={17} />
        </button>
        {confirmDelete ? (
          <button
            className="btn btn-danger !px-2 !py-1 text-xs"
            onClick={() => {
              lib.deleteTrack(track.id);
              onDeleted();
            }}
            onBlur={() => setConfirmDelete(false)}
            autoFocus
          >
            Excluir?
          </button>
        ) : (
          <button className="icon-btn !size-9" onClick={() => setConfirmDelete(true)} aria-label="Excluir música">
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>
      {editing && <TrackEditor track={track} onClose={() => setEditing(false)} />}
    </li>
  );
}

function Row({ name, onRename, onDelete }: { name: string; onRename: (n: string) => void; onDelete: () => void }) {
  const [v, setV] = useState(name);
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="flex items-center gap-2">
      <input className="field !py-1.5" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => (v.trim() ? onRename(v) : setV(name))} aria-label={`Renomear ${name}`} />
      {confirm ? (
        <button className="btn btn-danger !px-2 !py-1 text-xs" onClick={onDelete} onBlur={() => setConfirm(false)} autoFocus>Excluir?</button>
      ) : (
        <button className="icon-btn !size-9" aria-label={`Excluir ${name}`} onClick={() => setConfirm(true)}>
          <Icon name="trash" size={16} />
        </button>
      )}
    </li>
  );
}

function Organize() {
  const lib = useLibrary();
  const [cat, setCat] = useState('');
  const [set, setSet] = useState('');

  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium">
        <Icon name="folder" size={18} className="text-brand-400" /> Categorias e repertórios
        <Icon name="chevron-down" size={16} className="ml-auto text-ink-300 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-ink-700 p-3">
        <div className="space-y-2">
          <p className="label">Categorias</p>
          <ul className="space-y-2">
            {lib.library.categories.map((c) => (
              <Row key={c.id} name={c.name} onRename={(n) => lib.renameCategory(c.id, n)} onDelete={() => lib.deleteCategory(c.id)} />
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (lib.addCategory(cat)) setCat('');
            }}
          >
            <input className="field" placeholder="Nova categoria (ex.: Louvor)" value={cat} onChange={(e) => setCat(e.target.value)} maxLength={80} />
            <button className="btn" disabled={!cat.trim()} aria-label="Adicionar categoria"><Icon name="plus" size={16} /></button>
          </form>
        </div>
        <div className="space-y-2">
          <p className="label">Repertórios</p>
          <ul className="space-y-2">
            {lib.library.setlists.map((s) => (
              <Row key={s.id} name={s.name} onRename={(n) => lib.renameSetlist(s.id, n)} onDelete={() => lib.deleteSetlist(s.id)} />
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (lib.addSetlist(set)) setSet('');
            }}
          >
            <input className="field" placeholder="Novo repertório (ex.: Domingo)" value={set} onChange={(e) => setSet(e.target.value)} maxLength={80} />
            <button className="btn" disabled={!set.trim()} aria-label="Adicionar repertório"><Icon name="plus" size={16} /></button>
          </form>
          <p className="text-xs text-ink-400">Para colocar uma música em um repertório ou categoria, use o botão de editar (lápis) na música.</p>
        </div>
      </div>
    </details>
  );
}

function DataTools({ notify }: { notify: Notify }) {
  const lib = useLibrary();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ text: string; name: string } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const doExport = () => {
    const blob = new Blob([lib.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    notify('Biblioteca exportada. Os arquivos de áudio e vídeo não são incluídos.', 'success');
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return notify('Arquivo grande demais para ser uma biblioteca do Loop Musical.', 'error');
    setPending({ text: await file.text(), name: file.name });
    setConfirmReplace(false);
  };

  const run = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    const res = await lib.importJson(pending.text, mode);
    setPending(null);
    setConfirmReplace(false);
    if (!res.ok) return notify(res.error, 'error');
    const r = res.report;
    const parts = [`${r.tracksAdded} música(s) nova(s)`, `${r.clipsAdded} trecho(s) novo(s)`];
    if (r.tracksMatched) parts.push(`${r.tracksMatched} já existia(m)`);
    if (r.clipsSkipped) parts.push(`${r.clipsSkipped} trecho(s) repetido(s) ignorado(s)`);
    notify(`Importação concluída: ${parts.join(', ')}.${res.warnings.length ? ` ${res.warnings.length} aviso(s).` : ''}`, 'success');
    if (res.warnings.length) console.warn('[Loop Musical] avisos de importação:', res.warnings);
  };

  return (
    <div className="card space-y-3 p-3">
      <p className="label">Dados</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={doExport} disabled={lib.library.tracks.length === 0}>
          <Icon name="download" size={16} /> Exportar JSON
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          <Icon name="upload" size={16} /> Importar JSON
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {pending && (
        <div className="space-y-2 rounded-xl border border-ink-600 bg-ink-900 p-3 text-sm">
          <p>
            Importar <strong className="break-all">{pending.name}</strong>:
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => void run('merge')}>Mesclar com minha biblioteca</button>
            {confirmReplace ? (
              <button className="btn btn-danger !border-danger/50" onClick={() => void run('replace')}>Confirmar: substituir tudo</button>
            ) : (
              <button className="btn" onClick={() => setConfirmReplace(true)}>Substituir tudo</button>
            )}
            <button className="btn btn-ghost" onClick={() => setPending(null)}>Cancelar</button>
          </div>
          <p className="text-xs text-ink-400">Mesclar não apaga nada e evita duplicar músicas e trechos iguais.</p>
        </div>
      )}
      {!lib.persistent && (
        <p className="flex items-start gap-2 text-xs text-warn">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" /> O armazenamento do navegador está indisponível: seus dados valem só até fechar esta página. Exporte o JSON para não perder nada.
        </p>
      )}
    </div>
  );
}

export function LibraryPanel({ activeId, onOpen, onDeleted, notify }: Props) {
  const lib = useLibrary();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const tracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const setlist = filter.startsWith('set:') ? lib.library.setlists.find((s) => s.id === filter.slice(4)) : null;
    let list = lib.library.tracks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !(t.local?.name.toLowerCase().includes(q))) return false;
      if (filter === 'fav') return t.favorite;
      if (filter.startsWith('cat:')) return t.categoryId === filter.slice(4);
      if (setlist) return setlist.trackIds.includes(t.id);
      return true;
    });
    if (setlist) {
      const order = new Map(setlist.trackIds.map((id, i) => [id, i]));
      list = [...list].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    } else {
      list = [...list].sort((a, b) => (b.lastPlayedAt ?? b.createdAt) - (a.lastPlayedAt ?? a.createdAt));
    }
    return list;
  }, [lib.library, query, filter]);

  const empty = lib.library.tracks.length === 0;

  return (
    <div className="space-y-4">
      <details className="card group">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium">
          <Icon name="plus" size={18} className="text-brand-400" /> Adicionar música
          <Icon name="chevron-down" size={16} className="ml-auto text-ink-300 transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-ink-700 p-3">
          <AddSource onOpen={onOpen} notify={notify} compact />
        </div>
      </details>

      {!empty && (
        <div className="space-y-2">
          <div className="relative">
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="field !pl-9" placeholder="Pesquisar músicas" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Pesquisar músicas" />
          </div>
          <label className="sr-only" htmlFor="lib-filter">Filtrar</label>
          <select id="lib-filter" className="field" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todas as músicas ({lib.library.tracks.length})</option>
            <option value="fav">★ Favoritas</option>
            {lib.library.categories.length > 0 && (
              <optgroup label="Categorias">
                {lib.library.categories.map((c) => (
                  <option key={c.id} value={`cat:${c.id}`}>{c.name}</option>
                ))}
              </optgroup>
            )}
            {lib.library.setlists.length > 0 && (
              <optgroup label="Repertórios">
                {lib.library.setlists.map((s) => (
                  <option key={s.id} value={`set:${s.id}`}>{s.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      {empty ? (
        <p className="rounded-xl border border-dashed border-ink-600 p-4 text-center text-sm text-ink-300">
          Sua biblioteca está vazia. Adicione um link do YouTube ou um arquivo para começar.
        </p>
      ) : tracks.length === 0 ? (
        <p className="p-4 text-center text-sm text-ink-300">Nenhuma música encontrada.</p>
      ) : (
        <ul className="space-y-2">
          {tracks.map((t) => (
            <TrackRow key={t.id} track={t} active={t.id === activeId} onOpen={() => onOpen(t)} onDeleted={() => onDeleted(t.id)} />
          ))}
        </ul>
      )}

      <Organize />
      <DataTools notify={notify} />
    </div>
  );
}
