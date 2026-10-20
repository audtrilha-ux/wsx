/**
 * 3EATCRU OS - Network Contracts (Section 8.1)
 * Portas para monitoramento de conectividade, requisições HTTP e resiliência
 */

export interface NetworkStatus {
  isOnline: boolean;
  type?: 'wifi' | 'cellular' | 'ethernet' | 'offline' | 'unknown';
  effectiveSpeedMbps?: number;
  lastCheckedAt: Date;
}

export interface IConnectivityMonitor {
  readonly status: NetworkStatus;
  isOnline(): boolean;
  onStatusChange(callback: (status: NetworkStatus) => void): () => void;
  checkConnection(): Promise<boolean>;
}

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeoutMs?: number;
  retryAttempts?: number;
}

export interface IHttpClient {
  get<T = unknown>(url: string, options?: HttpRequestOptions): Promise<T>;
  post<T = unknown>(url: string, body: unknown, options?: HttpRequestOptions): Promise<T>;
  put<T = unknown>(url: string, body: unknown, options?: HttpRequestOptions): Promise<T>;
  patch<T = unknown>(url: string, body: unknown, options?: HttpRequestOptions): Promise<T>;
  delete<T = unknown>(url: string, options?: HttpRequestOptions): Promise<T>;
}

export interface INetwork {
  readonly connectivity: IConnectivityMonitor;
  readonly http: IHttpClient;
}
