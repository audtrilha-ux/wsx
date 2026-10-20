import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { KdsTicket, KdsItem, KitchenStation, KdsTicketStatus, KdsOrderPriority } from '../../../contracts/kds/kds.contract';
import { OsDatabaseService } from '../../storage/os-database.service';
import { OsEventBusService } from '../../events/event-bus.service';
import { PrinterService } from '../../printing/printer.service';
import { DiagnosticsService } from '../../diagnostics/diagnostics.service';
import { P2PNetworkService } from '../../network/p2p-network.service';

@Injectable({
  providedIn: 'root'
})
export class KdsRouterService implements OnDestroy {
  private osDb = inject(OsDatabaseService);
  private eventBus = inject(OsEventBusService);
  private printerService = inject(PrinterService);
  private diagnostics = inject(DiagnosticsService);
  private p2pService = inject(P2PNetworkService);

  private readonly ticketsSignal = signal<KdsTicket[]>([]);
  readonly tickets = this.ticketsSignal.asReadonly();

  private slaCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.loadTicketsFromStorage();
    this.startSlaMonitor();
  }

  ngOnDestroy(): void {
    if (this.slaCheckTimer) clearInterval(this.slaCheckTimer);
  }

  async loadTicketsFromStorage(companyId = 'cmp_default'): Promise<void> {
    try {
      const ns = this.osDb.getNamespace(`tenant.${companyId}.kds_tickets`);
      const stored = await ns.query<KdsTicket>();
      if (stored && stored.length > 0) {
        this.ticketsSignal.set(stored.map(s => s.value));
      }
    } catch (err) {
      this.diagnostics.warn('[KDS] Erro ao carregar tickets de cozinha do banco:', { error: String(err) });
    }
  }

  async routeAndSubmitOrder(params: {
    companyId: string;
    branchId: string;
    tableNumber?: number;
    tableName?: string;
    customerName?: string;
    orderType: 'dine_in' | 'takeout' | 'delivery' | 'comanda';
    priority?: KdsOrderPriority;
    items: { productId: string; name: string; quantity: number; notes?: string; category?: string }[];
  }): Promise<KdsTicket[]> {
    const createdTickets: KdsTicket[] = [];
    const now = new Date();

    // Agrupa itens por estação de destino
    const itemsByStation = new Map<KitchenStation, KdsItem[]>();

    params.items.forEach(i => {
      const station = this.determineStationByCategory(i.category, i.name);
      const kdsItem: KdsItem = {
        id: `kitem_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        notes: i.notes,
        station,
        status: 'queued'
      };

      if (!itemsByStation.has(station)) {
        itemsByStation.set(station, []);
      }
      itemsByStation.get(station)!.push(kdsItem);
    });

    for (const [station, stationItems] of itemsByStation.entries()) {
      const ticketId = `kds_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      const ticket: KdsTicket = {
        id: ticketId,
        companyId: params.companyId,
        branchId: params.branchId,
        tableNumber: params.tableNumber,
        tableName: params.tableName,
        customerName: params.customerName,
        orderType: params.orderType,
        station,
        priority: params.priority || 'normal',
        items: stationItems,
        status: 'queued',
        createdAt: now,
        estimatedPreparationMinutes: station === 'bar' ? 5 : 15,
        slaTargetMinutes: station === 'bar' ? 10 : 25,
        isSlaBreached: false
      };

      // Persiste no banco local
      const ns = this.osDb.getNamespace(`tenant.${params.companyId}.kds_tickets`);
      await ns.put(ticketId, ticket);

      // Dispara evento interno e transmite via P2P LAN
      this.eventBus.publish('kds.ticket_created', ticket);
      this.p2pService.broadcastMessage('KDS_TICKET_NEW', ticket);

      // Roteia impressão automática para a impressora do setor
      this.printTicketToSectorPrinter(ticket);

      createdTickets.push(ticket);
    }

    this.ticketsSignal.update(list => [...createdTickets, ...list]);
    this.diagnostics.info(`[KDS Router] Pedido roteado em ${createdTickets.length} ticket(s) de produção.`);
    return createdTickets;
  }

  async updateTicketStatus(ticketId: string, status: KdsTicketStatus, reason?: string, companyId = 'cmp_default'): Promise<boolean> {
    const ticket = this.tickets().find(t => t.id === ticketId);
    if (!ticket) return false;

    const now = new Date();
    const updatedItems = ticket.items.map(item => ({
      ...item,
      status,
      preparationStartedAt: status === 'in_preparation' ? (item.preparationStartedAt || now) : item.preparationStartedAt,
      readyAt: status === 'ready' ? now : item.readyAt,
      servedAt: status === 'served' ? now : item.servedAt
    }));

    const updatedTicket: KdsTicket = {
      ...ticket,
      status,
      items: updatedItems,
      pausedAt: status === 'paused' ? now : undefined,
      pausedReason: status === 'paused' ? reason : undefined
    };

    const ns = this.osDb.getNamespace(`tenant.${companyId}.kds_tickets`);
    await ns.put(ticketId, updatedTicket);

    this.eventBus.publish('kds.ticket_updated', updatedTicket);
    this.p2pService.broadcastMessage('KDS_TICKET_UPDATE', updatedTicket);

    this.ticketsSignal.update(list => {
      const idx = list.findIndex(t => t.id === ticketId);
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = updatedTicket;
        return copy;
      }
      return list;
    });

    return true;
  }

  async setPriority(ticketId: string, priority: KdsOrderPriority, companyId = 'cmp_default'): Promise<boolean> {
    const ticket = this.tickets().find(t => t.id === ticketId);
    if (!ticket) return false;

    const updated: KdsTicket = { ...ticket, priority };
    const ns = this.osDb.getNamespace(`tenant.${companyId}.kds_tickets`);
    await ns.put(ticketId, updated);

    this.ticketsSignal.update(list => list.map(t => t.id === ticketId ? updated : t));
    return true;
  }

  private determineStationByCategory(category?: string, name?: string): KitchenStation {
    const catClean = (category || '').toLowerCase();
    const nameClean = (name || '').toLowerCase();

    if (catClean.includes('bebida') || catClean.includes('bar') || catClean.includes('drink') || nameClean.includes('cerveja') || nameClean.includes('suco')) {
      return 'bar';
    }
    if (catClean.includes('churrasco') || catClean.includes('grelhado') || nameClean.includes('steak') || nameClean.includes('picanha')) {
      return 'grill';
    }
    if (catClean.includes('sobremesa') || catClean.includes('doces') || nameClean.includes('sorvete') || nameClean.includes('pudim')) {
      return 'dessert';
    }
    return 'kitchen';
  }

  private async printTicketToSectorPrinter(ticket: KdsTicket): Promise<void> {
    try {
      const header = `=== KDS TICKET: ${ticket.station.toUpperCase()} ===\nMesa/Comanda: ${ticket.tableNumber || ticket.tableName || 'Balcão'}\nPrioridade: ${ticket.priority.toUpperCase()}\n--------------------------------\n`;
      const itemsText = ticket.items.map(i => `${i.quantity}x ${i.name}${i.notes ? ` (${i.notes})` : ''}`).join('\n');
      const footer = `\n--------------------------------\nHorário: ${new Date().toLocaleTimeString()}\n`;

      await this.printerService.print('KDS Ticket', `${header}${itemsText}${footer}`, '80mm', 1);
    } catch {
      // Ignora erro de impressão em background
    }
  }

  private startSlaMonitor(): void {
    if (typeof window !== 'undefined') {
      this.slaCheckTimer = setInterval(() => {
        const now = Date.now();
        this.tickets().forEach(ticket => {
          if (ticket.status === 'queued' || ticket.status === 'in_preparation') {
            const elapsedMinutes = (now - new Date(ticket.createdAt).getTime()) / 60000;
            if (elapsedMinutes >= ticket.slaTargetMinutes && !ticket.isSlaBreached) {
              this.diagnostics.warn(`[KDS SLA] Ticket ${ticket.id} (${ticket.station}) estourou o SLA de ${ticket.slaTargetMinutes} min!`);
              this.markSlaBreached(ticket.id);
            }
          }
        });
      }, 30000);
    }
  }

  private markSlaBreached(ticketId: string): void {
    this.ticketsSignal.update(list => list.map(t => t.id === ticketId ? { ...t, isSlaBreached: true, priority: 'urgent' } : t));
  }
}
