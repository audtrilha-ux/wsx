import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { 
  ICloudSyncAdapter, 
  CloudSyncConnectionState, 
  CloudSyncBatchPayload, 
  CloudSyncBatchResult 
} from '../../contracts/sync/sync.contract';

/**
 * CloudSyncAdapter (Remote Cloud Sync Provider)
 * Implements ICloudSyncAdapter to handle multi-tenant remote sync replication,
 * batch dispatching to the Central Platform Cloud API, and health verification.
 */
@Injectable({
  providedIn: 'root'
})
export class CloudSyncAdapter implements ICloudSyncAdapter {
  private http = inject(HttpClient);

  private readonly _connectionState = signal<CloudSyncConnectionState>('disconnected');
  readonly connectionStateSignal = this._connectionState.asReadonly();

  get connectionState(): CloudSyncConnectionState {
    return this._connectionState();
  }

  async pushBatch(payload: CloudSyncBatchPayload): Promise<CloudSyncBatchResult> {
    this._connectionState.set('connecting');
    try {
      const response = await firstValueFrom(
        this.http.post<CloudSyncBatchResult>('/api/v1/sync/batch', {
          companyId: payload.tenantId,
          operations: payload.operations
        })
      );

      this._connectionState.set('connected');
      return response;
    } catch (err: unknown) {
      this._connectionState.set('error');
      throw err;
    }
  }

  async fetchRemoteChanges<T>(tenantId: string, sinceTimestamp?: string): Promise<{ records: T[]; latestTimestamp: string }> {
    this._connectionState.set('connecting');
    try {
      const params: Record<string, string> = { tenantId };
      if (sinceTimestamp) {
        params['since'] = sinceTimestamp;
      }

      const response = await firstValueFrom(
        this.http.get<{ records: T[]; latestTimestamp: string }>('/api/v1/sync/changes', { params })
      );

      this._connectionState.set('connected');
      return response;
    } catch (err: unknown) {
      this._connectionState.set('error');
      throw err;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ status: string }>('/api/v1/telemetry/health')
      );
      const isHealthy = res?.status === 'ok' || res?.status === 'healthy';
      this._connectionState.set(isHealthy ? 'connected' : 'error');
      return isHealthy;
    } catch {
      this._connectionState.set('error');
      return false;
    }
  }
}
