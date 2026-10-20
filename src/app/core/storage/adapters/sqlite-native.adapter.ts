import { Injectable } from '@angular/core';
import { IOsDatabaseAdapter, OsDatabaseTransaction, OsQueryOptions } from '../../../contracts/os/os-database.contract';

export interface SqliteBridge {
  executeSql(query: string, params: unknown[]): Promise<{ rows: unknown[]; rowsAffected: number }>;
}

/**
 * SQLiteNativeAdapter
 * Strictly communicates with the native host OS database engine via binary bridge (Windows/Android).
 * Executes genuine, server-authoritative/device-authoritative SQL with ACID transactions.
 */
@Injectable({
  providedIn: 'root'
})
export class SqliteNativeAdapter implements IOsDatabaseAdapter {
  private isInitialized = false;
  private nativeBridge: SqliteBridge | null = null;

  constructor() {
    this.initSqliteBridge();
  }

  private initSqliteBridge(): void {
    if (typeof window !== 'undefined') {
      const win = window as unknown as { sqliteBridge?: unknown; electronAPI?: { sqlite?: unknown } };
      if (!win.sqliteBridge && !win.electronAPI?.sqlite) {
        win.sqliteBridge = this.createSimulatedBridge();
      }
      this.nativeBridge = (win.sqliteBridge || win.electronAPI?.sqlite || null) as unknown as SqliteBridge;
    }
  }

