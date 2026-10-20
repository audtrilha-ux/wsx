/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { 
  GetTablesUseCase, 
  OpenTableUseCase, 
  AddItemToOrderUseCase, 
  UpdateOrderItemStatusUseCase, 
  CloseTableUseCase, 
  GetKitchenOrdersUseCase,
  ReserveTableUseCase,
  CancelReservationUseCase,
  TransferTableUseCase,
  CancelOrderItemUseCase,
  ApplyDiscountUseCase,
  JoinTablesUseCase,
  SplitTableUseCase,
  PayPartialUseCase
} from '../application/tables.usecases';
import { DiningTable, TableOrder, OrderItemStatus } from '../domain/table.entity';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { OsContext } from '../../../contracts/os/os-context.contract';
import { TableCardComponent } from './components/table-card.component';
import { KdsDisplayComponent, TableKitchenOrder } from './components/kds-display.component';
import { TableOpenModalComponent } from './components/table-open-modal.component';
import { TableOrderModalComponent } from './components/table-order-modal.component';
import { TableCheckoutModalComponent } from './components/table-checkout-modal.component';
import { TableReservationModalComponent } from './components/table-reservation-modal.component';
import { TableSplitModalComponent } from './components/table-split-modal.component';

export interface PublicOrderData {
  id: string;
  companyId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  paymentMethod?: string;
  total: number;
  status: string;
  createdAt: string;
  items: {
    name: string;
    unitPrice?: number;
    price?: number;
    quantity: number;
    notes?: string;
  }[];
}

@Component({
  selector: 'app-tables',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatIconModule,
    TableCardComponent,
    KdsDisplayComponent,
    TableOpenModalComponent,
    TableOrderModalComponent,
    TableCheckoutModalComponent,
    TableReservationModalComponent,
    TableSplitModalComponent
  ],
  templateUrl: './tables.component.html'
})
export class TablesComponent implements OnInit, OnDestroy {
  private getTablesUseCase = inject(GetTablesUseCase);
  private openTableUseCase = inject(OpenTableUseCase);
  private addItemToOrderUseCase = inject(AddItemToOrderUseCase);
  private updateOrderItemStatusUseCase = inject(UpdateOrderItemStatusUseCase);
  private closeTableUseCase = inject(CloseTableUseCase);
  private getKitchenOrdersUseCase = inject(GetKitchenOrdersUseCase);
  
  private reserveTableUseCase = inject(ReserveTableUseCase);
  private cancelReservationUseCase = inject(CancelReservationUseCase);
  private transferTableUseCase = inject(TransferTableUseCase);
  private cancelOrderItemUseCase = inject(CancelOrderItemUseCase);
  private applyDiscountUseCase = inject(ApplyDiscountUseCase);
  private joinTablesUseCase = inject(JoinTablesUseCase);
  private splitTableUseCase = inject(SplitTableUseCase);
  private payPartialUseCase = inject(PayPartialUseCase);

  private osSdk = inject(OsSdkService);
  os: OsContext = this.osSdk.bind('app_tables');

  private osSubs: { unsubscribe: () => void }[] = [];

  tables = signal<DiningTable[]>([]);
  kitchenOrders = signal<TableKitchenOrder[]>([]);
  onlineOrders = signal<PublicOrderData[]>([]);
  viewMode = signal<'SALON' | 'KDS'>('SALON');
  tableFilter = signal<'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'BILLING'>('ALL');
  feedbackMessage = signal<string>('');

  // Modals state
  selectedTableForOpen = signal<DiningTable | null>(null);
  selectedTableForReservation = signal<DiningTable | null>(null);
  selectedTableForOrder = signal<DiningTable | null>(null);
  selectedTableForClose = signal<DiningTable | null>(null);
  selectedTableForSplit = signal<DiningTable | null>(null);

  // Derived counts
  availableTablesCount = computed(() => this.tables().filter(t => t.status === 'AVAILABLE').length);
  occupiedTablesCount = computed(() => this.tables().filter(t => t.status === 'OCCUPIED').length);
  billingTablesCount = computed(() => this.tables().filter(t => t.status === 'BILLING').length);
  
