import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_PRACTICE,
  EMPTY_LIBRARY,
  type Category,
  type Clip,
  type Library,
  type Setlist,
  type Track,
} from '../types';
import { uid } from '../lib/id';
import { youtubeWatchUrl, type ParsedYouTube } from '../lib/youtube';
import { openStorage, type Storage } from '../services/storage/db';
import { buildExport, mergeLibraries, parseImport, trackKey, type MergeReport } from '../services/storage/importExport';

export interface AddResult {
  track: Track;
  existed: boolean;
  /** Para arquivos locais: se foi possível guardar no navegador. */
  storedOk?: boolean;
}

export type ImportOutcome = { ok: true; report: MergeReport; warnings: string[] } | { ok: false; error: string };

export interface LibraryApi {
  ready: boolean;
  persistent: boolean;
  library: Library;
  getTrack(id: string | null): Track | null;
  addYouTubeTrack(parsed: ParsedYouTube, title?: string): Promise<AddResult>;
  addLocalTrack(file: File, store: boolean): Promise<AddResult>;
  updateTrack(id: string, patch: Partial<Track>, touch?: boolean): void;
  deleteTrack(id: string): void;
  toggleFavorite(id: string): void;
  addCategory(name: string): string | null;
  renameCategory(id: string, name: string): void;
  deleteCategory(id: string): void;
  addSetlist(name: string): string | null;
  renameSetlist(id: string, name: string): void;
  deleteSetlist(id: string): void;
  setTrackInSetlist(trackId: string, setlistId: string, member: boolean): void;
  addClip(trackId: string, data: Omit<Clip, 'id' | 'trackId' | 'order'>): Clip;
  updateClip(id: string, patch: Partial<Omit<Clip, 'id' | 'trackId'>>): void;
  deleteClip(id: string): void;
  moveClip(id: string, direction: -1 | 1): void;
  clipsOf(trackId: string): Clip[];
  getFile(trackId: string): Promise<Blob | null>;
  attachFile(trackId: string, file: File, store: boolean): Promise<boolean>;
  exportJson(): string;
  importJson(text: string, mode: 'merge' | 'replace'): Promise<ImportOutcome>;
}

const Ctx = createContext<LibraryApi | null>(null);

export function useLibrary(): LibraryApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLibrary fora do LibraryProvider');
  return v;
}

function baseName(file: string): string {
  return file.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || file;
}

