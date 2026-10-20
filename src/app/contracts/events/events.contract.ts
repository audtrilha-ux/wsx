/**
 * 3EATCRU OS - Events & Message Bus Contracts (Section 8.1 & Section 5)
 * Barramento reativo de eventos do Kernel e comunicação desacoplada
 */

export interface OsEvent<T = unknown> {
  readonly id: string;
  readonly topic: string;
  readonly payload: T;
  readonly timestamp: Date;
  readonly originAppId?: string;
  readonly tenantId?: string;
}

export type OsEventHandler<T = unknown> = (event: OsEvent<T>) => void | Promise<void>;

export interface IEventSubscription {
  unsubscribe(): void;
}

export interface IEventBus {
  publish<T = unknown>(topic: string, payload: T, originAppId?: string): void;
  subscribe<T = unknown>(topic: string, handler: OsEventHandler<T>): IEventSubscription;
  clearSubscriptions(topic?: string): void;
}

export interface IEventLog {
  append(event: OsEvent): Promise<void>;
  getHistory(options?: { topic?: string; since?: Date; limit?: number }): Promise<OsEvent[]>;
  clearHistory(olderThan?: Date): Promise<void>;
}