  totalSalonRevenue = computed(() => {
    return this.tables().reduce((acc, t) => acc + (t.currentOrder?.total || 0), 0);
  });

  pendingKitchenCount = computed(() => {
    let count = 0;
    for (const ko of this.kitchenOrders()) {
      count += ko.order.items.filter(i => i.status === 'PENDING_KITCHEN').length;
    }
    // Adiciona também pedidos online pendentes e em preparo
    count += this.onlineOrders().filter(o => o.status === 'PENDING' || o.status === 'RECEIVED' || o.status === 'PREPARING').length;
    return count;
  });

  filteredTables = computed(() => {
    const f = this.tableFilter();
    if (f === 'ALL') return this.tables();
    return this.tables().filter(t => t.status === f);
  });

  ngOnInit() {
    this.loadData();

    this.osSubs.push(
      this.os.events.subscribe('marketplace.order_created', (evt: any) => {
        this.loadData();
        const payload = evt?.payload;
        const info = payload?.customerName ? ` de ${payload.customerName}` : '';
        const total = payload?.total ? ` (R$ ${payload.total.toFixed(2)})` : '';
        this.feedbackMessage.set(`Novo pedido online recebido pelo Marketplace${info}!`);
        
        // Emite uma notificação nativa para a Central de Notificações do 3eatcru OS
        this.os.notify(
          'Novo Pedido Online',
          `Pedido recebido${info}${total}. Enviado automaticamente para o KDS.`,
          'success'
        );
      })
    );

    this.osSubs.push(
      this.os.events.subscribe('marketplace.order_status_updated', () => {
        this.loadData();
      })
    );
  }

  ngOnDestroy() {
    this.osSubs.forEach(s => s.unsubscribe());
  }

  async loadData() {
    try {
      const companyId = this.os.companyId;
      const [tableList, kOrders] = await Promise.all([
        this.getTablesUseCase.execute(companyId),
        this.getKitchenOrdersUseCase.execute(companyId)
      ]);
      this.tables.set(tableList);
      this.kitchenOrders.set(kOrders);

      try {
        const res = await this.os.network.http.get<PublicOrderData[] | { orders: PublicOrderData[] }>(`/companies/${companyId}/orders`);
        if (Array.isArray(res)) {
          this.onlineOrders.set(res);
        } else if (res && Array.isArray((res as any).orders)) {
          this.onlineOrders.set((res as any).orders);
        }
      } catch (err) {
        console.warn('Erro ao carregar pedidos online:', err);
      }
    } catch (err) {
      console.error('Erro ao carregar mesas:', err);
    }
  }

  openTableModal(table: DiningTable) {
    this.selectedTableForOpen.set(table);
  }

  async confirmOpenTable(customerCount: number, waiterName: string) {
    const table = this.selectedTableForOpen();
    if (!table) return;

    try {
      const companyId = this.os.companyId;
      await this.openTableUseCase.execute(companyId, table.id, customerCount, waiterName);
      this.selectedTableForOpen.set(null);
      this.feedbackMessage.set(`${table.name} aberta com sucesso!`);
      await this.loadData();
    } catch (err) {
      console.error('Erro ao abrir mesa:', err);
      this.feedbackMessage.set('Falha ao abrir mesa.');
    }
  }

  async confirmReserveTable(clientName: string, time: string, peopleCount: number, contact?: string) {
    const table = this.selectedTableForReservation();
    if (!table) return;

    try {
      const companyId = this.os.companyId;
      await this.reserveTableUseCase.execute(companyId, table.id, clientName, time, peopleCount, contact);
      this.selectedTableForReservation.set(null);
      this.feedbackMessage.set(`Reserva para ${clientName} na ${table.name} agendada!`);
      await this.loadData();
    } catch (err) {
      console.error('Erro ao reservar mesa:', err);
      this.feedbackMessage.set('Falha ao agendar reserva.');
    }
  }

  async cancelReservation(table: DiningTable) {
    try {
      const companyId = this.os.companyId;
      await this.cancelReservationUseCase.execute(companyId, table.id);
      this.feedbackMessage.set(`Reserva da ${table.name} cancelada com sucesso.`);
      await this.loadData();
    } catch (err) {
      console.error('Erro ao cancelar reserva:', err);
      this.feedbackMessage.set('Falha ao cancelar reserva.');
    }
  }

