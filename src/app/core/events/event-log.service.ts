import { Injectable, inject } from '@angular/core';
import { IEventLog, OsEvent } from '../../contracts/events/events.contract';
import { OsDatabaseService } from '../storage/os-database.service';
import { OsDatabaseNamespace } from '../../contracts/os/os-database.contract';

@Injectable({
  providedIn: 'root'
})
export class OsEventLogService implements IEventLog {
  private osDb = inject(OsDatabaseService);
  private logDb: OsDatabaseNamespace;

  constructor() {
    this.logDb = this.osDb.getNamespace('system.eventlog');
  }

  async append(event: OsEvent): Promise<void> {
    const key = `log_${event.timestamp.getTime()}_${event.id}`;
    await this.logDb.put(key, {
      ...event,
      timestamp: event.timestamp.toISOString()
    });
  }

  async getHistory(options?: { topic?: string; since?: Date; limit?: number }): Promise<OsEvent[]> {
    const records = await this.logDb.query<OsEvent & { timestamp: string }>();
    let events = records.map(r => ({
      ...r.value,
      timestamp: new Date(r.value.timestamp)
    }));

    if (options?.topic && options.topic !== '*') {
      events = events.filter(e => e.topic === options.topic);
    }

    if (options?.since) {
      const sinceTime = options.since.getTime();
      events = events.filter(e => e.timestamp.getTime() >= sinceTime);
    }

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit && options.limit > 0) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  async clearHistory(olderThan?: Date): Promise<void> {
    const records = await this.logDb.query<OsEvent & { timestamp: string }>();
    const cutoff = olderThan ? olderThan.getTime() : Infinity;

    for (const record of records) {
      const eventTime = new Date(record.value.timestamp).getTime();
      if (eventTime <= cutoff) {
        await this.logDb.delete(record.key);
      }
    }
  }
}
