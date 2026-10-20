import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface IfoodOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  items: { name: string; quantity: number; notes?: string; price: number }[];
  total: number;
  paymentMethod: 'ONLINE_PAID' | 'PAY_ON_DELIVERY';
  status: 'PLACED' | 'CONFIRMED' | 'PREPARING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  estimatedDeliveryTime: string;
  createdAt: string;
}

@Component({
  selector: 'app-ifood-orders-feed',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h4 class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <mat-icon class="text-rose-400 text-base">receipt</mat-icon>
            Central de Pedidos iFood em Tempo Real
          </h4>
          <p class="text-xs text-slate-400 mt-0.5">Fluxo de pedidos recebidos via Webhook Polling e integrados à impressora fiscal.</p>
        </div>

        <!-- Simulate incoming order button -->
        <button 
          type="button"
          (click)="simulateIncomingOrder.emit()"
          class="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-rose-900/20 self-start sm:self-auto">
          <mat-icon class="text-sm">add_alert</mat-icon> Simular Chegada de Pedido
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (order of orders(); track order.id) {
          <div class="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
            
            <div class="space-y-3">
              <!-- Top bar -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm font-black text-white font-mono">#{{ order.orderNumber }}</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                    [class.bg-amber-500/10]="order.status === 'PLACED'"
                    [class.text-amber-400]="order.status === 'PLACED'"
                    [class.border]="true"
                    [class.border-amber-500/20]="order.status === 'PLACED'"
                    [class.bg-sky-500/10]="order.status === 'CONFIRMED' || order.status === 'PREPARING'"
                    [class.text-sky-400]="order.status === 'CONFIRMED' || order.status === 'PREPARING'"
                    [class.border-sky-500/20]="order.status === 'CONFIRMED' || order.status === 'PREPARING'"
                    [class.bg-emerald-500/10]="order.status === 'DISPATCHED' || order.status === 'DELIVERED'"
                    [class.text-emerald-400]="order.status === 'DISPATCHED' || order.status === 'DELIVERED'"
                    [class.border-emerald-500/20]="order.status === 'DISPATCHED' || order.status === 'DELIVERED'">
                    {{ order.status }}
                  </span>
                </div>
                <span class="text-[10px] font-mono text-slate-500">{{ order.createdAt | date:'shortTime' }}</span>
              </div>

              <!-- Customer Info -->
              <div class="space-y-0.5">
                <h5 class="text-xs font-bold text-slate-200">{{ order.customerName }}</h5>
                <p class="text-[11px] text-slate-400 truncate">{{ order.deliveryAddress }}</p>
              </div>

              <!-- Items List -->
              <div class="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60 space-y-1.5 text-xs">
                @for (item of order.items; track item.name) {
                  <div class="flex justify-between items-center text-slate-300">
                    <span>{{ item.quantity }}x {{ item.name }}</span>
                    <span class="font-mono text-slate-400">R$ {{ (item.price * item.quantity) | number:'1.2-2' }}</span>
                  </div>
                }
              </div>

              <!-- Payment & Total -->
              <div class="flex justify-between items-center text-xs pt-1">
                <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  {{ order.paymentMethod === 'ONLINE_PAID' ? '💳 PAGO NO APP' : '💵 PAGAR NA ENTREGA' }}
                </span>
                <span class="text-sm font-black text-white font-mono">
                  R$ {{ order.total | number:'1.2-2' }}
                </span>
              </div>
            </div>

            <!-- Action buttons per status -->
            <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
              @if (order.status === 'PLACED') {
                <button 
                  type="button"
                  (click)="confirmOrder.emit(order.id)"
                  class="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-rose-900/20">
                  <mat-icon class="text-xs">check</mat-icon> Confirmar & Enviar p/ Cozinha
                </button>
              } @else if (order.status === 'CONFIRMED' || order.status === 'PREPARING') {
                <button 
                  type="button"
                  (click)="dispatchOrder.emit(order.id)"
                  class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/20">
                  <mat-icon class="text-xs">two_wheeler</mat-icon> Despachar com Entregador
                </button>
              } @else {
                <div class="w-full py-2 bg-slate-900 text-emerald-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                  <mat-icon class="text-xs">task_alt</mat-icon> Pedido Finalizado
                </div>
              }
            </div>

          </div>
        }
        @if (orders().length === 0) {
          <div class="text-center py-12 text-slate-500 text-xs col-span-3">Nenhum pedido ativo no momento.</div>
        }
      </div>
    </div>
  `
})
export class IfoodOrdersFeedComponent {
  orders = input.required<IfoodOrder[]>();
  simulateIncomingOrder = output<void>();
  confirmOrder = output<string>();
  dispatchOrder = output<string>();
}
