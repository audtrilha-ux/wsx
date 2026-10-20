import { InjectionToken } from '@angular/core';

/**
 * 3EATCRU OS - OS Database & Storage Contract
 * Contrato de persistência transacional com isolamento por namespace
 */
export interface OsQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, string | number | boolean>;
}

export interface OsDatabaseTransaction {
  get<T = unknown>(key: string, overrideNs?: string): Promise<T | null>;
  put<T = unknown>(key: string, value: T, overrideNs?: string): Promise<void>;
  delete(key: string, overrideNs?: string): Promise<void>;
}

export interface OsDatabaseNamespace {
  readonly namespace: string;
  get<T = unknown>(key: string): Promise<T | null>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  query<T = unknown>(options?: OsQueryOptions): Promise<{ key: string; value: T }[]>;
  clear(): Promise<void>;
  transaction<R>(callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R>;
}

export interface IOsDatabaseAdapter {
  get<T = unknown>(namespace: string, key: string): Promise<T | null>;
  put<T = unknown>(namespace: string, key: string, value: T): Promise<void>;
  delete(namespace: string, key: string): Promise<void>;
  query<T = unknown>(namespace: string, options?: OsQueryOptions): Promise<{ key: string; value: T }[]>;
  clear(namespace: string): Promise<void>;
  transaction<R>(namespace: string, callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R>;
  migrate(): Promise<void>;
  backup(passphrase?: string): Promise<Blob | null>;
  restore?(data: string | Blob, passphrase?: string): Promise<{ success: boolean; recordCount: number }>;
}

export interface IOsDatabaseService {
  getNamespace(namespace: string): OsDatabaseNamespace;
  migrate(): Promise<void>;
  backup(passphrase?: string): Promise<Blob | null>;
  restore?(data: string | Blob, passphrase?: string): Promise<{ success: boolean; recordCount: number }>;
  getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'error'; details: string; latencyMs: number }>;
}

export const OS_DATABASE_ADAPTER = new InjectionToken<IOsDatabaseAdapter>('OS_DATABASE_ADAPTER');

