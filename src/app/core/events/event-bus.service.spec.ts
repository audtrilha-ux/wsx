import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OsEventBusService } from './event-bus.service';
import { OsEventLogService } from './event-log.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { OsEvent } from '../../contracts/events/events.contract';

describe('OsEventBusService', () => {
  let eventBus: OsEventBusService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OsEventBusService,
        { provide: OsEventLogService, useValue: null },
        { provide: DiagnosticsService, useValue: null }
      ]
    });
    eventBus = TestBed.inject(OsEventBusService);
  });

  it('should deliver events to subscribed handlers for a specific topic', () => {
    let receivedPayload: unknown = null;
    let receivedTopic = '';

    const sub = eventBus.subscribe<{ orderId: string }>('marketplace.order_created', (evt) => {
      receivedPayload = evt.payload;
      receivedTopic = evt.topic;
    });

    eventBus.publish('marketplace.order_created', { orderId: 'ord_123' }, 'app_marketplace');

    expect(receivedTopic).toBe('marketplace.order_created');
    expect(receivedPayload).toEqual({ orderId: 'ord_123' });

    sub.unsubscribe();
  });

  it('should not deliver events after unsubscribe', () => {
    let callCount = 0;
    const sub = eventBus.subscribe('sale.completed', () => {
      callCount++;
    });

    eventBus.publish('sale.completed', { total: 100 });
    expect(callCount).toBe(1);

    sub.unsubscribe();
    eventBus.publish('sale.completed', { total: 200 });
    expect(callCount).toBe(1);
  });

  it('should deliver all events to wildcard (*) subscribers', () => {
    const receivedEvents: OsEvent[] = [];

    eventBus.subscribe('*', (evt) => {
      receivedEvents.push(evt);
    });

    eventBus.publish('order.new', { id: 1 });
    eventBus.publish('stock.alert', { sku: 'ABC' });

    expect(receivedEvents.length).toBe(2);
    expect(receivedEvents[0].topic).toBe('order.new');
    expect(receivedEvents[1].topic).toBe('stock.alert');
  });

  it('should clear subscriptions when requested', () => {
    let calls = 0;
    eventBus.subscribe('test.topic', () => { calls++; });
    eventBus.clearSubscriptions('test.topic');

    eventBus.publish('test.topic', {});
    expect(calls).toBe(0);
  });
});