export function LibraryProvider({ children, onError }: { children: ReactNode; onError: (msg: string) => void }) {
  const [library, setLibrary] = useState<Library>(EMPTY_LIBRARY);
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const libRef = useRef<Library>(EMPTY_LIBRARY);
  const storageRef = useRef<Storage | null>(null);
  const storageReady = useRef<Promise<Storage> | null>(null);
  const sessionFiles = useRef(new Map<string, Blob>());
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const commit = useCallback((next: Library) => {
    libRef.current = next;
    setLibrary(next);
  }, []);

  const persist = useCallback(async (job: (s: Storage) => Promise<void>) => {
    try {
      const s = storageRef.current ?? (await storageReady.current);
      if (s) await job(s);
    } catch {
      errorRef.current('Não foi possível salvar no armazenamento do navegador.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const p = openStorage();
    storageReady.current = p;
    void p.then(async (s) => {
      storageRef.current = s;
      const [tracks, clips, categories, setlists] = await Promise.all([
        s.getAll<Track>('tracks'),
        s.getAll<Clip>('clips'),
        s.getAll<Category>('categories'),
        s.getAll<Setlist>('setlists'),
      ]);
      if (cancelled) return;
      // Completa campos de versões antigas, se houver.
      const fixed = tracks.map((t) => ({ ...t, practice: { ...DEFAULT_PRACTICE, ...t.practice } }));
      commit({ tracks: fixed, clips, categories, setlists });
      setPersistent(s.persistent);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [commit]);

  const api = useMemo<LibraryApi>(() => {
    const lib = () => libRef.current;
    const clipsOf = (trackId: string) => lib().clips.filter((c) => c.trackId === trackId).sort((a, b) => a.order - b.order);

    const makeTrack = (partial: Partial<Track> & Pick<Track, 'title' | 'source'>): Track => {
      const now = Date.now();
      return {
        id: uid('trk'),
        favorite: false,
        categoryId: null,
        practice: { ...DEFAULT_PRACTICE },
        session: { position: 0, a: null, b: null, loopEnabled: false, rate: 1, activeClipId: null },
        createdAt: now,
        updatedAt: now,
        ...partial,
      };
    };

    const saveTrack = (t: Track) => void persist((s) => s.put('tracks', t));

    const attachFile = async (trackId: string, file: File, store: boolean): Promise<boolean> => {
      sessionFiles.current.set(trackId, file);
      const track = lib().tracks.find((t) => t.id === trackId);
      if (!track || !store) return false;
      try {
        void navigator.storage?.persist?.();
        const s = storageRef.current ?? (await storageReady.current);
        if (!s) return false;
        await s.putFile({ trackId, blob: file, name: file.name, type: file.type });
        if (track.local && !track.local.stored) {
          const next = { ...track, local: { ...track.local, stored: true } };
          commit({ ...lib(), tracks: lib().tracks.map((t) => (t.id === trackId ? next : t)) });
          saveTrack(next);
        }
        return s.persistent;
      } catch {
        return false;
      }
    };

    return {
      ready,
      persistent,
      library,
      getTrack: (id) => (id ? lib().tracks.find((t) => t.id === id) ?? null : null),
      clipsOf,

      async addYouTubeTrack(parsed, title) {
        const existing = lib().tracks.find((t) => t.source === 'youtube' && t.youtubeId === parsed.id);
        if (existing) return { track: existing, existed: true };
        const track = makeTrack({
          title: title?.trim() || `Vídeo do YouTube (${parsed.id})`,
          autoTitle: !title?.trim(),
          source: 'youtube',
          youtubeId: parsed.id,
          youtubeUrl: youtubeWatchUrl(parsed.id),
          youtubeStart: parsed.start,
        });
        if (parsed.start) track.session = { ...track.session, position: parsed.start };
        commit({ ...lib(), tracks: [track, ...lib().tracks] });
        saveTrack(track);
        return { track, existed: false };
      },

      async addLocalTrack(file, store) {
        const isVideo = file.type.startsWith('video/') || /\.(mp4|m4v|webm|mov|ogv)$/i.test(file.name);
        const probe = makeTrack({
          title: baseName(file.name),
          source: 'local',
          local: { name: file.name, size: file.size, mimeType: file.type, isVideo, stored: false },
        });
        const existing = lib().tracks.find((t) => t.source === 'local' && trackKey(t) === trackKey(probe));
        if (existing) {
          const storedOk = await attachFile(existing.id, file, store);
          return { track: lib().tracks.find((t) => t.id === existing.id) ?? existing, existed: true, storedOk };
        }
        commit({ ...lib(), tracks: [probe, ...lib().tracks] });
        saveTrack(probe);
        const storedOk = await attachFile(probe.id, file, store);
        return { track: lib().tracks.find((t) => t.id === probe.id) ?? probe, existed: false, storedOk };
      },

      updateTrack(id, patch, touch = true) {
        const cur = lib().tracks.find((t) => t.id === id);
        if (!cur) return;
        const next = { ...cur, ...patch, ...(touch ? { updatedAt: Date.now() } : {}) };
        commit({ ...lib(), tracks: lib().tracks.map((t) => (t.id === id ? next : t)) });
        saveTrack(next);
      },

      deleteTrack(id) {
        const cur = lib();
        const removedClips = cur.clips.filter((c) => c.trackId === id);
        const setlists = cur.setlists.map((s) => (s.trackIds.includes(id) ? { ...s, trackIds: s.trackIds.filter((x) => x !== id) } : s));
        commit({ ...cur, tracks: cur.tracks.filter((t) => t.id !== id), clips: cur.clips.filter((c) => c.trackId !== id), setlists });
        sessionFiles.current.delete(id);
        void persist(async (s) => {
          await s.remove('tracks', id);
          await Promise.all(removedClips.map((c) => s.remove('clips', c.id)));
          await s.putMany('setlists', setlists);
          await s.removeFile(id);
        });
      },

      toggleFavorite(id) {
        const cur = lib().tracks.find((t) => t.id === id);
        if (!cur) return;
        const next = { ...cur, favorite: !cur.favorite };
        commit({ ...lib(), tracks: lib().tracks.map((t) => (t.id === id ? next : t)) });
        saveTrack(next);
      },

      addCategory(name) {
        const n = name.trim().slice(0, 80);
        if (!n) return null;
        const found = lib().categories.find((c) => c.name.toLowerCase() === n.toLowerCase());
        if (found) return found.id;
        const cat: Category = { id: uid('cat'), name: n };
        commit({ ...lib(), categories: [...lib().categories, cat] });
        void persist((s) => s.put('categories', cat));
        return cat.id;
      },
      renameCategory(id, name) {
        const n = name.trim().slice(0, 80);
        if (!n) return;
        const categories = lib().categories.map((c) => (c.id === id ? { ...c, name: n } : c));
        commit({ ...lib(), categories });
        const cat = categories.find((c) => c.id === id);
        if (cat) void persist((s) => s.put('categories', cat));
      },
      deleteCategory(id) {
        const affected = lib().tracks.filter((t) => t.categoryId === id).map((t) => ({ ...t, categoryId: null }));
        commit({
          ...lib(),
          categories: lib().categories.filter((c) => c.id !== id),
          tracks: lib().tracks.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
        });
        void persist(async (s) => {
          await s.remove('categories', id);
          await s.putMany('tracks', affected);
        });
      },

      addSetlist(name) {
        const n = name.trim().slice(0, 80);
        if (!n) return null;
        const found = lib().setlists.find((c) => c.name.toLowerCase() === n.toLowerCase());
        if (found) return found.id;
        const set: Setlist = { id: uid('set'), name: n, trackIds: [] };
        commit({ ...lib(), setlists: [...lib().setlists, set] });
        void persist((s) => s.put('setlists', set));
        return set.id;
      },
      renameSetlist(id, name) {
        const n = name.trim().slice(0, 80);
        if (!n) return;
        const setlists = lib().setlists.map((c) => (c.id === id ? { ...c, name: n } : c));
        commit({ ...lib(), setlists });
        const set = setlists.find((c) => c.id === id);
        if (set) void persist((s) => s.put('setlists', set));
      },
      deleteSetlist(id) {
        commit({ ...lib(), setlists: lib().setlists.filter((c) => c.id !== id) });
        void persist((s) => s.remove('setlists', id));
      },
      setTrackInSetlist(trackId, setlistId, member) {
        const setlists = lib().setlists.map((s) => {
          if (s.id !== setlistId) return s;
          const has = s.trackIds.includes(trackId);
          if (member && !has) return { ...s, trackIds: [...s.trackIds, trackId] };
          if (!member && has) return { ...s, trackIds: s.trackIds.filter((x) => x !== trackId) };
          return s;
        });
        commit({ ...lib(), setlists });
        const set = setlists.find((s) => s.id === setlistId);
        if (set) void persist((s) => s.put('setlists', set));
      },

      addClip(trackId, data) {
        const siblings = clipsOf(trackId);
        const clip: Clip = { ...data, id: uid('clip'), trackId, order: siblings.length ? siblings[siblings.length - 1].order + 1 : 0 };
        commit({ ...lib(), clips: [...lib().clips, clip] });
        void persist((s) => s.put('clips', clip));
        return clip;
      },
      updateClip(id, patch) {
        const clips = lib().clips.map((c) => (c.id === id ? { ...c, ...patch } : c));
        commit({ ...lib(), clips });
        const clip = clips.find((c) => c.id === id);
        if (clip) void persist((s) => s.put('clips', clip));
      },
      deleteClip(id) {
        commit({ ...lib(), clips: lib().clips.filter((c) => c.id !== id) });
        void persist((s) => s.remove('clips', id));
      },
      moveClip(id, direction) {
        const target = lib().clips.find((c) => c.id === id);
        if (!target) return;
        const list = clipsOf(target.trackId);
        const i = list.findIndex((c) => c.id === id);
        const j = i + direction;
        if (i < 0 || j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        const renumbered = list.map((c, idx) => ({ ...c, order: idx }));
        const byId = new Map(renumbered.map((c) => [c.id, c]));
        commit({ ...lib(), clips: lib().clips.map((c) => byId.get(c.id) ?? c) });
        void persist((s) => s.putMany('clips', renumbered));
      },

      async getFile(trackId) {
        const mem = sessionFiles.current.get(trackId);
        if (mem) return mem;
        try {
          const s = storageRef.current ?? (await storageReady.current);
          const stored = await s?.getFile(trackId);
          return stored ? stored.blob : null;
        } catch {
          return null;
        }
      },
      attachFile,

      exportJson: () => JSON.stringify(buildExport(lib()), null, 2),

      async importJson(text, mode) {
        const parsed = parseImport(text);
        if (!parsed.ok) return { ok: false, error: parsed.error };
        const merged = mergeLibraries(lib(), parsed.data, mode);
        commit(merged.library);
        sessionFiles.current.forEach((_, id) => {
          if (merged.removedTrackIds.includes(id)) sessionFiles.current.delete(id);
        });
        await persist(async (s) => {
          if (mode === 'replace') {
            await Promise.all((['tracks', 'clips', 'categories', 'setlists'] as const).map((n) => s.clear(n)));
            await Promise.all(merged.removedTrackIds.map((id) => s.removeFile(id)));
          }
          await s.putMany('tracks', merged.library.tracks);
          await s.putMany('clips', merged.library.clips);
          await s.putMany('categories', merged.library.categories);
          await s.putMany('setlists', merged.library.setlists);
        });
        return { ok: true, report: merged.report, warnings: parsed.warnings };
      },
    };
  }, [ready, persistent, library, commit, persist]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
