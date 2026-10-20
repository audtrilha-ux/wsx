/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HqApiClient } from '../../../../core/api/api-client';
import { firstValueFrom } from 'rxjs';

export interface EcosystemLiveEvent {
  id: string;
  type: 'SALE' | 'ORDER' | 'SYNC' | 'HEARTBEAT' | 'CREDIT';
  title: string;
  details: string;
  amount?: number;
  companyId: string;
  timestamp: string;
}

@Component({
  selector: 'app-hq-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      
      <!-- Live Ecosystem Pulse Banner -->
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-black text-white tracking-wide uppercase">3eatcru OS • Ecossistema em Tempo Real</h3>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PULSE ONLINE
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              {{ activeTenantsCount() }} empresas ativas conectadas • {{ totalSalesCount() }} transações consolidadas • Central Control Plane operacional
            </p>
          </div>
        </div>

        <!-- Controls: Auto-refresh, Live Sim & Sync -->
        <div class="flex items-center gap-2 shrink-0">
          <button 
            (click)="toggleAutoRefresh()" 
            [class.bg-emerald-950]="isAutoRefreshActive()"
            [class.border-emerald-500]="isAutoRefreshActive()"
            [class.text-emerald-400]="isAutoRefreshActive()"
            [class.bg-slate-800]="!isAutoRefreshActive()"
            [class.border-slate-700]="!isAutoRefreshActive()"
            [class.text-slate-400]="!isAutoRefreshActive()"
            class="px-3 py-1.5 border text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            title="Alternar sincronização automática em tempo real">
            <mat-icon class="text-sm" [class.animate-spin]="isAutoRefreshActive()">sync</mat-icon>
            {{ isAutoRefreshActive() ? 'Auto-Sync (10s)' : 'Auto-Sync Pausado' }}
          </button>

          <button 
            (click)="loadDashboardData()" 
            class="px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs font-bold text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer">
            <mat-icon class="text-sm">refresh</mat-icon>
            Recarregar
          </button>
        </div>
      </div>

      <!-- ROW 1: Executive KPI Metrics (BI + SaaS Billing + Omnichannel Marketplace) -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <!-- Monthly Recurring Revenue (SaaS MRR) -->
        <div class="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 shadow-inner">
          <div class="flex items-center gap-2 text-indigo-400 mb-1.5">
            <mat-icon class="text-base">monetization_on</mat-icon>
            <span class="text-[11px] font-bold uppercase tracking-wider">SaaS MRR</span>
          </div>
          <div class="text-xl font-black text-white tracking-tight font-mono tabular-nums">
            {{ totalMrr() | currency:'BRL':'symbol':'1.2-2' }}
          </div>
          <p class="text-[10px] text-slate-500 mt-1.5 font-mono">Assinaturas do OS</p>
        </div>

        <!-- System Total Ledger Balance -->
        <div class="bg-amber-950/40 border border-amber-500/30 rounded-xl p-4 shadow-inner">
          <div class="flex items-center gap-2 text-amber-400 mb-1.5">
            <mat-icon class="text-base">account_balance</mat-icon>
            <span class="text-[11px] font-bold uppercase tracking-wider">Saldos Licença</span>
          </div>
          <div class="text-xl font-black text-white tracking-tight font-mono tabular-nums">
            {{ totalLedgerBalance() | currency:'BRL':'symbol':'1.2-2' }}
          </div>
          <p class="text-[10px] text-slate-500 mt-1.5 font-mono">Recargas acumuladas</p>
        </div>

        <!-- Consolidated GMV (PDVs) -->
        <div class="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 shadow-inner">
          <div class="flex items-center gap-2 text-emerald-400 mb-1.5">
            <mat-icon class="text-base">point_of_sale</mat-icon>
            <span class="text-[11px] font-bold uppercase tracking-wider">GMV PDVs (Balcão)</span>
          </div>
          <div class="text-xl font-black text-white tracking-tight font-mono tabular-nums">
            {{ totalRevenue() | currency:'BRL':'symbol':'1.2-2' }}
          </div>
          <p class="text-[10px] text-slate-500 mt-1.5 font-mono">Faturado em terminais</p>
        </div>

        <!-- Marketplace Online GMV -->
        <div class="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 shadow-inner">
          <div class="flex items-center gap-2 text-rose-400 mb-1.5">
            <mat-icon class="text-base">storefront</mat-icon>
            <span class="text-[11px] font-bold uppercase tracking-wider">GMV Marketplace</span>
          </div>
          <div class="text-xl font-black text-white tracking-tight font-mono tabular-nums">
            {{ marketplaceGmv() | currency:'BRL':'symbol':'1.2-2' }}
          </div>
          <p class="text-[10px] text-slate-500 mt-1.5 font-mono">{{ marketplaceOrdersCount() }} pedidos online</p>
        </div>

        <!-- Global Transactions Count (Omnichannel) -->
        <div class="bg-blue-950/40 border border-blue-500/30 rounded-xl p-4 shadow-inner">
          <div class="flex items-center gap-2 text-blue-400 mb-1.5">
            <mat-icon class="text-base">receipt_long</mat-icon>
            <span class="text-[11px] font-bold uppercase tracking-wider">Total Transações</span>
          </div>
          <div class="text-xl font-black text-white tracking-tight font-mono tabular-nums">
            {{ totalSalesCount() + marketplaceOrdersCount() }}
          </div>
          <p class="text-[10px] text-slate-500 mt-1.5 font-mono">PDV + Marketplace</p>
        </div>
      </div>

      <!-- ROW 2: Demographics, Plans and Platform distribution -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Tenant Status & Plan distribution -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 class="text-xs font-bold text-white mb-4 uppercase tracking-wider border-b border-slate-800 pb-2.5 flex justify-between">
            <span>Controle de Tenants</span>
            <span class="text-emerald-400 font-mono">{{ activeTenantsCount() }} Ativos</span>
          </h4>
          
          <div class="space-y-4">
            <!-- Active vs Suspended bar -->
            <div>
              <div class="flex justify-between text-[11px] mb-1 font-bold">
                <span class="text-slate-400">Status Operacional</span>
                <span class="text-slate-300 font-mono">{{ activeTenantsCount() }} / {{ companiesList().length }}</span>
              </div>
              <div class="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
                <div class="h-full bg-emerald-500" [style.width.%]="companiesList().length > 0 ? (activeTenantsCount() / companiesList().length) * 100 : 0"></div>
                <div class="h-full bg-red-500" [style.width.%]="companiesList().length > 0 ? (suspendedTenantsCount() / companiesList().length) * 100 : 0"></div>
              </div>
              <div class="flex gap-3 text-[10px] mt-1.5 font-mono">
                <span class="flex items-center gap-1 text-emerald-400"><span class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> Ativo</span>
                <span class="flex items-center gap-1 text-red-400"><span class="w-1.5 h-1.5 bg-red-400 rounded-full"></span> Suspenso</span>
              </div>
            </div>

            <!-- Distribution by subscription tiers -->
            <div class="border-t border-slate-800/60 pt-3">
              <span class="text-[11px] font-bold text-slate-400 block mb-2">Planos Contratados</span>
              <div class="grid grid-cols-3 gap-2">
                <div class="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center">
                  <div class="text-[10px] text-slate-500 uppercase font-mono">Starter</div>
                  <div class="text-sm font-bold text-white mt-0.5">{{ planDistribution().starter }}</div>
                </div>
                <div class="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center">
                  <div class="text-[10px] text-slate-500 uppercase font-mono">Pro</div>
                  <div class="text-sm font-bold text-white mt-0.5">{{ planDistribution().pro }}</div>
                </div>
                <div class="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center">
                  <div class="text-[10px] text-slate-500 uppercase font-mono">Enterprise</div>
                  <div class="text-sm font-bold text-white mt-0.5">{{ planDistribution().enterprise }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Terminal Platforms distributions -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 class="text-xs font-bold text-white mb-4 uppercase tracking-wider border-b border-slate-800 pb-2.5">
            Distribuição de Terminais
          </h4>
          <div class="space-y-4">
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="flex items-center gap-1.5 text-slate-300">
                <mat-icon class="text-sm text-blue-400">language</mat-icon> Web App Clients
              </span>
              <span class="text-white font-bold">{{ platformDistribution().web }}</span>
            </div>
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="flex items-center gap-1.5 text-slate-300">
                <mat-icon class="text-sm text-emerald-400">phone_android</mat-icon> Android App/PDVs
              </span>
              <span class="text-white font-bold">{{ platformDistribution().android }}</span>
            </div>
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="flex items-center gap-1.5 text-slate-300">
                <mat-icon class="text-sm text-purple-400">desktop_windows</mat-icon> Windows/Desktop
              </span>
              <span class="text-white font-bold">{{ platformDistribution().desktop }}</span>
            </div>

            <!-- Health diagnostics summary -->
            <div class="border-t border-slate-800/60 pt-3 flex justify-between gap-1">
              <div class="flex-1 text-center bg-emerald-500/10 border border-emerald-500/20 rounded p-1.5">
                <div class="text-[9px] text-emerald-400 uppercase font-bold font-mono">Saudável</div>
                <div class="text-xs font-bold text-emerald-400 mt-0.5">{{ healthDistribution().healthy }}</div>
              </div>
              <div class="flex-1 text-center bg-amber-500/10 border border-amber-500/20 rounded p-1.5">
                <div class="text-[9px] text-amber-400 uppercase font-bold font-mono">Atenção</div>
                <div class="text-xs font-bold text-amber-400 mt-0.5">{{ healthDistribution().warning }}</div>
              </div>
              <div class="flex-1 text-center bg-red-500/10 border border-red-500/20 rounded p-1.5">
                <div class="text-[9px] text-red-400 uppercase font-bold font-mono">Crítico</div>
                <div class="text-xs font-bold text-red-400 mt-0.5">{{ healthDistribution().critical }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Ecosystem performance average -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 class="text-xs font-bold text-white mb-4 uppercase tracking-wider border-b border-slate-800 pb-2.5">
            Eficiência Comercial
          </h4>
          <div class="space-y-4">
            <div class="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 flex justify-between items-center">
              <div>
                <span class="text-[10px] text-slate-500 uppercase tracking-wider block">Ticket Médio</span>
                <span class="text-lg font-bold text-white mt-0.5 block">{{ averageTicket() | currency:'BRL' }}</span>
              </div>
              <mat-icon class="text-amber-500">trending_up</mat-icon>
            </div>
            
            <div class="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 flex justify-between items-center">
              <div>
                <span class="text-[10px] text-slate-500 uppercase tracking-wider block">Receita Média por Tenant</span>
                <span class="text-lg font-bold text-white mt-0.5 block">{{ (totalRevenue() / (activeTenantsCount() || 1)) | currency:'BRL' }}</span>
              </div>
              <mat-icon class="text-indigo-400">group_work</mat-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- ROW 2.5: MRR Projections & Tenant Retention (SaaS BI Expansion) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <!-- Cohort & Retention Metrics -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 col-span-2">
          <h4 class="text-xs font-bold text-white mb-4 uppercase tracking-wider border-b border-slate-800 pb-2.5 flex justify-between">
            <span>Retenção & LTV de Tenants (B2B)</span>
            <span class="text-indigo-400 font-mono text-[10px]">Cancelamento vs Retenção de Empresas</span>
          </h4>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Taxa de Churn -->
            <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center">
              <span class="text-[9px] text-slate-500 uppercase font-mono block">Taxa de Churn de Tenants</span>
              <span class="text-xl font-black text-rose-400 mt-1 block">{{ churnRate() | number:'1.1-1' }}%</span>
              <span class="text-[8px] text-slate-600 font-sans block mt-1">Cancelamento de Assinaturas</span>
            </div>
            
            <!-- Taxa de Retenção -->
            <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center">
              <span class="text-[9px] text-slate-500 uppercase font-mono block">Taxa de Retenção de Tenants</span>
              <span class="text-xl font-black text-emerald-400 mt-1 block">{{ retentionRate() | number:'1.1-1' }}%</span>
              <span class="text-[8px] text-slate-600 font-sans block mt-1">Empresas/Tenants Ativos</span>
            </div>
            
            <!-- Customer Lifetime Value (LTV) -->
            <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center">
              <span class="text-[9px] text-slate-500 uppercase font-mono block">LTV Médio do Tenant</span>
              <span class="text-xl font-black text-indigo-400 mt-1 block">{{ ltv() | currency:'BRL':'symbol':'1.0-0' }}</span>
              <span class="text-[8px] text-slate-600 font-sans block mt-1">Receita Estimada por Licença</span>
            </div>
          </div>
        </div>

        <!-- Projeções Financeiras Recorrentes (SaaS Growth Estimator) -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 class="text-xs font-bold text-white mb-4 uppercase tracking-wider border-b border-slate-800 pb-2.5 flex items-center justify-between">
            <span>Projeções Recorrentes (MRR / ARR)</span>
            <span class="text-[10px] text-amber-400/80 normal-case font-normal">(Estimativas BI)</span>
          </h4>
          <div class="space-y-3 text-xs">
            <div class="flex justify-between items-center py-1.5 border-b border-slate-800/60">
              <span class="text-slate-400">ARR Anualizado (Estimativa 12M):</span>
              <span class="font-bold text-white font-mono">{{ arr() | currency:'BRL' }}</span>
            </div>
            <div class="flex justify-between items-center py-1.5 border-b border-slate-800/60">
              <span class="text-slate-400">Projeção MRR (6M, 5% MoM):</span>
              <span class="font-bold text-indigo-400 font-mono">{{ mrr6Months() | currency:'BRL' }}</span>
            </div>
            <div class="flex justify-between items-center py-1.5">
              <span class="text-slate-400">Projeção MRR (12M, 5% MoM):</span>
              <span class="font-bold text-emerald-400 font-mono">{{ mrr12Months() | currency:'BRL' }}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- ROW 3: Live Feed & Transactions Stream -->
      <div class="grid md:grid-cols-2 gap-6">
        
        <!-- Live Ecosystem Activity Stream -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
          <h4 class="text-sm font-bold text-white mb-4 uppercase tracking-wider border-b border-slate-800 pb-3 flex justify-between items-center">
            <span class="flex items-center gap-2">
              <mat-icon class="text-emerald-400 text-sm">stream</mat-icon>
              Feed de Atividades ao Vivo
            </span>
            <span class="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
              Live Stream
            </span>
          </h4>
          <div class="flex-1 overflow-y-auto max-h-[300px] pr-2 space-y-2">
            @for (event of liveEvents(); track event.id) {
              <div class="bg-slate-950 border border-slate-800/90 rounded-lg p-3 flex items-center justify-between gap-3 animate-fade-in">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    [class]="event.type === 'ORDER' ? 'bg-indigo-900/60 text-indigo-400' : event.type === 'SALE' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-amber-900/60 text-amber-400'">
                    <mat-icon class="text-sm">{{ event.type === 'ORDER' ? 'shopping_bag' : event.type === 'SALE' ? 'point_of_sale' : 'sync' }}</mat-icon>
                  </div>
                  <div>
                    <div class="text-xs font-bold text-slate-200">{{ event.title }}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">{{ event.details }} • <span class="text-slate-500 font-mono">{{ event.companyId }}</span></div>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  @if (event.amount) {
                    <div class="text-xs font-black text-emerald-400 font-mono">+{{ event.amount | currency:'BRL' }}</div>
                  }
                  <div class="text-[9px] text-slate-500 font-mono mt-0.5">{{ event.timestamp | date:'HH:mm:ss' }}</div>
                </div>
              </div>
            }
            @if (liveEvents().length === 0) {
              <div class="text-center py-6 text-slate-500 text-xs font-mono">Aguardando eventos do barramento...</div>
            }
          </div>
        </div>

        <!-- Recent Sales Log -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
          <h4 class="text-sm font-bold text-white mb-4 uppercase tracking-wider border-b border-slate-800 pb-3 flex justify-between items-center">
            <span>Log de Vendas Recentes</span>
            <span class="text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 font-mono">Consolidado em Tempo Real</span>
          </h4>
          <div class="flex-1 overflow-y-auto max-h-[300px] pr-2 space-y-2">
            @for (sale of salesList(); track sale.id) {
              <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <div class="text-xs font-bold text-slate-300">{{ sale.companyId }}</div>
                  <div class="text-[10px] text-slate-500 font-mono mt-0.5">{{ sale.id }} • {{ sale.operator || 'Operador Balcão' }}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-black text-emerald-400 font-mono">{{ sale.total | currency:'BRL' }}</div>
                  <div class="text-[9px] text-slate-500 font-mono mt-0.5">{{ sale.timestamp | date:'short' }}</div>
                </div>
              </div>
            }
            @if (salesList().length === 0) {
              <div class="text-center py-6 text-slate-500 text-xs font-mono">Nenhuma transação registrada.</div>
            }
          </div>
        </div>

      </div>
    </div>
  `,
  styles: []
})
export class HqDashboardComponent implements OnInit, OnDestroy {
  private http = inject(HqApiClient);
  
  salesList = signal<any[]>([]);
  companiesList = signal<any[]>([]);
  telemetryList = signal<any[]>([]);
  appsList = signal<any[]>([]);
  liveEvents = signal<EcosystemLiveEvent[]>([]);
  
  totalRevenue = signal(0);
  totalSalesCount = signal(0);
  averageTicket = signal(0);
  salesByCompany = signal<{companyId: string; total: number; percentage: number}[]>([]);
  
  // Computed stats for BI & Governance
  totalMrr = signal(0);
  totalLedgerBalance = signal(0);
  activeTenantsCount = signal(0);
  suspendedTenantsCount = signal(0);
  planDistribution = signal<{ starter: number; pro: number; enterprise: number }>({ starter: 0, pro: 0, enterprise: 0 });
  platformDistribution = signal<{ web: number; android: number; desktop: number }>({ web: 0, android: 0, desktop: 0 });
  healthDistribution = signal<{ healthy: number; warning: number; critical: number }>({ healthy: 0, warning: 0, critical: 0 });

  // Extended BI Stats
  churnRate = signal(0);
  retentionRate = signal(0);
  ltv = signal(0);
  arr = signal(0);
  mrr6Months = signal(0);
  mrr12Months = signal(0);

  // Omnichannel Marketplace Signals
  marketplaceGmv = signal(0);
  marketplaceOrdersCount = signal(0);
  marketplaceActiveStores = signal(0);

  // Auto-refresh timer
  isAutoRefreshActive = signal(true);
  private autoRefreshInterval: any = null;

  ngOnInit() {
    this.loadDashboardData();
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
  }

  startAutoRefresh() {
    if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
    this.autoRefreshInterval = setInterval(() => {
      if (this.isAutoRefreshActive()) {
        this.loadDashboardData();
      }
    }, 10000);
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  toggleAutoRefresh() {
    this.isAutoRefreshActive.update(v => !v);
  }

  async simulateLiveTransaction() {
    try {
      const targetCompany = this.companiesList()[0]?.id || 'company_demo_01';
      const sampleNames = ['Carlos Silva', 'Mariana Souza', 'Lucas Oliveira', 'Beatriz Lima'];
      const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const randomAmount = Math.floor(Math.random() * 80) + 25.50;

      // Injeta pedido de teste diretamente no endpoint público de pedidos
      const res = await firstValueFrom(this.http.post<any>('/api/v1/public-space/orders', {
        companyId: targetCompany,
        customerName: randomName,
        customerPhone: '(11) 98765-4321',
        customerAddress: 'Rua das Flores, 123',
        paymentMethod: 'PIX',
        items: [
          { name: 'Combo Especial Degustação', quantity: 1, price: randomAmount }
        ]
      }));

      // Adiciona ao feed de eventos ao vivo instantaneamente
      const newEvent: EcosystemLiveEvent = {
        id: res.orderId || `evt_${Date.now()}`,
        type: 'ORDER',
        title: `Novo Pedido Marketplace (${randomName})`,
        details: `Combo Especial Degustação via PIX`,
        amount: randomAmount,
        companyId: targetCompany,
        timestamp: new Date().toISOString()
      };

      this.liveEvents.update(curr => [newEvent, ...curr.slice(0, 19)]);
      await this.loadDashboardData();
    } catch (err) {
      console.warn('Simulação de transação:', err);
    }
  }

  async loadDashboardData() {
    try {
      // Parallel loading of all endpoints to reduce network latency
      const [sales, companies, telemetry, apps, mktOverview] = await Promise.all([
        firstValueFrom(this.http.get<any[]>('/hq/analytics/sales')),
        firstValueFrom(this.http.get<any[]>('/companies')),
        firstValueFrom(this.http.get<any[]>('/telemetry')),
        firstValueFrom(this.http.get<any[]>('/hq/apps')),
        firstValueFrom(this.http.get<any>('/hq/marketplace/overview')).catch(() => null)
      ]);

      this.salesList.set(sales);
      this.companiesList.set(companies);
      this.telemetryList.set(telemetry);
      this.appsList.set(apps);

      // Set Marketplace stats if available
      if (mktOverview && mktOverview.stats) {
        this.marketplaceGmv.set(mktOverview.stats.totalGmv || 0);
        this.marketplaceOrdersCount.set(mktOverview.stats.totalOrders || 0);
        this.marketplaceActiveStores.set(mktOverview.stats.publishedStores || 0);
      }

      // Compute general GMV Stats
      const revenue = sales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0);
      const count = sales.length;
      this.totalRevenue.set(revenue);
      this.totalSalesCount.set(count);
      this.averageTicket.set(count > 0 ? revenue / count : 0);

      // Compute Group by company
      const groupedSales = sales.reduce((acc, sale) => {
        const val = Number(sale.total) || 0;
        acc[sale.companyId] = (acc[sale.companyId] || 0) + val;
        return acc;
      }, {} as Record<string, number>);

      const byCompany = Object.entries(groupedSales).map(([companyId, total]) => {
        const numericTotal = total as number;
        return {
          companyId,
          total: numericTotal,
          percentage: revenue > 0 ? (numericTotal / revenue) * 100 : 0
        };
      }).sort((a, b) => b.total - a.total);
      this.salesByCompany.set(byCompany);

      // Populate initial live events combining sales and marketplace orders
      if (this.liveEvents().length === 0) {
        const events: EcosystemLiveEvent[] = [];
        
        // Add recent marketplace orders if available
        if (mktOverview && mktOverview.recentOrders && Array.isArray(mktOverview.recentOrders)) {
          for (const o of mktOverview.recentOrders.slice(0, 5)) {
            events.push({
              id: o.id,
              type: 'ORDER',
              title: `Pedido Online (${o.customerName || 'Cliente'})`,
              details: `${o.companyName || o.companyId} • #${o.id.slice(-6)}`,
              amount: Number(o.total) || 0,
              companyId: o.companyId,
              timestamp: o.createdAt || new Date().toISOString()
            });
          }
        }

        // Add sales events
        if (sales.length > 0) {
          for (const s of sales.slice(0, 5)) {
            events.push({
              id: s.id,
              type: 'SALE',
              title: `Venda Concluída no PDV`,
              details: `Transação #${s.id.slice(-6)} (${s.operator || 'Balcão'})`,
              amount: Number(s.total) || 0,
              companyId: s.companyId,
              timestamp: s.timestamp || new Date().toISOString()
            });
          }
        }

        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        this.liveEvents.set(events.slice(0, 10));
      }

      // Compute SaaS billing & Subscription Plans using dynamic Plan catalog pricing
      let catalogPlans: { id: string; monthlyPrice: number }[] = [];
      try {
        catalogPlans = await firstValueFrom(
          this.http.get<{ id: string; monthlyPrice: number }[]>('/api/v1/plans')
        );
      } catch {
        catalogPlans = [
          { id: 'starter', monthlyPrice: 99 },
          { id: 'pro', monthlyPrice: 249 },
          { id: 'enterprise', monthlyPrice: 499 }
        ];
      }

      let mrr = 0;
      let balanceSum = 0;
      let activeCount = 0;
      let suspendedCount = 0;
      const plansDist = { starter: 0, pro: 0, enterprise: 0 };

      for (const comp of companies) {
        balanceSum += comp.balance || 0;
        if (comp.status === 'active') {
          activeCount++;
          const pId = (comp.plan || 'starter').toLowerCase();
          const foundPlan = catalogPlans.find(p => p.id.toLowerCase() === pId) || catalogPlans.find(p => p.id.toLowerCase() === 'starter');
          const planPrice = foundPlan ? foundPlan.monthlyPrice : 99;
          
          mrr += planPrice;
          if (pId.includes('pro')) plansDist.pro++;
          else if (pId.includes('enterprise') || pId.includes('premium')) plansDist.enterprise++;
          else plansDist.starter++;

          // Sum of installed apps prices
          for (const appId of comp.installedApps || []) {
            const appItem = apps.find(a => a.id === appId);
            if (appItem && appItem.price > 0) {
              mrr += appItem.price;
            }
          }
        } else {
          suspendedCount++;
        }
      }

      this.totalMrr.set(mrr);
      this.totalLedgerBalance.set(balanceSum);
      this.activeTenantsCount.set(activeCount);
      this.suspendedTenantsCount.set(suspendedCount);
      this.planDistribution.set(plansDist);

      // Compute Cohort, Retention and Projections (SaaS Expansion BI)
      const totalTenants = activeCount + suspendedCount || 1;
      const churnVal = (suspendedCount / totalTenants) * 100;
      const retentionVal = 100 - churnVal;
      const averageTenantMrr = activeCount > 0 ? mrr / activeCount : 99;
      const lifeSpanMonths = churnVal > 0 ? (100 / churnVal) : 24;
      const estimatedLtv = averageTenantMrr * lifeSpanMonths;

      this.churnRate.set(churnVal);
      this.retentionRate.set(retentionVal);
      this.ltv.set(estimatedLtv);
      this.arr.set(mrr * 12);
      this.mrr6Months.set(mrr * Math.pow(1.05, 6));
      this.mrr12Months.set(mrr * Math.pow(1.05, 12));

      // Compute platforms & overall health based on telemetry
      const platforms = { web: 0, android: 0, desktop: 0 };
      const health = { healthy: 0, warning: 0, critical: 0 };

      for (const tel of telemetry) {
        const p = (tel.platform || 'web').toLowerCase();
        if (p.includes('web')) platforms.web++;
        else if (p.includes('android')) platforms.android++;
        else platforms.desktop++;

        const h = (tel.overallStatus || 'healthy').toLowerCase();
        if (h === 'healthy') health.healthy++;
        else if (h === 'warning') health.warning++;
        else health.critical++;
      }

      this.platformDistribution.set(platforms);
      this.healthDistribution.set(health);

    } catch (err) {
      console.error('Failed to load SaaS BI dashboard data in HQ Dashboard', err);
    }
  }
}

