import { Injectable } from '@angular/core';
import { IOsDatabaseAdapter, OsDatabaseTransaction, OsQueryOptions } from '../../../contracts/os/os-database.contract';

/**
 * DevelopmentVirtualAdapter
 * Embedded Key-Value in-memory simulator utilizing browser localStorage for native platform preview.
 * Strictly used in non-native runtimes (like browser previews or testing suites) where native bridges are unavailable.
 */
@Injectable({
  providedIn: 'root'
})
export class DevelopmentVirtualAdapter implements IOsDatabaseAdapter {
  private sqliteRows = new Map<string, { namespace: string; key: string; value: string; updated_at: string }>();

  constructor() {
    this.restoreVirtualStore();
  }

  private restoreVirtualStore(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('3eatcru_sqlite_virtual_store_v1');
        if (raw) {
          const arr = JSON.parse(raw) as [string, { namespace: string; key: string; value: string; updated_at: string }][];
          this.sqliteRows = new Map(arr);
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  private persistVirtualStore(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('3eatcru_sqlite_virtual_store_v1', JSON.stringify(Array.from(this.sqliteRows.entries())));
      } catch {
        // Ignore quota limits gracefully
      }
    }
  }

  async get<T = unknown>(namespace: string, key: string): Promise<T | null> {
    const compositeKey = `${namespace}::${key}`;
    const row = this.sqliteRows.get(compositeKey);
    if (!row) return null;

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as unknown as T;
    }
  }

  async put<T = unknown>(namespace: string, key: string, value: T): Promise<void> {
    const compositeKey = `${namespace}::${key}`;
    const serialized = JSON.stringify(value);
    const now = new Date().toISOString();

    this.sqliteRows.set(compositeKey, {
      namespace,
      key,
      value: serialized,
      updated_at: now
    });
    this.persistVirtualStore();
  }

  async delete(namespace: string, key: string): Promise<void> {
    const compositeKey = `${namespace}::${key}`;
    this.sqliteRows.delete(compositeKey);
    this.persistVirtualStore();
  }

  async query<T = unknown>(namespace: string, options?: OsQueryOptions): Promise<{ key: string; value: T }[]> {
    const results: { key: string; value: T }[] = [];

    for (const row of this.sqliteRows.values()) {
      if (row.namespace === namespace) {
        let parsed: T;
        try {
          parsed = JSON.parse(row.value);
        } catch {
          parsed = row.value as unknown as T;
        }
        results.push({ key: row.key, value: parsed });
      }
    }

    let items = results;

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
    for (const [ck, row] of this.sqliteRows.entries()) {
      if (row.namespace === namespace) {
        this.sqliteRows.delete(ck);
      }
    }
    this.persistVirtualStore();
  }

  async transaction<R>(namespace: string, callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R> {
    const rollbackSnapshot = new Map(this.sqliteRows);
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

      // Apply changes at commit time
      for (const item of stagedPuts) {
        await this.put(item.ns, item.key, item.val);
      }
      for (const item of stagedDeletes) {
        await this.delete(item.ns, item.key);
      }

      this.persistVirtualStore();
      return result;
    } catch (error) {
      // Revert snapshot on transaction rollback
      this.sqliteRows = rollbackSnapshot;
      this.persistVirtualStore();
      throw error;
    }
  }

  async migrate(): Promise<void> {
    // Virtual migration is a no-op
    return Promise.resolve();
  }

  async backup(passphrase?: string): Promise<Blob | null> {
    const allRecords: { namespace: string; key: string; value: unknown }[] = [];
    for (const row of this.sqliteRows.values()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = row.value;
      }
      allRecords.push({ namespace: row.namespace, key: row.key, value: parsed });
    }
    const backupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      recordCount: allRecords.length,
      source: 'virtual',
      records: allRecords
    };
    const rawJson = JSON.stringify(backupPayload, null, 2);

    if (passphrase && typeof crypto !== 'undefined' && crypto.subtle) {
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
        console.warn('[DevelopmentVirtualAdapter] Encryption error:', err);
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
    for (const r of records) {
      await this.put(r.namespace, r.key, r.value);
    }
    this.persistVirtualStore();
    return { success: true, recordCount: records.length };
  }
}
