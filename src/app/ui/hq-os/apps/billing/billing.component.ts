import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HqApiClient } from '../../../../core/api/api-client';
import { firstValueFrom } from 'rxjs';
import { HqStateService } from '../../hq-state.service';
import { PlansCatalogComponent, PlanDefinition } from './components/plans-catalog.component';
import { LedgerTableComponent, CompanyLedgerEntry } from './components/ledger-table.component';
import { Company } from '../../../../core/domain/company/company.entity';

interface BillingReport {
  companyId: string;
  companyName: string;
  previousBalance: number;
  monthlyCost: number;
  newBalance: number;
  previousStatus: string;
  newStatus: string;
  apps: string[];
}

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  companyId: string;
  companyName: string;
  billingPeriod: string;
  issueDate: string;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  subtotal: number;
  discount: number;
  totalAmount: number;
  paidAt?: string;
}

@Component({
  selector: 'app-hq-billing',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    PlansCatalogComponent,
    LedgerTableComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <mat-icon class="text-sm">payments</mat-icon>
            </div>
            <h3 class="text-lg font-bold text-white uppercase tracking-wider">Governança Financeira & Billing SaaS</h3>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            Motor central de tarifação de licenças corporativas, débito de módulos e auditoria do livro-razão.
          </p>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button (click)="activeTab.set('CYCLE')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  [ngClass]="activeTab() === 'CYCLE' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
            <mat-icon class="text-xs">autorenew</mat-icon>
            Ciclo de Faturamento
          </button>
          <button (click)="activeTab.set('INVOICES')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  [ngClass]="activeTab() === 'INVOICES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
            <mat-icon class="text-xs">description</mat-icon>
            Faturas
          </button>
          <button (click)="activeTab.set('PLANS')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  [ngClass]="activeTab() === 'PLANS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
            <mat-icon class="text-xs">workspace_premium</mat-icon>
            Planos & Quotas
          </button>
          <button (click)="activeTab.set('LEDGER')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  [ngClass]="activeTab() === 'LEDGER' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
            <mat-icon class="text-xs">receipt_long</mat-icon>
            Livro-Razão (Ledger)
          </button>
        </div>
      </div>

      <!-- Tab 1: Run Billing Cycle -->
      @if (activeTab() === 'CYCLE') {
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div class="max-w-2xl">
              <h4 class="text-base font-bold text-white flex items-center gap-2 mb-1.5">
                <mat-icon class="text-indigo-400">autorenew</mat-icon>
                Disparar Ciclo Mensal de Faturamento (Run Billing)
              </h4>
              <p class="text-xs text-slate-400 leading-relaxed">
                O motor itera sobre todos os tenants, calcula a soma das licenças dos módulos instalados e deduz diretamente do saldo corporativo. 
                <span class="text-rose-400 font-bold">Tenants com saldo resultante negativo são automaticamente suspensos</span>, ativando a proteção de terminal do Client OS.
              </p>
            </div>
            <button (click)="runBillingCycle()" [disabled]="isBillingRunning()" 
                    class="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-rose-900/50 transition-all active:scale-95 shrink-0 text-xs uppercase tracking-wider">
              @if (isBillingRunning()) {
                <mat-icon class="animate-spin text-sm">hourglass_empty</mat-icon>
                Processando Cobrança...
              } @else {
                <mat-icon class="text-sm">play_arrow</mat-icon>
                Executar Ciclo Agora
              }
            </button>
          </div>

          @if (billingReports().length > 0) {
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Extrato do Ciclo de Faturamento Executado ({{ billingReports().length }} tenants avaliados)
                </h5>
              </div>

              <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table class="w-full text-left text-xs text-slate-300">
                  <thead class="text-[10px] text-slate-400 uppercase bg-slate-900/80 border-b border-slate-800">
                    <tr>
                      <th class="px-4 py-3">Tenant</th>
                      <th class="px-4 py-3">Módulos Cobrados</th>
                      <th class="px-4 py-3 text-right">Saldo Ant.</th>
                      <th class="px-4 py-3 text-right text-rose-400">Débito Mensal</th>
                      <th class="px-4 py-3 text-right">Novo Saldo</th>
                      <th class="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-900">
                    @for (report of billingReports(); track report.companyId) {
                      <tr class="hover:bg-slate-900/40 transition-colors">
                        <td class="px-4 py-3 font-bold text-white">{{ report.companyName }}</td>
                        <td class="px-4 py-3 text-slate-400">
                          {{ report.apps.join(', ') || 'Nenhum app tarifado' }}
                        </td>
                        <td class="px-4 py-3 text-right font-mono">{{ report.previousBalance | currency:'BRL' }}</td>
                        <td class="px-4 py-3 text-right text-rose-400 font-mono font-bold">
                          -{{ report.monthlyCost | currency:'BRL' }}
                        </td>
                        <td class="px-4 py-3 text-right font-mono font-bold" [ngClass]="report.newBalance < 0 ? 'text-rose-400' : 'text-emerald-400'">
                          {{ report.newBalance | currency:'BRL' }}
                        </td>
                        <td class="px-4 py-3 text-center">
                          <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono border"
                                [ngClass]="report.newStatus === 'suspended' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'">
                            {{ report.newStatus === 'suspended' ? 'Suspenso' : 'Ativo' }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          } @else {
            <div class="text-center py-10 bg-slate-950/60 rounded-xl border border-slate-800 text-slate-500 text-xs font-mono">
              O ciclo de faturamento ainda não foi executado nesta sessão. Clique no botão acima para rodar a apuração mensal.
            </div>
          }
        </div>
      }

      <!-- Tab 2: Invoices -->
      @if (activeTab() === 'INVOICES') {
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          <div class="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h4 class="text-base font-bold text-white flex items-center gap-2">
                <mat-icon class="text-indigo-400">receipt</mat-icon>
                Faturas Oficiais do Ecossistema SaaS
              </h4>
              <p class="text-xs text-slate-400 mt-0.5">
                Histórico de faturas consolidadas geradas pelo motor de cobrança.
              </p>
            </div>
            <button (click)="loadInvoices()" class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1">
              <mat-icon class="text-xs">refresh</mat-icon>
              Atualizar
            </button>
          </div>

          @if (invoices().length === 0) {
            <div class="py-12 text-center text-slate-500 text-xs">
              <mat-icon class="text-3xl mb-2 text-slate-600 block mx-auto">description</mat-icon>
              Nenhuma fatura gerada até o momento. Execute o ciclo de faturamento para emitir faturas automáticas.
            </div>
          } @else {
            <div class="overflow-x-auto rounded-xl border border-slate-800">
              <table class="w-full text-left text-xs text-slate-300">
                <thead class="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th class="p-3">Nº Fatura</th>
                    <th class="p-3">Tenant</th>
                    <th class="p-3">Competência</th>
                    <th class="p-3">Emissão / Vencimento</th>
                    <th class="p-3">Total</th>
                    <th class="p-3">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60 bg-slate-900/40">
                  @for (inv of invoices(); track inv.id) {
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="p-3 font-mono font-bold text-indigo-400">{{ inv.invoiceNumber }}</td>
                      <td class="p-3 font-medium text-white">{{ inv.companyName }}</td>
                      <td class="p-3 font-mono text-slate-400">{{ inv.billingPeriod }}</td>
                      <td class="p-3 text-slate-400 text-[11px]">
                        {{ inv.issueDate }} <span class="text-slate-600">até</span> {{ inv.dueDate }}
                      </td>
                      <td class="p-3 font-mono font-bold text-white">{{ inv.totalAmount | currency:'BRL' }}</td>
                      <td class="p-3">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                              [ngClass]="{
                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': inv.status === 'PAID',
                                'bg-amber-500/10 text-amber-400 border border-amber-500/20': inv.status === 'PENDING',
                                'bg-rose-500/10 text-rose-400 border border-rose-500/20': inv.status === 'OVERDUE',
                                'bg-slate-500/10 text-slate-400 border border-slate-500/20': inv.status === 'CANCELLED'
                              }">
                          {{ inv.status }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <!-- Tab 3: Plans Catalog -->
      @if (activeTab() === 'PLANS') {
        <app-plans-catalog [plans]="plans()" />
      }

      <!-- Tab 4: Ledger & Financial Audit -->
      @if (activeTab() === 'LEDGER') {
        <div class="space-y-6">
          <div class="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div>
              <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Selecionar Tenant para Extrato:</span>
              <select [value]="selectedCompanyId()" (change)="onCompanySelectChange($event)"
                      class="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-500">
                @for (c of companies(); track c.id) {
                  <option [value]="c.id">{{ c.name }} ({{ c.id }})</option>
                }
              </select>
            </div>

            <div class="text-right">
              <span class="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Saldo em Tempo Real</span>
              <span class="text-sm font-mono font-bold text-emerald-400">
                {{ currentCompanyBalance() | currency:'BRL' }}
              </span>
            </div>
          </div>

          <app-ledger-table [entries]="ledgerEntries()" />
        </div>
      }
    </div>
  `
})
export class HqBillingComponent implements OnInit {
  private http = inject(HqApiClient);
  private hqState = inject(HqStateService);

  activeTab = signal<'CYCLE' | 'INVOICES' | 'PLANS' | 'LEDGER'>('CYCLE');
  isBillingRunning = signal(false);
  billingReports = signal<BillingReport[]>([]);

  plans = signal<PlanDefinition[]>([]);
  companies = signal<Company[]>([]);
  selectedCompanyId = signal<string>('comp_1');
  ledgerEntries = signal<CompanyLedgerEntry[]>([]);
  invoices = signal<InvoiceData[]>([]);

  currentCompanyBalance(): number {
    const comp = this.companies().find(c => c.id === this.selectedCompanyId());
    return comp ? comp.balance : 0;
  }

  ngOnInit() {
    this.loadPlans();
    this.loadCompanies();
    this.loadInvoices();
  }

  onCompanySelectChange(event: Event) {
    const companyId = (event.target as HTMLSelectElement).value;
    this.loadLedger(companyId);
  }

  async loadPlans() {
    try {
      const data = await firstValueFrom(this.http.get<PlanDefinition[]>('/api/v1/licensing/plans'));
      this.plans.set(data);
    } catch (err: unknown) {
      console.error('Failed to load plans', err);
    }
  }

  async loadInvoices() {
    try {
      const data = await firstValueFrom(this.http.get<InvoiceData[]>('/api/v1/hq/invoices'));
      this.invoices.set(data);
    } catch (err: unknown) {
      console.error('Failed to load invoices', err);
    }
  }

  async loadCompanies() {
    try {
      const data = await firstValueFrom(this.http.get<Company[]>('/api/v1/companies'));
      this.companies.set(data);
      if (data.length > 0 && !this.selectedCompanyId()) {
        this.selectedCompanyId.set(data[0].id);
      }
      if (this.selectedCompanyId()) {
        await this.loadLedger(this.selectedCompanyId());
      }
    } catch (err: unknown) {
      console.error('Failed to load companies', err);
    }
  }

  async loadLedger(companyId: string) {
    this.selectedCompanyId.set(companyId);
    try {
      const data = await firstValueFrom(this.http.get<CompanyLedgerEntry[]>(`/api/v1/companies/${companyId}/ledger`));
      this.ledgerEntries.set(data);
    } catch (err: unknown) {
      console.error('Failed to load ledger', err);
    }
  }

  async runBillingCycle() {
    this.isBillingRunning.set(true);
    try {
      const response = await firstValueFrom(this.http.post<{ success: boolean; reports: BillingReport[] }>('/api/v1/companies/run-billing', {}));
      if (response && response.success) {
        this.billingReports.set(response.reports || []);
        this.hqState.addLog('Faturamento recorrente de assinaturas executado com sucesso.', 'success');
        await this.loadCompanies();
        await this.loadInvoices();
      }
    } catch (err: unknown) {
      console.error('Failed to run billing cycle', err);
      this.hqState.addLog('Falha ao rodar faturamento de assinaturas SaaS.', 'warn');
    } finally {
      this.isBillingRunning.set(false);
    }
  }
}
