/**
 * 3EATCRU OS - Storage Contracts (Section 8.1)
 * Portas de persistência, transações e consultas transacionais
 */

export interface IQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, string | number | boolean>;
}

export interface IQueryResult<T = unknown> {
  key: string;
  value: T;
}

export interface ITransaction {
  get<T = unknown>(key: string): Promise<T | null>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface IMigration {
  version: number;
  up(tx: ITransaction): Promise<void>;
  down(tx: ITransaction): Promise<void>;
}

export interface IStorageNamespace {
  readonly namespace: string;
  get<T = unknown>(key: string): Promise<T | null>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  query<T = unknown>(options?: IQueryOptions): Promise<IQueryResult<T>[]>;
  clear(): Promise<void>;
  transaction<R>(callback: (tx: ITransaction) => Promise<R>): Promise<R>;
}

export interface IStorage {
  getNamespace(namespace: string): IStorageNamespace;
  migrate(migrations?: IMigration[]): Promise<void>;
  backup(): Promise<Blob | null>;
  getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'error'; details: string; latencyMs: number }>;
}