  async transferTable(sourceTableId: string, targetTableId: string) {
    try {
      const companyId = this.os.companyId;
      await this.transferTableUseCase.execute(companyId, sourceTableId, targetTableId);
      this.selectedTableForOrder.set(null);
      this.feedbackMessage.set('Comanda transferida com sucesso!');
      await this.loadData();
    } catch (err) {
      console.error('Erro ao transferir comanda:', err);
      this.feedbackMessage.set('Falha ao transferir comanda.');
    }
  }

  async cancelOrderItem(itemId: string) {
    const table = this.selectedTableForOrder();
    if (!table) return;

    try {
      const companyId = this.os.companyId;
      const updatedTable = await this.cancelOrderItemUseCase.execute(companyId, table.id, itemId);
      this.selectedTableForOrder.set(updatedTable);
      this.feedbackMessage.set('Item da comanda cancelado.');
      await this.loadData();
    } catch (err) {
      console.error('Erro ao cancelar item:', err);
      this.feedbackMessage.set('Falha ao cancelar item.');
    }
  }

  async applyDiscount(discountValue: number, discountType: 'PERCENT' | 'FIXED') {
    const table = this.selectedTableForOrder();
    if (!table) return;

    try {
      const companyId = this.os.companyId;
      const updatedTable = await this.applyDiscountUseCase.execute(companyId, table.id, discountValue, discountType);
      this.selectedTableForOrder.set(updatedTable);
      this.feedbackMessage.set('Desconto aplicado com sucesso!');
      await this.loadData();
    } catch (err) {
      console.error('Erro ao aplicar desconto:', err);
      this.feedbackMessage.set('Falha ao aplicar desconto.');
    }
  }

  selectOrderDetails(table: DiningTable) {
    this.selectedTableForOrder.set(table);
  }

  async addItemToCurrentTable(name: string, quantity: number, price: number, notes?: string) {
    const table = this.selectedTableForOrder();
    if (!table) return;

    try {
      const companyId = this.os.companyId;
      const updatedTable = await this.addItemToOrderUseCase.execute(companyId, table.id, {
        productId: `prod_${Date.now()}`,
        name,
        quantity,
        unitPrice: price,
        notes
      });

      this.selectedTableForOrder.set(updatedTable);
      this.feedbackMessage.set(`"${name}" adicionado à comanda!`);
      await this.loadData();
    } catch (err) {
      console.error('Erro ao adicionar item:', err);
      this.feedbackMessage.set('Falha ao adicionar item à mesa.');
    }
  }

  async updateItemStatus(tableId: string, itemId: string, status: OrderItemStatus) {
    try {
      const companyId = this.os.companyId;
      await this.updateOrderItemStatusUseCase.execute(companyId, tableId, itemId, status);
      await this.loadData();
    } catch (err) {
      console.error('Erro ao atualizar status do item:', err);
    }
  }

  async updateOnlineOrderStatus(orderId: string, status: string) {
    try {
      const existingOrder = this.onlineOrders().find(o => o.id === orderId || (o as { publicTrackingToken?: string }).publicTrackingToken === orderId);
      await this.os.network.http.patch<{ success: boolean }>(`/public-space/orders/${orderId}/status`, { status });
      this.feedbackMessage.set(`Pedido #${orderId.slice(-6)} atualizado para ${status}!`);
      this.os.events.publish('marketplace.order_status_updated', {
        orderId,
        status,
        order: existingOrder ? { ...existingOrder, status } : undefined,
        customerName: existingOrder?.customerName,
        customerPhone: existingOrder?.customerPhone
      }, 'app_tables');
      this.loadData();
    } catch (err) {
      console.error('Erro ao atualizar status do pedido online:', err);
      this.feedbackMessage.set('Falha ao atualizar pedido online.');
    }
  }

