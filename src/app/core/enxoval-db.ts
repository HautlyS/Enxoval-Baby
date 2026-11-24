import {
  EnxovalItem,
  EnxovalListConfig,
  PurchaseRecord,
  SsgIndexMetadata,
} from './models';

const DB_NAME = 'enxoval-baby';
const DB_VERSION = 1;

type StoreName = 'lists' | 'items' | 'purchases' | 'config' | 'meta';

interface ListRow {
  key?: string;
  slug: string;
  config: EnxovalListConfig;
  items: EnxovalItem[];
  purchases: PurchaseRecord[];
  updatedAt: string;
}

export type {ListRow};

export class EnxovalDB {
  private db: IDBDatabase | null = null;
  private openPromise: Promise<void> | null = null;

  async open(): Promise<void> {
    if (this.db) return;
    if (this.openPromise) return this.openPromise;
    this.openPromise = new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of ['lists', 'items', 'purchases', 'config', 'meta'] as const) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, {keyPath: 'key'});
          }
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        this.openPromise = null;
        resolve();
      };
      req.onerror = () => {
        this.openPromise = null;
        reject(req.error);
      };
    });
    return this.openPromise;
  }

  private tx(store: StoreName, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('IndexedDB not opened');
    return this.db.transaction(store, mode).objectStore(store);
  }

  async get<T>(store: StoreName, key: string): Promise<T | null> {
    try {
      await this.open();
      return new Promise<T | null>((resolve) => {
        const req = this.tx(store).get(key);
        req.onsuccess = () => resolve((req.result as T | null) ?? null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async put<T>(store: StoreName, key: string, value: T): Promise<void> {
    try {
      await this.open();
      return new Promise<void>((resolve) => {
        const req = this.tx(store, 'readwrite').put({key, ...value});
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    try {
      await this.open();
      return new Promise<T[]>((resolve) => {
        const req = this.tx(store).getAll();
        req.onsuccess = () => {
          const rows = req.result as ({key: string} & T)[];
          resolve(rows.map((r) => ({...r, key: undefined} as T)));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async remove(store: StoreName, key: string): Promise<void> {
    try {
      await this.open();
      return new Promise<void>((resolve) => {
        const req = this.tx(store, 'readwrite').delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }

  async saveList(slug: string, config: EnxovalListConfig, items: EnxovalItem[], purchases: PurchaseRecord[]): Promise<void> {
    await this.put<ListRow>('lists', slug, {slug, config, items, purchases, updatedAt: new Date().toISOString()});
    await this.put<{key: string; items: EnxovalItem[]}>('items', slug, {key: slug, items});
    await this.put<{key: string; purchases: PurchaseRecord[]}>('purchases', slug, {key: slug, purchases});
  }

  async loadList(slug: string): Promise<{config: EnxovalListConfig; items: EnxovalItem[]; purchases: PurchaseRecord[]} | null> {
    const row = await this.get<ListRow>('lists', slug);
    if (!row) return null;
    return {config: row.config, items: row.items, purchases: row.purchases};
  }

  async saveMeta(meta: SsgIndexMetadata): Promise<void> {
    await this.put<{key: string; meta: SsgIndexMetadata}>('meta', 'ssg', {key: 'ssg', meta});
  }

  async loadMeta(): Promise<SsgIndexMetadata | null> {
    return this.get<{key: string; meta: SsgIndexMetadata}>('meta', 'ssg').then((r) => r?.meta ?? null);
  }

  async saveConfig(key: string, value: unknown): Promise<void> {
    await this.put<{key: string; value: unknown}>('config', key, {key, value});
  }

  async loadConfig(key: string): Promise<unknown> {
    return this.get<{key: string; value: unknown}>('config', key).then((r) => r?.value ?? null);
  }

  async clear(): Promise<void> {
    try {
      await this.open();
      for (const store of ['lists', 'items', 'purchases', 'config', 'meta'] as const) {
        await new Promise<void>((resolve) => {
          const req = this.tx(store, 'readwrite').clear();
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
    } catch {
      // ignore
    }
  }
}

export const enxovalDB = new EnxovalDB();
