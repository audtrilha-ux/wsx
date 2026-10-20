/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, ChangeDetectionStrategy, signal, inject, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { IfoodStoreStatusComponent } from './components/ifood-store-status.component';
import { IfoodOrdersFeedComponent, IfoodOrder } from './components/ifood-orders-feed.component';
import { OsSdkService } from '../../sdk/os-sdk.service';
import { OsContext } from '../../contracts/os/os-context.contract';
import { LinuxThemeService } from '../../core/theme/linux-theme.service';

@Component({
  selector: 'app-ifood-integration',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    IfoodStoreStatusComponent,
    IfoodOrdersFeedComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="themeService.isDeskTheme() 
      ? 'h-full bg-[#faf8f2] text-[#2c1e15] p-6 overflow-y-auto space-y-6 font-sans' 
      : 'h-full bg-slate-950 text-slate-100 p-6 overflow-y-auto space-y-6 font-sans'">
      <!-- Header -->
      <div [class]="themeService.isDeskTheme()
        ? 'flex items-center justify-between border-b border-amber-600/20 pb-5'
        : 'flex items-center justify-between border-b border-slate-800 pb-5'">
        <div class="flex items-center gap-3">
          <div [class]="themeService.isDeskTheme()
            ? 'w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700'
            : 'w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500'">
            <mat-icon class="text-2xl">delivery_dining</mat-icon>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 [class]="themeService.isDeskTheme()
                ? 'text-lg font-black text-[#2c1e15] uppercase tracking-wider'
                : 'text-lg font-black text-white uppercase tracking-wider'">iFood Delivery Hub</h2>
              <span [class]="themeService.isDeskTheme()
                ? 'text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 border border-amber-500/30'
                : 'text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'">
                ACTIVE INTEGRATION
              </span>
            </div>
            <p [class]="themeService.isDeskTheme() ? 'text-xs text-amber-900/70 mt-0.5' : 'text-xs text-slate-400 mt-0.5'">Recepção de pedidos externos para {{ app.companyName }} integrados ao KDS e impressora.</p>
          </div>
        </div>
 
        <div class="text-right hidden sm:block">
          <span [class]="themeService.isDeskTheme() ? 'text-[10px] text-amber-900/60 uppercase font-bold tracking-wider block' : 'text-[10px] text-slate-500 uppercase font-bold tracking-wider block'">INTEGRAÇÃO COZINHA</span>
          <span [class]="themeService.isDeskTheme() ? 'text-xs font-black text-amber-700 font-mono' : 'text-xs font-black text-emerald-400 font-mono'">KDS & IMPRESSÃO AUTO</span>
        </div>
      </div>
 
      <!-- 1. Store Online/Offline Toggle -->
      <app-ifood-store-status
        [isOpen]="isOpen()"
        [merchantId]="merchantId()"
        (toggleStoreStatus)="handleToggleStoreStatus()" />

      <!-- 2. Orders Realtime Board -->
      <app-ifood-orders-feed
        [orders]="orders()"
        (simulateIncomingOrder)="handleSimulateOrder()"
        (confirmOrder)="handleConfirmOrder($event)"
        (dispatchOrder)="handleDispatchOrder($event)" />
    </div>
  `
})
export class Ifood implements OnInit, OnDestroy {
  private sdk = inject(OsSdkService);
  themeService = inject(LinuxThemeService);

  app: OsContext = this.sdk.bind('app_ifood');

  isOpen = signal<boolean>(true);
  merchantId = computed(() => String(this.app.config.get('ifood_sandbox_id') || 'IF-982834'));

  orders = signal<IfoodOrder[]>([]);
  private osSubs: { unsubscribe: () => void }[] = [];

  ngOnInit() {
    this.loadData();

    // Subscribe to events through App Context so we are decoupled from OsEventBusService
    this.osSubs.push(
      this.app.events.subscribe('marketplace.order_created', () => {
        this.loadData();
      })
    );

    this.osSubs.push(
      this.app.events.subscribe('marketplace.order_status_updated', () => {
        this.loadData();
      })
    );
  }

  ngOnDestroy() {
    this.osSubs.forEach(s => s.unsubscribe());
  }

  async loadData() {
    const companyId = this.app.companyId;
    try {
      const res = await this.app.network.http.get<any[]>(`/companies/${companyId}/orders`);
      // Map and filter only iFood orders
      const ifoodList = (res || [])
        .filter(o => o.channel === 'IFOOD')
        .map(o => this.mapPublicOrderToIfoodOrder(o));
      this.orders.set(ifoodList);
    } catch (err) {
      console.error('Erro ao carregar pedidos iFood:', err);
    }
  }

  private mapPublicOrderToIfoodOrder(o: any): IfoodOrder {
    let ifoodStatus: IfoodOrder['status'] = 'PLACED';
    if (o.status === 'PREPARING') ifoodStatus = 'PREPARING';
    else if (o.status === 'READY') ifoodStatus = 'CONFIRMED';
    else if (o.status === 'DELIVERING') ifoodStatus = 'DISPATCHED';
    else if (o.status === 'COMPLETED') ifoodStatus = 'DELIVERED';
    else if (o.status === 'CANCELLED') ifoodStatus = 'CANCELLED';

    return {
      id: o.id,
      orderNumber: o.id.slice(-4).toUpperCase(),
      customerName: o.customerName,
      customerPhone: o.customerPhone || '(11) 99999-0000',
      deliveryAddress: o.customerAddress || 'Retirada na Loja',
      items: (o.items || []).map((it: any) => ({
        name: it.name,
        quantity: it.quantity,
        price: it.unitPrice || it.price || 0,
        notes: it.notes
      })),
      total: o.total,
      paymentMethod: o.paymentMethod === 'ONLINE_PAID' || o.paymentMethod === 'CARTAO_CREDITO' ? 'ONLINE_PAID' : 'PAY_ON_DELIVERY',
      status: ifoodStatus,
      estimatedDeliveryTime: o.status === 'COMPLETED' ? 'Concluído' : '30-40 min',
      createdAt: o.createdAt
    };
  }

  handleToggleStoreStatus() {
    this.isOpen.update(v => !v);
    const msg = this.isOpen() ? 'Loja aberta no iFood e pronta para receber pedidos.' : 'Loja fechada temporariamente no iFood.';
    this.app.notify('Status iFood', msg, this.isOpen() ? 'info' : 'warning');
  }

  async handleSimulateOrder() {
    const companyId = this.app.companyId;
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const mockOrderPayload = {
      companyId,
      customerName: `Cliente iFood #${randomNum}`,
      customerPhone: '(11) 98123-4567',
      customerAddress: 'Rua Augusta, 1200 - Apto 54',
      items: [
        { name: 'Smash Bacon Supreme', quantity: 1, price: 38.00 },
        { name: 'Suco Natural de Laranja', quantity: 1, price: 12.00 }
      ],
      notes: 'Enviar maionese extra',
      paymentMethod: 'ONLINE_PAID',
      channel: 'IFOOD'
    };

    try {
      const res = await this.app.network.http.post<{ success: boolean; order: any }>('/public-space/orders', mockOrderPayload);
      this.app.notify('Novo Pedido iFood!', `Pedido #${res.order.id.slice(-4).toUpperCase()} recebido com sucesso (R$ 50,00).`, 'info');
      // Publish event to EventBus via SDK Context
      this.app.events.publish('marketplace.order_created', { orderId: res.order.id }, 'app_ifood');
      this.loadData();
    } catch (err) {
      console.error('Erro ao simular pedido iFood:', err);
      this.app.notify('Erro iFood', 'Falha ao conectar com o sandbox iFood.', 'warning');
    }
  }

  async handleConfirmOrder(orderId: string) {
    const order = this.orders().find(o => o.id === orderId);
    if (!order) return;

    try {
      await this.app.network.http.patch<{ success: boolean }>(`/public-space/orders/${orderId}/status`, { status: 'PREPARING' });
      // Auto print thermal order ticket for the kitchen via OS Context
      const receiptContent = `
========================================
           IFOOD DELIVERY # ${order.orderNumber}
========================================
Cliente: ${order.customerName}
Telefone: ${order.customerPhone}
Endereço: ${order.deliveryAddress}
----------------------------------------
ITENS PARA PREPARO:
${order.items.map(i => `${i.quantity}x ${i.name}`).join('\n')}
----------------------------------------
TOTAL: R$ ${order.total.toFixed(2)}
Pagamento: ${order.paymentMethod === 'ONLINE_PAID' ? '💳 PAGO NO APP' : '💵 PAGAR NA ENTREGA'}
========================================
        ENVIADO AO KDS DE COZINHA
========================================
      `;

      this.app.print(`COMANDA iFOOD #${order.orderNumber}`, receiptContent);
      this.app.notify('iFood Confirmado', `Pedido #${order.orderNumber} confirmado e impresso na comanda da cozinha!`, 'success');
      
      // Notify other apps of the status transition via SDK Context
      this.app.events.publish('marketplace.order_status_updated', { orderId, status: 'PREPARING' }, 'app_ifood');
      this.loadData();
    } catch (err) {
      console.error('Erro ao confirmar pedido iFood:', err);
      this.app.notify('Erro iFood', 'Falha ao confirmar pedido.', 'warning');
    }
  }

  async handleDispatchOrder(orderId: string) {
    const order = this.orders().find(o => o.id === orderId);
    if (!order) return;

    try {
      await this.app.network.http.patch<{ success: boolean }>(`/public-space/orders/${orderId}/status`, { status: 'DELIVERING' });
      this.app.notify('iFood Despachado', `Pedido #${order.orderNumber} saiu com o entregador parceiro!`, 'info');
      
      // Notify other apps of status transition via SDK Context
      this.app.events.publish('marketplace.order_status_updated', { orderId, status: 'DELIVERING' }, 'app_ifood');
      this.loadData();
    } catch (err) {
      console.error('Erro ao despachar pedido iFood:', err);
      this.app.notify('Erro iFood', 'Falha ao despachar pedido.', 'warning');
    }
  }
}
