/**
 * 3EATCRU OS - Sync & Outbox Contracts (Section 8.1 & Section 10)
 * Contratos do motor de sincronização local-first e resiliência transacional
 */

export type OutboxStatus = 'pending' | 'processing' | 'failed' | 'acknowledged';

export interface IOutboxEntry {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly action: string;
  readonly payload: unknown;
  readonly endpoint: string;
  readonly timestamp: Date;
  readonly status: OutboxStatus;
  readonly retryCount?: number;
  readonly lastError?: string;
}

export interface IConflictResolver<T = unknown> {
  resolve(local: T, remote: T, strategy: 'append-only' | 'last-write-wins' | 'crdt'): T;
}

export interface IReconciler {
  reconcile(): Promise<{ applied: number; conflicts: number; failed: number }>;
}

export interface IOutbox {
  enqueue(action: string, payload: unknown, endpoint: string): Promise<IOutboxEntry>;
  getPending(): Promise<IOutboxEntry[]>;
  acknowledge(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  purgeAcknowledged(): Promise<void>;
}

export interface ISyncEngine {
  readonly isSyncing: boolean;
  readonly pendingCount: number;
  sync(): Promise<void>;
  registerConflictResolver<T>(entityName: string, resolver: IConflictResolver<T>): void;
}

export type CloudSyncConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface CloudSyncBatchPayload {
  tenantId: string;
  operations: {
    id: string;
    idempotencyKey: string;
    tenantId: string;
    deviceId?: string;
    branchId?: string;
    appId?: string;
    action: string;
    payload: unknown;
    timestamp: string;
  }[];
}

export interface CloudSyncBatchResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  serverTimestamp: string;
  acks: {
    opId: string;
    idempotencyKey: string;
    status: 'ACK' | 'DUPLICATE' | 'FAILED';
    error?: string;
    serverTimestamp: string;
  }[];
}

export interface ICloudSyncAdapter {
  readonly connectionState: CloudSyncConnectionState;
  pushBatch(payload: CloudSyncBatchPayload): Promise<CloudSyncBatchResult>;
  fetchRemoteChanges<T>(tenantId: string, sinceTimestamp?: string): Promise<{ records: T[]; latestTimestamp: string }>;
  checkHealth(): Promise<boolean>;
}

