/**
 * 3EATCRU OS - Diagnostics Contracts (Section 8.1 & Section 17)
 * Health checks, telemetria e registros de log
 */

export type HealthStatus = 'healthy' | 'degraded' | 'error';

export interface IHealthCheckResult {
  readonly component: string;
  readonly status: HealthStatus;
  readonly details: string;
  readonly timestamp: Date;
  readonly latencyMs?: number;
}

export interface IHealthCheck {
  runCheck(): Promise<IHealthCheckResult[]>;
}

export interface IMetrics {
  recordLatency(operation: string, durationMs: number): void;
  incrementCounter(name: string, value?: number): void;
  getSnapshot(): Record<string, number>;
}

export interface ILogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
}
