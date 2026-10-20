/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TableOrder, OrderItemStatus } from '../../domain/table.entity';

export interface TableKitchenOrder {
  tableNumber: number;
  tableName: string;
  order: TableOrder;
}

@Component({
  selector: 'app-kds-display',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="flex-1 overflow-y-auto p-6 space-y-4">
      
      <!-- KDS Header & Filter Segment -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <mat-icon class="text-xl">soup_kitchen</mat-icon>
          </div>
          <div>
            <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Fila de Produção Integrada (KDS)</h3>
            <p class="text-[11px] text-slate-500">Controle unificado de comandas de salão e pedidos online do Marketplace.</p>
          </div>
        </div>

        <!-- Filter tabs: Salão vs Online -->
        <div class="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start md:self-auto">
          <button 
            (click)="filterCategory.set('ALL')"
            [class.bg-white]="filterCategory() === 'ALL'"
            [class.shadow-sm]="filterCategory() === 'ALL'"
            [class.text-indigo-700]="filterCategory() === 'ALL'"
            class="px-2.5 py-1 text-xs font-bold rounded-md text-slate-600 transition-all cursor-pointer">
            Todos ({{ kitchenOrders().length + onlineOrders().length }})
          </button>
          <button 
            (click)="filterCategory.set('SALON')"
            [class.bg-white]="filterCategory() === 'SALON'"
            [class.shadow-sm]="filterCategory() === 'SALON'"
            [class.text-indigo-700]="filterCategory() === 'SALON'"
            class="px-2.5 py-1 text-xs font-bold rounded-md text-slate-600 transition-all cursor-pointer flex items-center gap-1">
            <mat-icon class="text-xs">table_restaurant</mat-icon>
            Salão ({{ kitchenOrders().length }})
          </button>
          <button 
            (click)="filterCategory.set('ONLINE')"
            [class.bg-white]="filterCategory() === 'ONLINE'"
            [class.shadow-sm]="filterCategory() === 'ONLINE'"
            [class.text-indigo-700]="filterCategory() === 'ONLINE'"
            class="px-2.5 py-1 text-xs font-bold rounded-md text-slate-600 transition-all cursor-pointer flex items-center gap-1">
            <mat-icon class="text-xs">delivery_dining</mat-icon>
            Marketplace / Online ({{ onlineOrders().length }})
            @if (pendingOnlineCount() > 0) {
              <span class="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] flex items-center justify-center font-bold">
                {{ pendingOnlineCount() }}
              </span>
            }
          </button>
        </div>
      </div>

      @if (kitchenOrders().length === 0 && onlineOrders().length === 0) {
        <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2 shadow-sm">
          <mat-icon class="text-4xl text-slate-300">done_all</mat-icon>
          <h4 class="text-sm font-bold text-slate-600">Cozinha em Dia!</h4>
          <p class="text-xs">Nenhum pedido pendente ou em preparo no momento.</p>
        </div>
      }

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        <!-- SECTION 1: Online / Delivery Orders (Marketplace) -->
        @if (filterCategory() === 'ALL' || filterCategory() === 'ONLINE') {
          @for (oOrder of onlineOrders(); track oOrder.id) {
            <div class="bg-white rounded-2xl border-2 border-indigo-500/30 shadow-md overflow-hidden flex flex-col justify-between">
              
              <!-- Online Card Header -->
              <div class="p-3.5 bg-gradient-to-r from-indigo-950 to-slate-900 text-white flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-7 h-7 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                    <mat-icon class="text-xs">delivery_dining</mat-icon>
                  </span>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <h4 class="text-xs font-bold leading-tight">{{ oOrder.customerName }}</h4>
                      <span class="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[9px] font-bold uppercase">
                        {{ oOrder.paymentMethod || 'PIX' }}
                      </span>
                    </div>
                    <span class="text-[10px] text-slate-300 font-mono">#{{ oOrder.id.slice(-6) }}</span>
                  </div>
                </div>
                
                <button 
                  (click)="printOnlineTicket.emit(oOrder)"
                  class="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                  title="Imprimir comanda de delivery">
                  <mat-icon class="text-xs">print</mat-icon> Ticket
                </button>
              </div>

              <!-- Online Items list -->
              <div class="p-4 divide-y divide-slate-100 flex-1 space-y-2">
                @for (item of oOrder.items; track item.name) {
                  <div class="pt-2 first:pt-0 flex items-start justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        <span class="font-mono text-emerald-600">{{ item.quantity }}x</span>
                        {{ item.name }}
                      </div>
                      @if (item.notes) {
                        <p class="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-0.5 font-medium inline-block">
                          Obs: {{ item.notes }}
                        </p>
                      }
                    </div>
                    <span class="text-xs font-bold text-slate-600 font-mono">
                      R$ {{ (((item.unitPrice ?? item.price) || 0) * item.quantity) | number:'1.2-2' }}
                    </span>
                  </div>
                }

                @if (oOrder.customerAddress) {
                  <div class="pt-2 text-[11px] text-slate-600 flex items-start gap-1">
                    <mat-icon class="text-xs text-slate-400 mt-0.5">location_on</mat-icon>
                    <span>{{ oOrder.customerAddress }}</span>
                  </div>
                }
              </div>

              <!-- Status Action Control -->
              <div class="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <span class="text-[10px] font-mono text-slate-500">
                  {{ oOrder.createdAt | date:'HH:mm' }} • Total: R$ {{ oOrder.total | number:'1.2-2' }}
                </span>

                <div>
                  @if (oOrder.status === 'RECEIVED') {
                    <button 
                      (click)="updateOnlineStatus.emit({ orderId: oOrder.id, status: 'PREPARING' })"
                      class="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer">
                      <mat-icon class="text-xs">outdoor_grill</mat-icon> Iniciar Preparo
                    </button>
                  } @else if (oOrder.status === 'PREPARING') {
                    <button 
                      (click)="updateOnlineStatus.emit({ orderId: oOrder.id, status: 'READY' })"
                      class="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer">
                      <mat-icon class="text-xs">check_circle</mat-icon> Marcar Pronto
                    </button>
                  } @else if (oOrder.status === 'READY') {
                    <button 
                      (click)="updateOnlineStatus.emit({ orderId: oOrder.id, status: 'DELIVERING' })"
                      class="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer">
                      <mat-icon class="text-xs">two_wheeler</mat-icon> Despachar
                    </button>
                  } @else {
                    <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                      <mat-icon class="text-xs">done_all</mat-icon> {{ oOrder.status }}
                    </span>
                  }
                </div>
              </div>

            </div>
          }
        }

        <!-- SECTION 2: Dine-in Table Orders -->
        @if (filterCategory() === 'ALL' || filterCategory() === 'SALON') {
          @for (kOrder of kitchenOrders(); track kOrder.order.id) {
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              
              <!-- Order Card Header -->
              <div class="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-7 h-7 rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                    #{{ kOrder.tableNumber }}
                  </span>
                  <div>
                    <h4 class="text-xs font-bold leading-tight">{{ kOrder.tableName }}</h4>
                    <span class="text-[10px] text-slate-400">{{ kOrder.order.waiterName }}</span>
                  </div>
                </div>
                
                <button 
                  (click)="printTicket.emit(kOrder)"
                  class="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                  title="Imprimir comanda de cozinha">
                  <mat-icon class="text-xs">print</mat-icon> Ticket
                </button>
              </div>

              <!-- Order Items list with status controls -->
              <div class="p-4 divide-y divide-slate-100 flex-1 space-y-2">
                @for (item of kOrder.order.items; track item.id) {
                  <div class="pt-2 first:pt-0 flex items-start justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        <span class="font-mono text-indigo-600">{{ item.quantity }}x</span>
                        {{ item.name }}
                      </div>
                      @if (item.notes) {
                        <p class="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-0.5 font-medium inline-block">
                          Obs: {{ item.notes }}
                        </p>
                      }
                    </div>

                    <!-- Status Transition Button -->
                    <div class="shrink-0 flex items-center">
                      @if (item.status === 'PENDING_KITCHEN') {
                        <button 
                          (click)="changeStatus(kOrder.order.tableId, item.id, 'IN_PREPARATION')"
                          class="bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer">
                          <mat-icon class="text-[12px]">outdoor_grill</mat-icon> Preparar
                        </button>
                      } @else if (item.status === 'IN_PREPARATION') {
                        <button 
                          (click)="changeStatus(kOrder.order.tableId, item.id, 'READY')"
                          class="bg-blue-100 hover:bg-blue-200 text-blue-900 text-[10px] font-bold px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer">
                          <mat-icon class="text-[12px]">check</mat-icon> Pronto
                        </button>
                      } @else if (item.status === 'READY') {
                        <button 
                          (click)="changeStatus(kOrder.order.tableId, item.id, 'SERVED')"
                          class="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-bold px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer">
                          <mat-icon class="text-[12px]">done_all</mat-icon> Servir
                        </button>
                      } @else {
                        <span class="text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
                          <mat-icon class="text-[12px] text-emerald-600">check_circle</mat-icon> Entregue
                        </span>
                      }
                    </div>
                  </div>
                }
              </div>

              <!-- Footer -->
              <div class="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-mono flex items-center justify-between">
                <span>Aberto às {{ kOrder.order.openedAt | date:'HH:mm' }}</span>
                <span class="font-bold text-slate-600">{{ kOrder.order.items.length }} preparações</span>
              </div>

            </div>
          }
        }

      </div>
    </div>
  `
})
export class KdsDisplayComponent {
  kitchenOrders = input<TableKitchenOrder[]>([]);
  onlineOrders = input<any[]>([]);

  updateItemStatus = output<{ tableId: string; itemId: string; status: OrderItemStatus }>();
  updateOnlineStatus = output<{ orderId: string; status: string }>();
  printTicket = output<TableKitchenOrder>();
  printOnlineTicket = output<any>();

  filterCategory = signal<'ALL' | 'SALON' | 'ONLINE'>('ALL');

  pendingOnlineCount = computed(() => this.onlineOrders().filter(o => o.status === 'PENDING' || o.status === 'RECEIVED').length);

  changeStatus(tableId: string, itemId: string, status: OrderItemStatus) {
    this.updateItemStatus.emit({ tableId, itemId, status });
  }
}

