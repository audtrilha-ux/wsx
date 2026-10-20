/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HqApiClient } from '../../../../core/api/api-client';
import { firstValueFrom } from 'rxjs';

export interface MarketplaceStoreSummary {
  companyId: string;
  companyName: string;
  companySlug: string;
  companyStatus: string;
  spaceStatus: string;
  title: string;
  category: string;
  templateId: string;
  logo: string;
  phone: string;
  address: string;
  hours: string;
  productsCount: number;
  publishedAt: string | null;
  ordersCount: number;
  gmv: number;
}

export interface MarketplaceOrderSummary {
  id: string;
  publicTrackingToken?: string;
  customerAccountId?: string;
  companyId: string;
  companyName: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: { name: string; quantity: number; unitPrice: number; productId?: string }[];
  total: number;
  notes?: string;
  paymentMethod: string;
  status: 'RECEIVED' | 'PREPARING' | 'READY' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED';
  channel: 'MARKETPLACE' | 'DIRECT' | 'IFOOD';
  createdAt: string;
}

@Component({
  selector: 'app-hq-marketplace',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      
      <!-- Top Title and Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-900/40 pb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg desk-brass-plate flex items-center justify-center text-amber-950 font-bold shadow-md border border-amber-300/40">
            <mat-icon class="text-xl">storefront</mat-icon>
          </div>
          <div>
            <h2 class="text-lg font-bold text-amber-100 font-serif tracking-tight">Governança do Fichário Comercial</h2>
            <p class="text-xs text-amber-300/70 font-mono">Controle central de vitrines públicas, moderação de lojas e pedidos omnicanal</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button 
            (click)="loadOverview()" 
            class="px-3 py-1.5 desk-brass-button text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer">
            <mat-icon class="text-sm">refresh</mat-icon>
            Atualizar Dados
          </button>
        </div>
      </div>

      <!-- Navigation Tabs (Skeuomorphic Brass Strips) -->
      <div class="flex gap-2 border-b border-amber-900/50 pb-2">
        <button 
          (click)="activeTab.set('overview')" 
          [class.desk-brass-plate]="activeTab() === 'overview'"
          [class.!text-amber-950]="activeTab() === 'overview'"
          [class.font-bold]="activeTab() === 'overview'"
          class="px-4 py-2 rounded text-xs font-mono tracking-wider transition-colors text-amber-200 hover:bg-amber-950/40 flex items-center gap-2">
          <mat-icon class="text-sm">analytics</mat-icon>
          INDICADORES GERAIS
        </button>

        <button 
          (click)="activeTab.set('stores')" 
          [class.desk-brass-plate]="activeTab() === 'stores'"
          [class.!text-amber-950]="activeTab() === 'stores'"
          [class.font-bold]="activeTab() === 'stores'"
          class="px-4 py-2 rounded text-xs font-mono tracking-wider transition-colors text-amber-200 hover:bg-amber-950/40 flex items-center gap-2">
          <mat-icon class="text-sm">store</mat-icon>
          VITRINES & MODERAÇÃO ({{ stores().length }})
        </button>

        <button 
          (click)="activeTab.set('orders')" 
          [class.desk-brass-plate]="activeTab() === 'orders'"
          [class.!text-amber-950]="activeTab() === 'orders'"
          [class.font-bold]="activeTab() === 'orders'"
          class="px-4 py-2 rounded text-xs font-mono tracking-wider transition-colors text-amber-200 hover:bg-amber-950/40 flex items-center gap-2">
          <mat-icon class="text-sm">receipt_long</mat-icon>
          MONITOR DE PEDIDOS ({{ orders().length }})
        </button>
      </div>

      <!-- TAB 1: OVERVIEW & BI -->
      @if (activeTab() === 'overview') {
        <div class="space-y-6">
          <!-- Metric Cards Grid -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <!-- GMV Marketplace -->
            <div class="bg-amber-950/40 border border-amber-700/40 rounded-xl p-5 shadow-inner">
              <div class="flex items-center gap-2 text-amber-400 mb-2">
                <mat-icon class="text-lg">paid</mat-icon>
                <span class="text-xs font-bold uppercase font-mono tracking-wider">GMV Marketplace</span>
              </div>
              <div class="text-2xl font-black text-white font-mono tabular-nums">
                {{ stats().totalGmv | currency:'BRL':'symbol':'1.2-2' }}
              </div>
              <p class="text-[10px] text-amber-300/60 mt-2 font-mono">Volume transacionado no canal online</p>
            </div>

            <!-- Total de Pedidos Online -->
            <div class="bg-indigo-950/40 border border-indigo-700/40 rounded-xl p-5 shadow-inner">
              <div class="flex items-center gap-2 text-indigo-400 mb-2">
                <mat-icon class="text-lg">shopping_cart</mat-icon>
                <span class="text-xs font-bold uppercase font-mono tracking-wider">Pedidos Online</span>
              </div>
              <div class="text-2xl font-black text-white font-mono tabular-nums">
                {{ stats().totalOrders }}
              </div>
              <p class="text-[10px] text-indigo-300/60 mt-2 font-mono">{{ stats().activeOrders }} em preparo/entrega</p>
            </div>

            <!-- Vitrines Publicadas -->
            <div class="bg-emerald-950/40 border border-emerald-700/40 rounded-xl p-5 shadow-inner">
              <div class="flex items-center gap-2 text-emerald-400 mb-2">
                <mat-icon class="text-lg">storefront</mat-icon>
                <span class="text-xs font-bold uppercase font-mono tracking-wider">Vitrines no Ar</span>
              </div>
              <div class="text-2xl font-black text-white font-mono tabular-nums">
                {{ stats().publishedStores }} / {{ stats().totalCompanies }}
              </div>
              <p class="text-[10px] text-emerald-300/60 mt-2 font-mono">{{ stats().draftStores }} em elaboração ou rascunho</p>
            </div>

            <!-- Ticket Médio Online -->
            <div class="bg-stone-900 border border-amber-900/50 rounded-xl p-5 shadow-inner">
              <div class="flex items-center gap-2 text-amber-400 mb-2">
                <mat-icon class="text-lg">calculate</mat-icon>
                <span class="text-xs font-bold uppercase font-mono tracking-wider">Ticket Médio</span>
              </div>
              <div class="text-2xl font-black text-white font-mono tabular-nums">
                {{ stats().averageTicket | currency:'BRL':'symbol':'1.2-2' }}
              </div>
              <p class="text-[10px] text-amber-300/60 mt-2 font-mono">{{ stats().totalProductsListed }} produtos cadastrados</p>
            </div>
          </div>

          <!-- Channel and Status Breakdown -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Status dos Pedidos -->
            <div class="bg-[#17100b] border border-amber-900/50 rounded-xl p-5 shadow-md">
              <h4 class="text-xs font-bold text-amber-100 uppercase tracking-wider font-mono border-b border-amber-900/40 pb-2.5 flex items-center justify-between">
                <span>Distribuição por Status de Atendimento</span>
                <span class="text-amber-400">{{ stats().totalOrders }} Pedidos</span>
              </h4>
              <div class="mt-4 space-y-2.5 text-xs font-mono">
                <div class="flex justify-between items-center py-1 border-b border-amber-950">
                  <span class="text-amber-300/80 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-blue-500"></span> Recebidos (Na Fila)
                  </span>
                  <span class="font-bold text-white tabular-nums">{{ stats().ordersByStatus?.['RECEIVED'] || 0 }}</span>
                </div>
                <div class="flex justify-between items-center py-1 border-b border-amber-950">
                  <span class="text-amber-300/80 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-amber-500"></span> Em Preparo (Cozinha/KDS)
                  </span>
                  <span class="font-bold text-white tabular-nums">{{ stats().ordersByStatus?.['PREPARING'] || 0 }}</span>
                </div>
                <div class="flex justify-between items-center py-1 border-b border-amber-950">
                  <span class="text-amber-300/80 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-indigo-500"></span> Prontos para Retirada
                  </span>
                  <span class="font-bold text-white tabular-nums">{{ stats().ordersByStatus?.['READY'] || 0 }}</span>
                </div>
                <div class="flex justify-between items-center py-1 border-b border-amber-950">
                  <span class="text-amber-300/80 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-purple-500"></span> Saiu para Entrega
                  </span>
                  <span class="font-bold text-white tabular-nums">{{ stats().ordersByStatus?.['DELIVERING'] || 0 }}</span>
                </div>
                <div class="flex justify-between items-center py-1 border-b border-amber-950">
                  <span class="text-amber-300/80 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Concluídos com Sucesso
                  </span>
                  <span class="font-bold text-emerald-400 tabular-nums">{{ stats().ordersByStatus?.['COMPLETED'] || 0 }}</span>
                </div>
                <div class="flex justify-between items-center py-1">
                  <span class="text-amber-300/80 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-rose-500"></span> Cancelados / Estornados
                  </span>
                  <span class="font-bold text-rose-400 tabular-nums">{{ stats().ordersByStatus?.['CANCELLED'] || 0 }}</span>
                </div>
              </div>
            </div>

            <!-- Origem por Canal -->
            <div class="bg-[#17100b] border border-amber-900/50 rounded-xl p-5 shadow-md">
              <h4 class="text-xs font-bold text-amber-100 uppercase tracking-wider font-mono border-b border-amber-900/40 pb-2.5 flex items-center justify-between">
                <span>Canais de Entrada Omnicanal</span>
                <span class="text-amber-400">Origens</span>
              </h4>
              <div class="mt-4 space-y-3 text-xs font-mono">
                <div class="bg-amber-950/30 border border-amber-900/40 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <span class="text-amber-200 font-bold block">Fichário Comercial 3eatcru</span>
                    <span class="text-[10px] text-amber-300/60">Catálogo público descentralizado</span>
                  </div>
                  <span class="text-base font-bold text-white tabular-nums">{{ stats().ordersByChannel?.['MARKETPLACE'] || 0 }} pedidos</span>
                </div>

                <div class="bg-amber-950/30 border border-amber-900/40 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <span class="text-amber-200 font-bold block">Canal Direto / Link da Loja</span>
                    <span class="text-[10px] text-amber-300/60">Acesso via slug direto da empresa</span>
                  </div>
                  <span class="text-base font-bold text-white tabular-nums">{{ stats().ordersByChannel?.['DIRECT'] || 0 }} pedidos</span>
                </div>

                <div class="bg-amber-950/30 border border-amber-900/40 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <span class="text-amber-200 font-bold block">Integração iFood Hub</span>
                    <span class="text-[10px] text-amber-300/60">Conector externo homologado</span>
                  </div>
                  <span class="text-base font-bold text-white tabular-nums">{{ stats().ordersByChannel?.['IFOOD'] || 0 }} pedidos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- TAB 2: STORES & MODERATION -->
      @if (activeTab() === 'stores') {
        <div class="bg-[#17100b] border border-amber-900/50 rounded-xl p-5 shadow-md space-y-4">
          <div class="flex justify-between items-center border-b border-amber-900/40 pb-3">
            <div>
              <h3 class="text-sm font-bold text-amber-100 font-serif">Vitrines Cadastradas na Plataforma</h3>
              <p class="text-xs text-amber-300/70 font-mono">Supervisão de conformidade de catálogos e moderação pública</p>
            </div>
            <div class="text-xs font-mono text-amber-400">
              {{ stores().length }} estabelecimentos catalogados
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs font-sans">
              <thead class="bg-[#241710] text-amber-300/70 uppercase font-mono text-[10px] border-b border-amber-900/50">
                <tr>
                  <th class="py-2.5 px-3">Empresa & Vitrine</th>
                  <th class="py-2.5 px-3">Categoria</th>
                  <th class="py-2.5 px-3">Endereço / Contato</th>
                  <th class="py-2.5 px-3 text-center">Itens</th>
                  <th class="py-2.5 px-3 text-center">Pedidos</th>
                  <th class="py-2.5 px-3 text-right">GMV Online</th>
                  <th class="py-2.5 px-3 text-center">Status</th>
                  <th class="py-2.5 px-3 text-right">Ações de Moderação</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-amber-950/60">
                @for (store of stores(); track store.companyId) {
                  <tr class="hover:bg-amber-950/20 transition-colors">
                    <td class="py-3 px-3">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded bg-amber-950/60 border border-amber-900/60 overflow-hidden flex items-center justify-center shrink-0">
                          @if (store.logo) {
                            <img [src]="store.logo" [alt]="store.title" class="w-full h-full object-cover" referrerpolicy="no-referrer">
                          } @else {
                            <mat-icon class="text-amber-500 text-sm">storefront</mat-icon>
                          }
                        </div>
                        <div>
                          <div class="font-bold text-white">{{ store.title }}</div>
                          <div class="text-[10px] text-amber-300/60 font-mono">{{ store.companyName }} ({{ store.companyId }})</div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 px-3 font-mono text-amber-300/80">
                      {{ store.category }}
                    </td>
                    <td class="py-3 px-3 text-[11px] text-slate-300 max-w-[200px] truncate">
                      {{ store.address || 'Sem endereço físico' }}
                    </td>
                    <td class="py-3 px-3 text-center font-mono tabular-nums text-amber-200">
                      {{ store.productsCount }}
                    </td>
                    <td class="py-3 px-3 text-center font-mono tabular-nums text-amber-200">
                      {{ store.ordersCount }}
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-bold tabular-nums text-emerald-400">
                      {{ store.gmv | currency:'BRL':'symbol':'1.2-2' }}
                    </td>
                    <td class="py-3 px-3 text-center">
                      @if (store.spaceStatus === 'published' && store.companyStatus === 'active') {
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          NO AR
                        </span>
                      } @else if (store.companyStatus === 'suspended') {
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40">
                          SUSPENSA HQ
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-900 text-stone-400 border border-stone-700">
                          RASCUNHO
                        </span>
                      }
                    </td>
                    <td class="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                      @if (store.spaceStatus === 'published') {
                        <button 
                          (click)="moderateStore(store.companyId, 'draft', 'Suspenso para revisão por auditoria HQ')" 
                          class="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-700/50 text-[10px] font-mono font-bold text-rose-300 transition-colors cursor-pointer"
                          title="Suspender publicação imediata desta vitrine no Marketplace">
                          Suspender
                        </button>
                      } @else {
                        <button 
                          (click)="moderateStore(store.companyId, 'publish', 'Aprovado e publicado pelo Superadmin HQ')" 
                          class="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/50 text-[10px] font-mono font-bold text-emerald-300 transition-colors cursor-pointer"
                          title="Publicar vitrine no Marketplace">
                          Publicar
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- TAB 3: LIVE ORDERS MONITOR -->
      @if (activeTab() === 'orders') {
        <div class="bg-[#17100b] border border-amber-900/50 rounded-xl p-5 shadow-md space-y-4">
          <div class="flex justify-between items-center border-b border-amber-900/40 pb-3">
            <div>
              <h3 class="text-sm font-bold text-amber-100 font-serif">Fluxo de Pedidos Online em Tempo Real</h3>
              <p class="text-xs text-amber-300/70 font-mono">Auditoria de transações originadas no Marketplace e canais digitais</p>
            </div>
            <div class="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              STREAM ATIVO
            </div>
          </div>

          <div class="space-y-3 max-h-[550px] overflow-y-auto pr-1">
            @for (order of orders(); track order.id) {
              <div class="bg-slate-950/80 border border-amber-900/40 rounded-lg p-4 hover:border-amber-700/60 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="space-y-1.5">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-amber-200 font-mono">#{{ order.id }}</span>
                    <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                      {{ order.channel }}
                    </span>
                    @if (order.customerAccountId) {
                      <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50 flex items-center gap-1">
                        <mat-icon class="text-[10px] w-2.5 h-2.5">verified_user</mat-icon> 3ID
                      </span>
                    }
                  </div>
                  <div class="text-xs font-bold text-white">{{ order.customerName }} <span class="text-slate-400 font-normal">({{ order.customerPhone || 'Sem telefone' }})</span></div>
                  <div class="text-[11px] text-amber-300/70 font-mono">{{ order.companyName }} • {{ order.items.length || 0 }} itens</div>
                  <div class="text-[10px] text-slate-400">{{ order.customerAddress || 'Retirada no balcão' }}</div>
                </div>

                <div class="flex flex-col md:items-end gap-2 shrink-0">
                  <div class="text-base font-black text-emerald-400 font-mono tabular-nums">
                    {{ order.total | currency:'BRL':'symbol':'1.2-2' }}
                  </div>
                  <div class="flex items-center gap-2">
                    <span 
                      class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border"
                      [class.bg-blue-950]="order.status === 'RECEIVED'"
                      [class.border-blue-500]="order.status === 'RECEIVED'"
                      [class.text-blue-300]="order.status === 'RECEIVED'"
                      [class.bg-amber-950]="order.status === 'PREPARING'"
                      [class.border-amber-500]="order.status === 'PREPARING'"
                      [class.text-amber-300]="order.status === 'PREPARING'"
                      [class.bg-indigo-950]="order.status === 'READY'"
                      [class.border-indigo-500]="order.status === 'READY'"
                      [class.text-indigo-300]="order.status === 'READY'"
                      [class.bg-purple-950]="order.status === 'DELIVERING'"
                      [class.border-purple-500]="order.status === 'DELIVERING'"
                      [class.text-purple-300]="order.status === 'DELIVERING'"
                      [class.bg-emerald-950]="order.status === 'COMPLETED'"
                      [class.border-emerald-500]="order.status === 'COMPLETED'"
                      [class.text-emerald-300]="order.status === 'COMPLETED'"
                      [class.bg-rose-950]="order.status === 'CANCELLED'"
                      [class.border-rose-500]="order.status === 'CANCELLED'"
                      [class.text-rose-300]="order.status === 'CANCELLED'">
                      {{ order.status }}
                    </span>
                  </div>
                  <span class="text-[9px] text-slate-500 font-mono">{{ order.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
              </div>
            }
            @if (orders().length === 0) {
              <div class="text-center py-10 text-slate-500 font-mono text-xs">
                Nenhum pedido registrado no Marketplace até o momento.
              </div>
            }
          </div>
        </div>
      }

    </div>
  `
})
export class HqMarketplaceComponent implements OnInit, OnDestroy {
  private http = inject(HqApiClient);

  activeTab = signal<'overview' | 'stores' | 'orders'>('overview');
  
  stats = signal<any>({
    totalCompanies: 0,
    publishedStores: 0,
    draftStores: 0,
    totalProductsListed: 0,
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    totalGmv: 0,
    averageTicket: 0,
    ordersByStatus: {},
    ordersByChannel: {}
  });

  stores = signal<MarketplaceStoreSummary[]>([]);
  orders = signal<MarketplaceOrderSummary[]>([]);

  private refreshInterval: any = null;

  ngOnInit() {
    this.loadOverview();
    this.loadStores();
    this.loadOrders();

    // Auto-refresh every 12 seconds
    this.refreshInterval = setInterval(() => {
      this.loadOverview();
      if (this.activeTab() === 'stores') this.loadStores();
      if (this.activeTab() === 'orders') this.loadOrders();
    }, 12000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async loadOverview() {
    try {
      const res = await firstValueFrom(this.http.get<any>('/hq/marketplace/overview'));
      if (res && res.stats) {
        this.stats.set(res.stats);
      }
    } catch (err) {
      console.warn('Erro ao carregar indicadores de marketplace no HQ:', err);
    }
  }

  async loadStores() {
    try {
      const res = await firstValueFrom(this.http.get<MarketplaceStoreSummary[]>('/hq/marketplace/stores'));
      if (Array.isArray(res)) {
        this.stores.set(res);
      }
    } catch (err) {
      console.warn('Erro ao carregar lojas do marketplace no HQ:', err);
    }
  }

  async loadOrders() {
    try {
      const res = await firstValueFrom(this.http.get<MarketplaceOrderSummary[]>('/hq/marketplace/orders'));
      if (Array.isArray(res)) {
        this.orders.set(res);
      }
    } catch (err) {
      console.warn('Erro ao carregar pedidos do marketplace no HQ:', err);
    }
  }

  async moderateStore(companyId: string, action: 'publish' | 'draft' | 'suspend', reason: string) {
    try {
      await firstValueFrom(this.http.post<any>(`/hq/marketplace/stores/${companyId}/moderate`, { action, reason }));
      await this.loadStores();
      await this.loadOverview();
    } catch (err) {
      console.error('Falha na moderação de vitrine:', err);
    }
  }
}
