import { Injectable, inject } from '@angular/core';
import { IOsDatabaseAdapter, OsDatabaseTransaction, OsQueryOptions } from '../../../contracts/os/os-database.contract';
import { SqliteNativeAdapter } from './sqlite-native.adapter';
import { IndexedDbDatabaseAdapter } from './indexeddb-database.adapter';
import { DevelopmentVirtualAdapter } from './development-virtual.adapter';

/**
 * PlatformDatabaseAdapter (DatabaseAdapterResolver)
 * Decouples platform-level storage requests. Dynamically resolves:
 * 1. Native Desktop/Mobile (Electron, Capacitor, POS terminals with bridge) -> SqliteNativeAdapter
 * 2. Web Browser Runtime (Client OS Web) -> IndexedDbDatabaseAdapter
 * 3. Server-Side Rendering (SSR) & Headless Test Runtimes -> DevelopmentVirtualAdapter
 */
@Injectable({
  providedIn: 'root'
})
export class PlatformDatabaseAdapter implements IOsDatabaseAdapter {
  private nativeAdapter = inject(SqliteNativeAdapter);
  private indexedDbAdapter = inject(IndexedDbDatabaseAdapter);
  private virtualAdapter = inject(DevelopmentVirtualAdapter);

  private get activeAdapter(): IOsDatabaseAdapter {
    const win = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
    const hasBridge = !!win && (!!win['sqliteBridge'] || !!win['electronAPI']);
    if (hasBridge) {
      return this.nativeAdapter;
    }

    // Browser client environment with IndexedDB support (excluding Node test runners)
    const isNode = typeof globalThis !== 'undefined' && !!(globalThis as Record<string, unknown>)['process'];
    const isBrowserRuntime = typeof window !== 'undefined' && !!window.indexedDB && !isNode;
    if (isBrowserRuntime) {
      return this.indexedDbAdapter;
    }

    return this.virtualAdapter;
  }

  async get<T = unknown>(namespace: string, key: string): Promise<T | null> {
    return this.activeAdapter.get<T>(namespace, key);
  }

  async put<T = unknown>(namespace: string, key: string, value: T): Promise<void> {
    return this.activeAdapter.put<T>(namespace, key, value);
  }

  async delete(namespace: string, key: string): Promise<void> {
    return this.activeAdapter.delete(namespace, key);
  }

  async query<T = unknown>(namespace: string, options?: OsQueryOptions): Promise<{ key: string; value: T }[]> {
    return this.activeAdapter.query<T>(namespace, options);
  }

  async clear(namespace: string): Promise<void> {
    return this.activeAdapter.clear(namespace);
  }

  async transaction<R>(namespace: string, callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R> {
    return this.activeAdapter.transaction<R>(namespace, callback);
  }

  async migrate(): Promise<void> {
    return this.activeAdapter.migrate();
  }

  async backup(passphrase?: string): Promise<Blob | null> {
    return this.activeAdapter.backup(passphrase);
  }

  async restore(data: string | Blob, passphrase?: string): Promise<{ success: boolean; recordCount: number }> {
    if (this.activeAdapter.restore) {
      return this.activeAdapter.restore(data, passphrase);
    }
    throw new Error('Adaptador ativo não suporta restauração.');
  }
}

// Backward-compatibility alias
export { PlatformDatabaseAdapter as NativeDatabaseAdapter };
export { PlatformDatabaseAdapter as DatabaseAdapterResolver };