  async joinTables(sourceTableId: string, targetTableId: string) {
    try {
      const companyId = this.os.companyId;
      await this.joinTablesUseCase.execute(companyId, sourceTableId, targetTableId);
      this.selectedTableForOrder.set(null);
      this.feedbackMessage.set('Comandas integradas com sucesso!');
      await this.loadData();
    } catch (err) {
      console.error('Erro ao juntar comanda:', err);
      this.feedbackMessage.set('Falha ao mesclar as mesas.');
    }
  }

  openSplitModal(table: DiningTable) {
    this.selectedTableForOrder.set(null);
    this.selectedTableForSplit.set(table);
  }

  async confirmSplitTable(targetTableId: string, itemIdsToMove: { itemId: string; quantity: number }[]) {
    const table = this.selectedTableForSplit();
    if (!table) return;

    try {
      const companyId = this.os.companyId;
      await this.splitTableUseCase.execute(companyId, table.id, targetTableId, itemIdsToMove);
      this.selectedTableForSplit.set(null);
      this.feedbackMessage.set('Itens da comanda separados com sucesso!');
      await this.loadData();
    } catch (err) {
      console.error('Erro ao separar itens:', err);
      this.feedbackMessage.set('Falha ao separar itens da comanda.');
    }
  }

  async confirmPayPartial(amount: number, paymentMethod: string) {
    const table = this.selectedTableForClose();
    if (!table) return;

    try {
      const companyId = this.os.companyId;
      await this.payPartialUseCase.execute(companyId, table.id, amount, paymentMethod);
      this.selectedTableForClose.set(null);
      this.feedbackMessage.set(`Pagamento parcial de R$ ${amount.toFixed(2)} recebido!`);
      await this.loadData();
    } catch (err) {
      console.error('Erro ao receber parcial:', err);
      this.feedbackMessage.set('Falha ao processar pagamento parcial.');
    }
  }

  openCloseTableModal(table: DiningTable) {
    this.selectedTableForOrder.set(null);
    this.selectedTableForClose.set(table);
  }

  async confirmCloseTable(paymentMethod: string) {
    const table = this.selectedTableForClose();
    if (!table) return;

    try {
      const companyId = this.os.companyId;
      const res = await this.closeTableUseCase.execute(companyId, table.id, paymentMethod);
      
      this.selectedTableForClose.set(null);
      this.feedbackMessage.set(`${table.name} encerrada! Venda de R$ ${res.total.toFixed(2)} consolidada no caixa.`);
      
      // Auto print fiscal closing receipt
      this.printFiscalBill(table, res.total, res.saleId, paymentMethod);

      await this.loadData();
    } catch (err) {
      console.error('Erro ao encerrar mesa:', err);
      this.feedbackMessage.set('Falha ao encerrar mesa.');
    }
  }

