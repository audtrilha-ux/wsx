import { Injectable } from '@angular/core';
import { IOsDatabaseAdapter, OsDatabaseTransaction, OsQueryOptions } from '../../../contracts/os/os-database.contract';

const DB_NAME = '3eatcru_web_database';
const DB_VERSION = 1;
const STORE_NAME = 'os_namespaces_kv';

interface DbRecord {
  id: string; // `${namespace}::${key}`
  namespace: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

/**
 * IndexedDB Database Adapter for Web Browser runtime environment.
 */
@Injectable({
  providedIn: 'root'
})
export class IndexedDbDatabaseAdapter implements IOsDatabaseAdapter {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryFallback = new Map<string, unknown>();
  private transactionMutex: Promise<unknown> = Promise.resolve();

  constructor() {
    this.restoreMemoryFallback();
    this.initDatabase();
  }

  private restoreMemoryFallback(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('3eatcru_idb_memory_fallback_v1');
        if (raw) {
          const arr = JSON.parse(raw) as [string, unknown][];
          this.memoryFallback = new Map(arr);
        }
      } catch {
        // Ignore parse error
      }
    }
  }

  private persistMemoryFallback(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('3eatcru_idb_memory_fallback_v1', JSON.stringify(Array.from(this.memoryFallback.entries())));
      } catch {
        // Ignore quota error
      }
    }
  }

  private initDatabase(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('namespace', 'namespace', { unique: false });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private getCompositeKey(namespace: string, key: string): string {
    return `${namespace}::${key}`;
  }

  async get<T = unknown>(namespace: string, key: string): Promise<T | null> {
    const db = await this.initDatabase();
    const id = this.getCompositeKey(namespace, key);

    if (!db) {
      const val = this.memoryFallback.get(id);
      return val !== undefined ? (val as T) : null;
    }

    return new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const result = req.result as DbRecord | undefined;
        resolve(result ? (result.value as T) : null);
      };

      req.onerror = () => resolve(null);
    });
  }

  async put<T = unknown>(namespace: string, key: string, value: T): Promise<void> {
    const db = await this.initDatabase();
    const id = this.getCompositeKey(namespace, key);
    const record: DbRecord = {
      id,
      namespace,
      key,
      value,
      updatedAt: new Date().toISOString()
    };

    if (!db) {
      this.memoryFallback.set(id, value);
      this.persistMemoryFallback();
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async delete(namespace: string, key: string): Promise<void> {
    const db = await this.initDatabase();
    const id = this.getCompositeKey(namespace, key);

    if (!db) {
      this.memoryFallback.delete(id);
      this.persistMemoryFallback();
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async query<T = unknown>(namespace: string, options?: OsQueryOptions): Promise<{ key: string; value: T }[]> {
    const db = await this.initDatabase();

    if (!db) {
      const prefix = `${namespace}::`;
      const matches: { key: string; value: T }[] = [];
      for (const [k, v] of this.memoryFallback.entries()) {
        if (k.startsWith(prefix)) {
          matches.push({ key: k.slice(prefix.length), value: v as T });
        }
      }
      return matches;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('namespace');
      const req = index.getAll(IDBKeyRange.only(namespace));

      req.onsuccess = () => {
        const records = (req.result as DbRecord[]) || [];
        let results = records.map(r => ({ key: r.key, value: r.value as T }));

        if (options?.filters) {
          results = results.filter(item => {
            return Object.entries(options.filters!).every(([k, v]) => {
              const valObj = item.value as Record<string, unknown>;
              return valObj && valObj[k] === v;
            });
          });
        }

        if (options?.offset) {
          results = results.slice(options.offset);
        }
        if (options?.limit) {
          results = results.slice(0, options.limit);
        }

        resolve(results);
      };

      req.onerror = () => resolve([]);
    });
  }

  async clear(namespace: string): Promise<void> {
    const db = await this.initDatabase();
    if (!db) {
      const prefix = `${namespace}::`;
      for (const k of Array.from(this.memoryFallback.keys())) {
        if (k.startsWith(prefix)) {
          this.memoryFallback.delete(k);
        }
      }
      this.persistMemoryFallback();
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('namespace');
      const req = index.openCursor(IDBKeyRange.only(namespace));

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('IndexedDB clear transaction aborted'));
    });
  }

  async transaction<R>(namespace: string, callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R> {
    const resultPromise = this.transactionMutex.then(async () => {
      const stagedPuts: { ns: string; key: string; val: unknown }[] = [];
      const stagedDeletes: { ns: string; key: string }[] = [];

      const tx: OsDatabaseTransaction = {
        get: async <T>(key: string, overrideNs?: string): Promise<T | null> => {
          const targetNs = overrideNs || namespace;
          const putMatch = stagedPuts.find(p => p.ns === targetNs && p.key === key);
          if (putMatch) return putMatch.val as T;

          const isDeleted = stagedDeletes.some(d => d.ns === targetNs && d.key === key);
          if (isDeleted) return null;

          return this.get<T>(targetNs, key);
        },
        put: async <T>(key: string, value: T, overrideNs?: string): Promise<void> => {
          const targetNs = overrideNs || namespace;
          stagedPuts.push({ ns: targetNs, key, val: value });
        },
        delete: async (key: string, overrideNs?: string): Promise<void> => {
          const targetNs = overrideNs || namespace;
          stagedDeletes.push({ ns: targetNs, key });
        }
      };

      const result = await callback(tx);

      const db = await this.initDatabase();
      if (!db) {
        for (const item of stagedPuts) {
          this.memoryFallback.set(this.getCompositeKey(item.ns, item.key), item.val);
        }
        for (const item of stagedDeletes) {
          this.memoryFallback.delete(this.getCompositeKey(item.ns, item.key));
        }
        this.persistMemoryFallback();
        return result;
      }

      return new Promise<R>((resolve, reject) => {
        const idbTx = db.transaction(STORE_NAME, 'readwrite');
        const store = idbTx.objectStore(STORE_NAME);

        for (const item of stagedPuts) {
          const id = this.getCompositeKey(item.ns, item.key);
          const record: DbRecord = {
            id,
            namespace: item.ns,
            key: item.key,
            value: item.val,
            updatedAt: new Date().toISOString()
          };
          store.put(record);
        }

        for (const item of stagedDeletes) {
          const id = this.getCompositeKey(item.ns, item.key);
          store.delete(id);
        }

        idbTx.oncomplete = () => resolve(result);
        idbTx.onerror = () => reject(idbTx.error);
        idbTx.onabort = () => reject(new Error('IndexedDB Transaction aborted'));
      });
    });

    this.transactionMutex = resultPromise.catch(() => {
      // Ignora falhas para não travar a fila subsequente
    });
    return resultPromise;
  }

  async migrate(): Promise<void> {
    await this.initDatabase();
  }

  async backup(passphrase?: string): Promise<Blob | null> {
    const db = await this.initDatabase();
    let backupPayload: { version: number; exportedAt: string; recordCount: number; source: string; records: { namespace: string; key: string; value: unknown; updatedAt: string }[] };

    if (!db) {
      const entries = Array.from(this.memoryFallback.entries());
      backupPayload = {
        version: DB_VERSION,
        exportedAt: new Date().toISOString(),
        recordCount: entries.length,
        source: 'memory_fallback',
        records: entries.map(([compositeKey, val]) => {
          const parts = compositeKey.split('::');
          return {
            namespace: parts[0] || 'default',
            key: parts.slice(1).join('::'),
            value: val,
            updatedAt: new Date().toISOString()
          };
        })
      };
    } else {
      backupPayload = await new Promise<{ version: number; exportedAt: string; recordCount: number; source: string; records: { namespace: string; key: string; value: unknown; updatedAt: string }[] }>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();

          req.onsuccess = () => {
            const records = (req.result as DbRecord[]) || [];
            resolve({
              version: DB_VERSION,
              exportedAt: new Date().toISOString(),
              recordCount: records.length,
              source: 'indexeddb',
              records: records.map(r => ({
                namespace: r.namespace,
                key: r.key,
                value: r.value,
                updatedAt: r.updatedAt
              }))
            });
          };

          req.onerror = () => resolve({ version: DB_VERSION, exportedAt: new Date().toISOString(), recordCount: 0, source: 'error', records: [] });
        } catch {
          resolve({ version: DB_VERSION, exportedAt: new Date().toISOString(), recordCount: 0, source: 'error', records: [] });
        }
      });
    }

    const rawJson = JSON.stringify(backupPayload, null, 2);

    if (passphrase) {
      if (typeof crypto === 'undefined' || !crypto.subtle) {
        throw new Error('Criptografia Web Crypto API indisponível no ambiente runtime.');
      }
      try {
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const passKey = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
        const aesKey = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
          passKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt']
        );
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoder.encode(rawJson));
        const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
        const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
        const cipherHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
        const encryptedEnvelope = JSON.stringify({
          encrypted: true,
          algorithm: 'AES-GCM-256',
          saltHex,
          ivHex,
          ciphertextHex: cipherHex
        }, null, 2);
        return new Blob([encryptedEnvelope], { type: 'application/json' });
      } catch (err) {
        console.error('[IndexedDbDatabaseAdapter] Falha na criptografia do backup:', err);
        throw new Error(`Falha na criptografia do backup: ${(err as Error)?.message || 'Erro de criptografia'}`);
      }
    }

    return new Blob([rawJson], { type: 'application/json' });
  }

  async restore(data: string | Blob, passphrase?: string): Promise<{ success: boolean; recordCount: number }> {
    let contentStr: string;
    if (typeof data === 'string') {
      contentStr = data;
    } else {
      contentStr = await data.text();
    }

    let parsed = JSON.parse(contentStr);

    if (parsed.encrypted && parsed.ciphertextHex) {
      if (!passphrase) {
        throw new Error('Backup criptografado requer senha para restauração.');
      }
      if (typeof crypto === 'undefined' || !crypto.subtle) {
        throw new Error('WebCrypto indisponível para decriptografia.');
      }
      const salt = new Uint8Array((parsed.saltHex.match(/.{1,2}/g) || []).map((b: string) => parseInt(b, 16)));
      const iv = new Uint8Array((parsed.ivHex.match(/.{1,2}/g) || []).map((b: string) => parseInt(b, 16)));
      const cipherBytes = new Uint8Array((parsed.ciphertextHex.match(/.{1,2}/g) || []).map((b: string) => parseInt(b, 16)));
      const encoder = new TextEncoder();
      const passKey = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        passKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipherBytes);
      const decryptedText = new TextDecoder().decode(decrypted);
      parsed = JSON.parse(decryptedText);
    }

    if (!Array.isArray(parsed.records)) {
      throw new Error('Formato de backup inválido: lista de registros não encontrada.');
    }

    const records = parsed.records as { namespace: string; key: string; value: unknown }[];
    const db = await this.initDatabase();

    if (!db) {
      for (const r of records) {
        this.memoryFallback.set(this.getCompositeKey(r.namespace, r.key), r.value);
      }
      this.persistMemoryFallback();
      return { success: true, recordCount: records.length };
    }

    return new Promise<{ success: boolean; recordCount: number }>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const r of records) {
        const id = this.getCompositeKey(r.namespace, r.key);
        store.put({
          id,
          namespace: r.namespace,
          key: r.key,
          value: r.value,
          updatedAt: new Date().toISOString()
        });
      }

      tx.oncomplete = () => resolve({ success: true, recordCount: records.length });
      tx.onerror = () => reject(tx.error);
    });
  }
}
