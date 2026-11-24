/**
 * Persistência local em IndexedDB (com fallback em memória quando o navegador bloqueia).
 * Guarda biblioteca (músicas, trechos, categorias, repertórios) e, opcionalmente, os arquivos locais.
 */

export type StoreName = 'tracks' | 'clips' | 'categories' | 'setlists';

export interface StoredFile {
  trackId: string;
  blob: Blob;
  name: string;
  type: string;
}

export interface Storage {
  /** false quando está usando o fallback em memória (dados se perdem ao fechar a página). */
  readonly persistent: boolean;
  getAll<T>(store: StoreName): Promise<T[]>;
  put<T extends { id: string }>(store: StoreName, value: T): Promise<void>;
  putMany<T extends { id: string }>(store: StoreName, values: T[]): Promise<void>;
  remove(store: StoreName, id: string): Promise<void>;
  clear(store: StoreName): Promise<void>;
  getFile(trackId: string): Promise<StoredFile | null>;
  putFile(file: StoredFile): Promise<void>;
  removeFile(trackId: string): Promise<void>;
}

const DB_NAME = 'loop-musical';
const DB_VERSION = 1;
const STORES: StoreName[] = ['tracks', 'clips', 'categories', 'setlists'];

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transação cancelada.'));
  });
}

class IndexedDbStorage implements Storage {
  readonly persistent = true;
  constructor(private db: IDBDatabase) {}

  async getAll<T>(store: StoreName): Promise<T[]> {
    return wrap<T[]>(this.db.transaction(store, 'readonly').objectStore(store).getAll());
  }

  async put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await done(tx);
  }

  async putMany<T extends { id: string }>(store: StoreName, values: T[]): Promise<void> {
    if (values.length === 0) return;
    const tx = this.db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    values.forEach((v) => os.put(v));
    await done(tx);
  }

  async remove(store: StoreName, id: string): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    await done(tx);
  }

  async clear(store: StoreName): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    await done(tx);
  }

  async getFile(trackId: string): Promise<StoredFile | null> {
    const r = await wrap<StoredFile | undefined>(this.db.transaction('files', 'readonly').objectStore('files').get(trackId));
    return r ?? null;
  }

  async putFile(file: StoredFile): Promise<void> {
    const tx = this.db.transaction('files', 'readwrite');
    tx.objectStore('files').put(file);
    await done(tx);
  }

  async removeFile(trackId: string): Promise<void> {
    const tx = this.db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(trackId);
    await done(tx);
  }
}

export class MemoryStorage implements Storage {
  readonly persistent = false;
  private data = new Map<StoreName, Map<string, unknown>>();
  private files = new Map<string, StoredFile>();

  private table(store: StoreName): Map<string, unknown> {
    let t = this.data.get(store);
    if (!t) this.data.set(store, (t = new Map()));
    return t;
  }
  async getAll<T>(store: StoreName): Promise<T[]> {
    return [...this.table(store).values()] as T[];
  }
  async put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
    this.table(store).set(value.id, structuredCloneSafe(value));
  }
  async putMany<T extends { id: string }>(store: StoreName, values: T[]): Promise<void> {
    values.forEach((v) => this.table(store).set(v.id, structuredCloneSafe(v)));
  }
  async remove(store: StoreName, id: string): Promise<void> {
    this.table(store).delete(id);
  }
  async clear(store: StoreName): Promise<void> {
    this.table(store).clear();
  }
  async getFile(trackId: string): Promise<StoredFile | null> {
    return this.files.get(trackId) ?? null;
  }
  async putFile(file: StoredFile): Promise<void> {
    this.files.set(file.trackId, file);
  }
  async removeFile(trackId: string): Promise<void> {
    this.files.delete(trackId);
  }
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export async function openStorage(): Promise<Storage> {
  try {
    if (typeof indexedDB === 'undefined') return new MemoryStorage();
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'trackId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Banco bloqueado por outra aba.'));
    });
    return new IndexedDbStorage(db);
  } catch {
    return new MemoryStorage();
  }
}