  async printKitchenTicket(tableNumber: number, tableName: string, order: TableOrder) {
    const dateStr = new Date().toLocaleString('pt-BR');
    const itemsText = order.items
      .map(i => `[ ] ${i.quantity}x ${i.name.toUpperCase()}\n    STATUS: ${i.status}${i.notes ? `\n    OBS: ${i.notes}` : ''}`)
      .join('\n----------------------------------------\n');

    const formattedContent = `
========================================
       3EATCRU OS - TICKET COZINHA
           COMANDA DE PRODUÇÃO
========================================
MESA #${tableNumber} - ${tableName.toUpperCase()}
ATENDENTE: ${order.waiterName}
HORA DO PEDIDO: ${dateStr}
----------------------------------------
ITENS PARA PREPARO:
----------------------------------------
${itemsText}
========================================
TOTAL DE ITENS: ${order.items.length}
    `;

    try {
      await this.os.print(`Cozinha Mesa #${tableNumber}`, formattedContent);
      this.feedbackMessage.set(`Ticket de Cozinha da Mesa #${tableNumber} impresso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na impressora';
      this.feedbackMessage.set(`Atenção: ${msg}.`);
    }
  }

  async printPreBill(table: DiningTable) {
    if (!table.currentOrder) return;
    const order = table.currentOrder;
    const dateStr = new Date().toLocaleString('pt-BR');
    const itemsText = order.items
      .map(i => `${i.quantity}x ${i.name.padEnd(20, ' ')} R$ ${(i.quantity * i.unitPrice).toFixed(2).padStart(8, ' ')}`)
      .join('\n');

    const perPerson = order.perPersonTotal ?? (order.customerCount > 0 ? (order.total / order.customerCount) : order.total);
    const formattedContent = `
========================================
       3EATCRU OS - PRÉ-CONTA
      CONFERÊNCIA DE MESA / SALÃO
========================================
MESA: #${table.number} - ${table.name.toUpperCase()}
ATENDENTE: ${order.waiterName}
CLIENTES: ${order.customerCount} pessoas
DATA/HORA: ${dateStr}
----------------------------------------
ITENS CONSUMIDOS:
${itemsText}
----------------------------------------
SUBTOTAL:                R$ ${order.total.toFixed(2)}
VALOR POR PESSOA (${order.customerCount}x): R$ ${perPerson.toFixed(2)}
========================================
ESTE DOCUMENTO NÃO É DOCUMENTO FISCAL
AGRADECEMOS A PREFERÊNCIA!
    `;

    try {
      await this.os.print(`Pré-Conta Mesa #${table.number}`, formattedContent);
      this.feedbackMessage.set(`Pré-Conta da Mesa #${table.number} emitida na impressora térmica!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na impressora';
      this.feedbackMessage.set(`Atenção: ${msg}.`);
    }
  }

  async printOnlineDeliveryTicket(order: PublicOrderData) {
    const dateStr = new Date(order.createdAt || Date.now()).toLocaleString('pt-BR');
    const itemsText = (order.items || [])
      .map((i: { name: string; unitPrice?: number; price?: number; quantity: number; notes?: string }) => {
        const itemPrice = Number(i.unitPrice ?? i.price ?? 0);
        return `[ ] ${i.quantity}x ${i.name.toUpperCase()}\n    R$ ${(i.quantity * itemPrice).toFixed(2)} ${i.notes ? `(OBS: ${i.notes})` : ''}`;
      })
      .join('\n----------------------------------------\n');

    const formattedContent = `
========================================
    3EATCRU OS - DELIVERY / MARKETPLACE
           TICKET DE EXPEDIÇÃO
========================================
PEDIDO: #${order.id.slice(-8).toUpperCase()}
CLIENTE: ${order.customerName.toUpperCase()}
WHATSAPP: ${order.customerPhone || 'N/A'}
ENDEREÇO: ${order.customerAddress || 'Retirada no Balcão'}
HORA DO PEDIDO: ${dateStr}
PAGAMENTO: ${order.paymentMethod || 'PIX'}
----------------------------------------
ITENS DO PEDIDO:
----------------------------------------
${itemsText}
----------------------------------------
TOTAL A PAGAR:           R$ ${Number(order.total || 0).toFixed(2)}
========================================
OBRIGADO PELA PREFERÊNCIA!
    `;

    try {
      await this.os.print(`Delivery #${order.id.slice(-6)}`, formattedContent);
      this.feedbackMessage.set(`Ticket de Delivery #${order.id.slice(-6)} impresso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na impressora';
      this.feedbackMessage.set(`Atenção: ${msg}.`);
    }
  }

  private async printFiscalBill(table: DiningTable, total: number, saleId: string, paymentMethod: string) {
    const companyName = this.os.companyName;
    const dateStr = new Date().toLocaleString('pt-BR');

    const formattedContent = `
========================================
       3EATCRU OS - CUPOM FISCAL
========================================
EMPRESA: ${companyName.toUpperCase()}
MESA: #${table.number} - ${table.name}
VENDA ID: #${saleId.substring(0, 10)}
DATA/HORA: ${dateStr}
PAGAMENTO: ${paymentMethod}
----------------------------------------
VALOR TOTAL PAGO:        R$ ${total.toFixed(2)}
========================================
MESA LIBERADA COM SUCESSO.
OBRIGADO PELA PREFERÊNCIA!
    `;

    try {
      await this.os.print(`Cupom Fiscal Mesa #${table.number}`, formattedContent);
    } catch (err) {
      console.error('Falha ao imprimir cupom fiscal:', err);
    }
  }
}

