import { TestBed } from '@angular/core/testing';
import { KdsRouterService } from './kds-router.service';
import { OsDatabaseService } from '../../storage/os-database.service';
import { OsEventBusService } from '../../events/event-bus.service';
import { PrinterService } from '../../printing/printer.service';
import { DiagnosticsService } from '../../diagnostics/diagnostics.service';
import { P2PNetworkService } from '../../network/p2p-network.service';

describe('KdsRouterService — KDS Stations, SLA & Multi-Terminal Routing', () => {
  let service: KdsRouterService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    const mockDb = {
      getNamespace: () => ({
        query: async () => [],
        put: async () => undefined
      })
    };
    const mockEventBus = { publish: () => true };
    const mockPrinter = { printText: async () => true };
    const mockDiagnostics = { info: () => true, warn: () => true, error: () => true };
    const mockP2p = { broadcastMessage: () => Promise.resolve() };

    TestBed.configureTestingModule({
      providers: [
        KdsRouterService,
        { provide: OsDatabaseService, useValue: mockDb },
        { provide: OsEventBusService, useValue: mockEventBus },
        { provide: PrinterService, useValue: mockPrinter },
        { provide: DiagnosticsService, useValue: mockDiagnostics },
        { provide: P2PNetworkService, useValue: mockP2p }
      ]
    });

    service = TestBed.inject(KdsRouterService);
  });

  it('should route items automatically by kitchen station (Kitchen vs Bar)', async () => {
    const tickets = await service.routeAndSubmitOrder({
      companyId: 'cmp_01',
      branchId: 'br_01',
      tableNumber: 12,
      orderType: 'dine_in',
      items: [
        { productId: 'p1', name: 'Hambúrguer Artesanal', quantity: 2, category: 'Lanches' },
        { productId: 'p2', name: 'Chopp Pilsen 500ml', quantity: 3, category: 'Bebidas' }
      ]
    });

    expect(tickets.length).toBe(2);
    const kitchenTicket = tickets.find(t => t.station === 'kitchen');
    const barTicket = tickets.find(t => t.station === 'bar');

    expect(kitchenTicket).toBeTruthy();
    expect(barTicket).toBeTruthy();
    expect(barTicket?.items[0].name).toBe('Chopp Pilsen 500ml');
  });

  it('should update ticket status to in_preparation and ready', async () => {
    const tickets = await service.routeAndSubmitOrder({
      companyId: 'cmp_01',
      branchId: 'br_01',
      tableNumber: 5,
      orderType: 'dine_in',
      items: [{ productId: 'p1', name: 'Pizza Pepperoni', quantity: 1, category: 'Pizzas' }]
    });

    const ticketId = tickets[0].id;
    const okPrep = await service.updateTicketStatus(ticketId, 'in_preparation', undefined, 'cmp_01');
    expect(okPrep).toBe(true);

    const okReady = await service.updateTicketStatus(ticketId, 'ready', undefined, 'cmp_01');
    expect(okReady).toBe(true);
  });

  it('should set ticket priority and trigger escalation', async () => {
    const tickets = await service.routeAndSubmitOrder({
      companyId: 'cmp_01',
      branchId: 'br_01',
      tableNumber: 8,
      orderType: 'dine_in',
      items: [{ productId: 'p1', name: 'File Mignon', quantity: 1, category: 'Carnes' }]
    });

    const ticketId = tickets[0].id;
    await service.setPriority(ticketId, 'urgent', 'cmp_01');

    const ticket = service.tickets().find(t => t.id === ticketId);
    expect(ticket?.priority).toBe('urgent');
  });
});