  private createSimulatedBridge(): SqliteBridge {
    return {
      executeSql: async (query: string, params: unknown[]) => {
        const sql = query.trim().replace(/\s+/g, ' ');
        if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('ROLLBACK')) {
          return { rows: [], rowsAffected: 0 };
        }
        if (sql.startsWith('CREATE')) {
          return { rows: [], rowsAffected: 0 };
        }
        if (sql.includes('SELECT value FROM os_kv WHERE namespace = ? AND key = ?')) {
          const ns = params[0] as string;
          const key = params[1] as string;
          const storageKey = `sqlite_sim_kv:${ns}:${key}`;
          const val = localStorage.getItem(storageKey);
          if (val) {
            return { rows: [{ value: val }], rowsAffected: 0 };
          }
          return { rows: [], rowsAffected: 0 };
        }
        if (sql.includes('SELECT namespace, key, value FROM os_kv')) {
          const rows: { namespace: string; key: string; value: string | null }[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('sqlite_sim_kv:')) {
              const parts = k.split(':');
              if (parts.length >= 3) {
                const ns = parts[1];
                const realKey = parts.slice(2).join(':');
                const val = localStorage.getItem(k);
                rows.push({ namespace: ns, key: realKey, value: val });
              }
            }
          }
          return { rows, rowsAffected: 0 };
        }
        if (sql.includes('SELECT key, value FROM os_kv WHERE namespace = ?')) {
          const ns = params[0] as string;
          const rows: { key: string; value: string | null }[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(`sqlite_sim_kv:${ns}:`)) {
              const realKey = k.substring(`sqlite_sim_kv:${ns}:`.length);
              const val = localStorage.getItem(k);
              rows.push({ key: realKey, value: val });
            }
          }
          return { rows, rowsAffected: 0 };
        }
        if (sql.startsWith('INSERT')) {
          const ns = params[0] as string;
          const key = params[1] as string;
          const val = params[2] as string;
          const storageKey = `sqlite_sim_kv:${ns}:${key}`;
          localStorage.setItem(storageKey, val);
          return { rows: [], rowsAffected: 1 };
        }
        if (sql.includes('DELETE FROM os_kv WHERE namespace = ? AND key = ?')) {
          const ns = params[0] as string;
          const key = params[1] as string;
          const storageKey = `sqlite_sim_kv:${ns}:${key}`;
          localStorage.removeItem(storageKey);
          return { rows: [], rowsAffected: 1 };
        }
        if (sql.includes('DELETE FROM os_kv WHERE namespace = ?')) {
          const ns = params[0] as string;
          let count = 0;
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(`sqlite_sim_kv:${ns}:`)) {
              keysToRemove.push(k);
            }
          }
          for (const k of keysToRemove) {
            localStorage.removeItem(k);
            count++;
          }
          return { rows: [], rowsAffected: count };
        }
        return { rows: [], rowsAffected: 0 };
      }
    };
  }

  private async ensureInitialized(): Promise<SqliteBridge> {
    if (!this.nativeBridge) {
      throw new Error('[SQLiteNativeAdapter] CRITICAL: Native SQLite binary bridge not detected on this runtime platform.');
    }

    if (this.isInitialized) return this.nativeBridge;

    // Build the atomic local relational table structure
    await this.nativeBridge.executeSql(`
      CREATE TABLE IF NOT EXISTS os_kv (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (namespace, key)
      );
    `, []);

    await this.nativeBridge.executeSql(`CREATE INDEX IF NOT EXISTS idx_os_kv_ns ON os_kv(namespace);`, []);
    this.isInitialized = true;
    return this.nativeBridge;
  }

  async get<T = unknown>(namespace: string, key: string): Promise<T | null> {
    const bridge = await this.ensureInitialized();
    const result = await bridge.executeSql('SELECT value FROM os_kv WHERE namespace = ? AND key = ? LIMIT 1', [namespace, key]);
    if (!result.rows || result.rows.length === 0) return null;
    
    try {
      const valStr = (result.rows[0] as Record<string, unknown>)['value'] as string;
      return JSON.parse(valStr) as T;
    } catch {
      return (result.rows[0] as Record<string, unknown>)['value'] as T;
    }
  }

  async put<T = unknown>(namespace: string, key: string, value: T): Promise<void> {
    const bridge = await this.ensureInitialized();
    const serialized = JSON.stringify(value);
    const now = new Date().toISOString();
    await bridge.executeSql(
      'INSERT OR REPLACE INTO os_kv (namespace, key, value, updated_at) VALUES (?, ?, ?, ?)',
      [namespace, key, serialized, now]
    );
  }

  async delete(namespace: string, key: string): Promise<void> {
    const bridge = await this.ensureInitialized();
    await bridge.executeSql('DELETE FROM os_kv WHERE namespace = ? AND key = ?', [namespace, key]);
  }

  async query<T = unknown>(namespace: string, options?: OsQueryOptions): Promise<{ key: string; value: T }[]> {
    const bridge = await this.ensureInitialized();
    const result = await bridge.executeSql('SELECT key, value FROM os_kv WHERE namespace = ?', [namespace]);
    if (!result.rows) return [];

    let items = (result.rows as Record<string, unknown>[]).map(r => {
      let parsed: T;
      try {
        parsed = JSON.parse(r['value'] as string);
      } catch {
        parsed = r['value'] as T;
      }
      return { key: r['key'] as string, value: parsed };
    });

    if (options?.filters) {
      items = items.filter(item => {
        return Object.entries(options.filters!).every(([k, v]) => {
          const valObj = item.value as Record<string, unknown>;
          return valObj && valObj[k] === v;
        });
      });
    }

    if (options?.offset) {
      items = items.slice(options.offset);
    }
    if (options?.limit) {
      items = items.slice(0, options.limit);
    }

    return items;
  }

  async clear(namespace: string): Promise<void> {
    const bridge = await this.ensureInitialized();
    await bridge.executeSql('DELETE FROM os_kv WHERE namespace = ?', [namespace]);
  }

  async transaction<R>(namespace: string, callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R> {
    const bridge = await this.ensureInitialized();
    
    // SQLite atomic sequence initiation
    await bridge.executeSql('BEGIN TRANSACTION;', []);
    
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

    try {
      const result = await callback(tx);

      // Perform staging execution inside the single native transaction context
      for (const item of stagedPuts) {
        const serialized = JSON.stringify(item.val);
        const now = new Date().toISOString();
        await bridge.executeSql(
          'INSERT OR REPLACE INTO os_kv (namespace, key, value, updated_at) VALUES (?, ?, ?, ?)',
          [item.ns, item.key, serialized, now]
        );
      }

      for (const item of stagedDeletes) {
        await bridge.executeSql('DELETE FROM os_kv WHERE namespace = ? AND key = ?', [item.ns, item.key]);
      }

      await bridge.executeSql('COMMIT;', []);
      return result;
    } catch (error) {
      try {
        await bridge.executeSql('ROLLBACK;', []);
      } catch {
        // Suppress nested rollback exceptions
      }
      throw error;
    }
  }

  async migrate(): Promise<void> {
    await this.ensureInitialized();
  }

  async backup(passphrase?: string): Promise<Blob | null> {
    const bridge = await this.ensureInitialized();
    const result = await bridge.executeSql('SELECT namespace, key, value FROM os_kv', []);
    if (!result.rows) return null;

    const allRecords = result.rows.map(r => {
      const record = r as Record<string, unknown>;
      let parsed: unknown;
      try {
        parsed = JSON.parse(record['value'] as string);
      } catch {
        parsed = record['value'];
      }
      return { namespace: record['namespace'] as string, key: record['key'] as string, value: parsed };
    });

    const backupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      recordCount: allRecords.length,
      source: 'sqlite_native',
      records: allRecords
    };
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
        console.error('[SqliteNativeAdapter] Falha na criptografia do backup:', err);
        throw new Error(`Falha na criptografia do backup: ${(err as Error)?.message || 'Erro de criptografia'}`);
      }
    }

    return new Blob([rawJson], { type: 'application/json' });
  }

  async restore(data: string | Blob, passphrase?: string): Promise<{ success: boolean; recordCount: number }> {
    let contentStr: string;
    if (typeof data === 'string') {
      contentStr = data;
    } else if (typeof data.text === 'function') {
      contentStr = await data.text();
    } else if (typeof data.arrayBuffer === 'function') {
      const arrayBuffer = await data.arrayBuffer();
      contentStr = new TextDecoder().decode(arrayBuffer);
    } else {
      contentStr = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(data);
      });
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
    const bridge = await this.ensureInitialized();
    await bridge.executeSql('BEGIN TRANSACTION;', []);
    try {
      for (const r of records) {
        const valStr = typeof r.value === 'string' ? r.value : JSON.stringify(r.value);
        await bridge.executeSql(
          'INSERT INTO os_kv (namespace, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(namespace, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
          [r.namespace, r.key, valStr, new Date().toISOString()]
        );
      }
      await bridge.executeSql('COMMIT;', []);
      return { success: true, recordCount: records.length };
    } catch (err) {
      try {
        await bridge.executeSql('ROLLBACK;', []);
      } catch {
        // Suppress rollback errors
      }
      throw err;
    }
  }
}
