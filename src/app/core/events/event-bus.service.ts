import { Injectable, inject } from '@angular/core';
import { IEventBus, IEventSubscription, OsEvent, OsEventHandler } from '../../contracts/events/events.contract';
import { OsEventLogService } from './event-log.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';

@Injectable({
  providedIn: 'root'
})
export class OsEventBusService implements IEventBus {
  private eventLog: OsEventLogService | null = null;
  private diagnostics: DiagnosticsService | null = null;
  private handlers = new Map<string, Set<OsEventHandler>>();

  constructor() {
    try {
      this.eventLog = inject(OsEventLogService, { optional: true });
      this.diagnostics = inject(DiagnosticsService, { optional: true });
    } catch {
      this.eventLog = null;
      this.diagnostics = null;
    }
  }

  publish<T = unknown>(topic: string, payload: T, originAppId?: string): void {
    const randSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').substring(0, 8) : Math.random().toString(36).substring(2, 7);
    const event: OsEvent<T> = {
      id: `evt_${Date.now()}_${randSuffix}`,
      topic,
      payload,
      timestamp: new Date(),
      originAppId
    };

    // Auto-record in EventLog for audit/telemetry
    if (this.eventLog) {
      this.eventLog.append(event as OsEvent).catch(err => {
        console.warn('[EventBus] Failed to append event to log:', err);
      });
    }

    // Record in Diagnostics log for kernel telemetry
    if (this.diagnostics) {
      this.diagnostics.info(`[EventBus] Evento publicado - Tópico: "${topic}" | Origem: ${originAppId || 'Kernel'}`);
    }

    const topicHandlers = this.handlers.get(topic);
    if (topicHandlers) {
      topicHandlers.forEach(handler => {
        try {
          handler(event as OsEvent);
        } catch (err) {
          console.error(`[EventBus] Error handling event for topic "${topic}":`, err);
        }
      });
    }

    // Handlers para wildcard '*' (para auditoria e telemetria)
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(event as OsEvent);
        } catch (err) {
          console.error('[EventBus] Error in wildcard handler:', err);
        }
      });
    }
  }

  subscribe<T = unknown>(topic: string, handler: OsEventHandler<T>): IEventSubscription {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
    }

    const set = this.handlers.get(topic)!;
    const genericHandler = handler as OsEventHandler;
    set.add(genericHandler);

    return {
      unsubscribe: () => {
        set.delete(genericHandler);
        if (set.size === 0) {
          this.handlers.delete(topic);
        }
      }
    };
  }

  clearSubscriptions(topic?: string): void {
    if (topic) {
      this.handlers.delete(topic);
    } else {
      this.handlers.clear();
    }
  }
}
