import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GetCustomersUseCase, CreateCustomerUseCase } from '../application/crm.usecases';
import { Customer } from '../domain/customer.entity';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { OsContext } from '../../../contracts/os/os-context.contract';
import { OsEvent } from '../../../contracts/events/events.contract';

export interface LoyaltyFeedItem {
  id: string;
  customerName: string;
  points: number;
  action: string;
  timestamp: Date;
}

export interface CustomerUpdatedPayload {
  customerId?: string;
  earnedPoints?: number;
  action?: string;
}

@Component({
  selector: 'app-crm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col bg-slate-50 font-sans text-slate-800">
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm">
            <mat-icon class="text-xl">loyalty</mat-icon>
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-900 leading-tight flex items-center gap-2">
              CRM & Clube de Fidelidade
              <span class="text-[10px] font-mono uppercase bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">Módulo OS</span>
            </h2>
            <p class="text-xs text-slate-500">Gestão de clientes, histórico de relacionamento e pontuação de cashback.</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button 
            (click)="showSimulationModal.set(true)"
            class="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm border border-slate-700 cursor-pointer">
            <mat-icon class="text-sm text-violet-400">auto_fix_high</mat-icon>
            Simular Clientes
          </button>
          <button 
            (click)="showNewCustomerModal.set(true)"
            class="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer">
            <mat-icon class="text-sm">person_add</mat-icon>
            Novo Cliente
          </button>
        </div>
      </header>

      @if (feedbackMessage()) {
        <div class="bg-violet-50 border-b border-violet-200 px-6 py-2 text-xs text-violet-900 flex items-center justify-between">
          <span class="flex items-center gap-2 font-medium">
            <mat-icon class="text-violet-600 text-sm">info</mat-icon>
            {{ feedbackMessage() }}
          </span>
          <button (click)="feedbackMessage.set('')" class="text-violet-700 font-bold hover:underline">FECHAR</button>
        </div>
      }

      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <mat-icon class="text-2xl">groups</mat-icon>
            </div>
            <div>
              <span class="text-xs text-slate-500 block">Clientes Ativos</span>
              <span class="text-xl font-bold text-slate-900">{{ customers().length }}</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <mat-icon class="text-2xl">stars</mat-icon>
            </div>
            <div>
              <span class="text-xs text-slate-500 block">Pontos em Circulação</span>
              <span class="text-xl font-bold text-amber-600">{{ totalPoints() }} pts</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <mat-icon class="text-2xl">workspace_premium</mat-icon>
            </div>
            <div>
              <span class="text-xs text-slate-500 block">Clientes VIP & Gold</span>
              <span class="text-xl font-bold text-emerald-600">{{ vipCount() }}</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <mat-icon class="text-2xl">payments</mat-icon>
            </div>
            <div>
              <span class="text-xs text-slate-500 block">Consumo Acumulado</span>
              <span class="text-xl font-bold text-slate-900">R$ {{ totalSpent() | number:'1.2-2' }}</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-8 space-y-4">
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="relative w-full sm:w-80">
                <mat-icon class="absolute left-3 top-2.5 text-slate-400 text-sm">search</mat-icon>
                <input 
                  id="crm-search-input"
                  type="text" 
                  [value]="searchQuery()"
                  (input)="onSearchInput($event)"
                  placeholder="Buscar por nome ou telefone..." 
                  class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 font-sans">
              </div>

              <div class="flex items-center gap-2 w-full sm:w-auto">
                <label for="tier-filter-select" class="text-xs text-slate-500 whitespace-nowrap">Filtrar Categoria:</label>
                <select 
                  id="tier-filter-select"
                  [value]="selectedTierFilter()"
                  (change)="onTierFilterChange($event)"
                  class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="ALL">Todas as Categorias</option>
                  <option value="Bronze">Bronze (Iniciante)</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              @for (c of filteredCustomers(); track c.id) {
                <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
                  <div>
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <h3 class="font-bold text-slate-900 text-sm">{{ c.name }}</h3>
                        <span class="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <mat-icon class="text-[14px]">phone</mat-icon>
                          {{ c.phone }}
                        </span>
                        @if (c.email) {
                          <span class="text-[11px] text-slate-400 block mt-0.5 truncate">{{ c.email }}</span>
                        }
                      </div>
                      <span 
                        [class]="'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono shrink-0 ' + getTierBadgeClass(c.tier)">
                        ★ {{ c.tier }}
                      </span>
                    </div>

                    <div class="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span class="text-slate-400 text-[11px] block">Saldo Fidelidade</span>
                        <span class="font-bold text-violet-700 text-sm">{{ c.points }} pts</span>
                      </div>
                      <div>
                        <span class="text-slate-400 text-[11px] block">Total Consumido</span>
                        <span class="font-bold text-slate-800 text-sm">R$ {{ c.totalSpent | number:'1.2-2' }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button 
                      (click)="printLoyaltyCard(c)"
                      class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      title="Imprimir Extrato Térmico">
                      <mat-icon class="text-[16px] text-slate-500">receipt</mat-icon>
                      Extrato Impresso
                    </button>
                  </div>
                </div>
              }

              @if (filteredCustomers().length === 0) {
                <div class="col-span-full bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  <mat-icon class="text-4xl text-slate-300 mb-2">person_search</mat-icon>
                  <p class="text-sm font-medium">Nenhum cliente encontrado com os filtros selecionados.</p>
                </div>
              }
            </div>
          </div>

          <div class="lg:col-span-4 space-y-6">
            <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <mat-icon class="text-violet-600 text-sm">campaign</mat-icon>
                Regras de Pontuação Ativas
              </h3>
              <p class="text-[11px] text-slate-500">Configurações de campanhas e acúmulo de pontos no ecossistema.</p>
              
              <div class="space-y-3 pt-1">
                <div class="p-3 bg-violet-50/50 rounded-lg border border-violet-100 flex items-start gap-2.5">
                  <mat-icon class="text-violet-600 text-sm mt-0.5">stars</mat-icon>
                  <div>
                    <h4 class="text-xs font-bold text-slate-800">Regra Geral de Cashback</h4>
                    <p class="text-[10px] text-slate-500 mt-0.5">A cada R$ 10,00 gastos ganha-se 1 ponto.</p>
                    <span class="inline-block px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[8px] font-bold uppercase mt-1">ATIVA</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                  </span>
                  Pulso de Fidelidade ao Vivo
                </h3>
              </div>
              <p class="text-[11px] text-slate-500">Eventos em tempo real.</p>
              <div class="space-y-3 max-h-[300px] overflow-y-auto pt-1 divide-y divide-slate-100">
                @for (item of loyaltyFeed(); track item.id) {
                  <div class="pt-3 first:pt-0 flex items-start justify-between gap-2.5 text-xs">
                    <div>
                      <h4 class="font-bold text-slate-800 leading-tight">{{ item.customerName }}</h4>
                      <p class="text-[10px] text-slate-500 mt-0.5 font-medium">{{ item.action }}</p>
                    </div>
                    <span class="text-xs font-black text-emerald-600 font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">
                      +{{ item.points }} pts
                    </span>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Novo Cliente -->
      @if (showNewCustomerModal()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <mat-icon class="text-violet-600 text-lg">person_add</mat-icon>
                <h3 class="text-sm font-bold text-slate-900">Novo Cliente</h3>
              </div>
              <button (click)="showNewCustomerModal.set(false)" class="text-slate-400 hover:text-slate-600 cursor-pointer">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">
                  <span>Nome Completo *</span>
                  <input 
                    type="text" 
                    [value]="newName()" 
                    (input)="onNewNameInput($event)"
                    placeholder="Ex: João da Silva" 
                    class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 font-sans" />
                </label>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">
                  <span>Telefone / WhatsApp *</span>
                  <input 
                    type="text" 
                    [value]="newPhone()" 
                    (input)="onNewPhoneInput($event)"
                    placeholder="Ex: (43) 99999-8888" 
                    class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 font-sans" />
                </label>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">
                  <span>E-mail</span>
                  <input 
                    type="email" 
                    [value]="newEmail()" 
                    (input)="onNewEmailInput($event)"
                    placeholder="Ex: joao@email.com" 
                    class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 font-sans" />
                </label>
              </div>
            </div>
            <div class="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button 
                (click)="showNewCustomerModal.set(false)"
                class="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium cursor-pointer">
                Cancelar
              </button>
              <button 
                (click)="saveNewCustomer()"
                [disabled]="isSaving() || !newName().trim() || !newPhone().trim()"
                class="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer">
                @if (isSaving()) {
                  <mat-icon class="text-sm animate-spin">refresh</mat-icon>
                } @else {
                  <mat-icon class="text-sm">check</mat-icon>
                }
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal Simulador de Clientes (Sandbox) -->
      @if (showSimulationModal()) {
        <div class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-300 flex items-center justify-center border border-violet-500/30">
                  <mat-icon class="text-base">auto_fix_high</mat-icon>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    Simulador de Clientes & Fidelidade
                    <span class="text-[9px] font-mono uppercase bg-violet-400/20 text-violet-300 px-1.5 py-0.5 rounded border border-violet-400/30 font-bold">Sandbox</span>
                  </h3>
                  <p class="text-[11px] text-slate-400">Povoamento e simulação de consumo, cashback e resgate.</p>
                </div>
              </div>
              <button (click)="showSimulationModal.set(false)" class="text-slate-400 hover:text-white cursor-pointer">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>

            <!-- Body -->
            <div class="p-6 overflow-y-auto space-y-5 flex-1">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <!-- Action 1: Seed -->
                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/70 transition-colors flex flex-col justify-between space-y-3">
                  <div>
                    <div class="flex items-center gap-2 text-violet-700 font-bold text-xs">
                      <mat-icon class="text-sm">groups</mat-icon>
                      1. Gerar Personas de Clientes
                    </div>
                    <p class="text-[11px] text-slate-500 mt-1">
                      Cadastra 5 perfis (Mariana, Dr. Roberto, Camila, Lucas, Studio Alfa) com categorias e pontuações variadas.
                    </p>
                  </div>
                  <button 
                    (click)="runSimulation('seed')"
                    [disabled]="isSimulating()"
                    class="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
                    <mat-icon class="text-xs">person_add_alt</mat-icon>
                    Povoar Personas
                  </button>
                </div>

                <!-- Action 2: Purchase with Cashback -->
                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/70 transition-colors flex flex-col justify-between space-y-3">
                  <div>
                    <div class="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                      <mat-icon class="text-sm">shopping_bag</mat-icon>
                      2. Simular Compra com Cashback
                    </div>
                    <p class="text-[11px] text-slate-500 mt-1">
                      Simula uma venda real para cliente. Deduz estoque, gera caixa e credita pontos (+1 pt / R$ 10).
                    </p>
                  </div>
                  <button 
                    (click)="runSimulation('purchase')"
                    [disabled]="isSimulating()"
                    class="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
                    <mat-icon class="text-xs">add_shopping_cart</mat-icon>
                    Simular Compra (+Pts)
                  </button>
                </div>

                <!-- Action 3: Point Redemption -->
                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/70 transition-colors flex flex-col justify-between space-y-3">
                  <div>
                    <div class="flex items-center gap-2 text-amber-700 font-bold text-xs">
                      <mat-icon class="text-sm">redeem</mat-icon>
                      3. Simular Resgate de Pontos
                    </div>
                    <p class="text-[11px] text-slate-500 mt-1">
                      Aplica resgate de pontos na compra (ex: 40 pts = R$ 20 de desconto). Deduz pontos e emite comprovante.
                    </p>
                  </div>
                  <button 
                    (click)="runSimulation('redeem')"
                    [disabled]="isSimulating()"
                    class="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
                    <mat-icon class="text-xs">price_check</mat-icon>
                    Simular Resgate (-Pts)
                  </button>
                </div>

                <!-- Action 4: Full Pipeline -->
                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/70 transition-colors flex flex-col justify-between space-y-3">
                  <div>
                    <div class="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                      <mat-icon class="text-sm">bolt</mat-icon>
                      4. Ciclo Completo (1-Clique)
                    </div>
                    <p class="text-[11px] text-slate-500 mt-1">
                      Executa todo o pipeline: povoamento, vendas, acúmulo de pontos e resgate em uma única transação atômica.
                    </p>
                  </div>
                  <button 
                    (click)="runSimulation('full')"
                    [disabled]="isSimulating()"
                    class="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
                    <mat-icon class="text-xs">play_arrow</mat-icon>
                    Executar Tudo
                  </button>
                </div>
              </div>

              <!-- Telemetry / Live Execution Log -->
              <div class="bg-slate-950 rounded-xl p-4 font-mono text-[11px] text-slate-300 border border-slate-800 space-y-2">
                <div class="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2 text-[10px]">
                  <span class="flex items-center gap-1.5 uppercase font-bold tracking-wider">
                    <span class="w-2 h-2 rounded-full" [class]="isSimulating() ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'"></span>
                    Console de Telemetria da Simulação
                  </span>
                  <span>{{ simulationLogs().length }} eventos</span>
                </div>
                <div class="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  @if (simulationLogs().length === 0) {
                    <p class="text-slate-500 italic py-2">Pronto para simular. Selecione uma ação acima.</p>
                  }
                  @for (log of simulationLogs(); track $index) {
                    <div class="flex items-start gap-2 leading-relaxed">
                      <span class="text-violet-400 font-semibold shrink-0">[{{ log.step }}]</span>
                      <span [class]="log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-400'" class="font-bold shrink-0">
                        {{ log.action }}:
                      </span>
                      <span class="text-slate-300">{{ log.details }}</span>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span class="text-xs text-slate-500">
                Empresa: <strong class="text-slate-800">{{ os.companyName }}</strong>
              </span>
              <button 
                (click)="showSimulationModal.set(false)"
                class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg cursor-pointer">
                Fechar
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class CrmComponent implements OnInit, OnDestroy {
  private getCustomersUseCase = inject(GetCustomersUseCase);
  private createCustomerUseCase = inject(CreateCustomerUseCase);
  private osSdk = inject(OsSdkService);
  os: OsContext = this.osSdk.bind('app_crm');

  customers = signal<Customer[]>([]);
  searchQuery = signal<string>('');
  selectedTierFilter = signal<string>('ALL');
  feedbackMessage = signal<string>('');

  showNewCustomerModal = signal<boolean>(false);
  showSimulationModal = signal<boolean>(false);
  isSimulating = signal<boolean>(false);
  simulationLogs = signal<{ step: string; action: string; status: string; details: string }[]>([]);
  newName = signal<string>('');
  newPhone = signal<string>('');
  newEmail = signal<string>('');
  isSaving = signal<boolean>(false);

  loyaltyFeed = signal<LoyaltyFeedItem[]>([
    {
      id: 'lf_init_1',
      customerName: 'Renato Guimarães',
      points: 10,
      action: 'Compra iFood #8491',
      timestamp: new Date(Date.now() - 5 * 60000)
    },
    {
      id: 'lf_init_2',
      customerName: 'Fernanda Montenegro',
      points: 4,
      action: 'Compra no PDV Presencial',
      timestamp: new Date(Date.now() - 25 * 60000)
    }
  ]);

  private subs: { unsubscribe: () => void }[] = [];

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  onTierFilterChange(event: Event) {
    this.selectedTierFilter.set((event.target as HTMLSelectElement).value);
  }

  onNewNameInput(event: Event) {
    this.newName.set((event.target as HTMLInputElement).value);
  }

  onNewPhoneInput(event: Event) {
    this.newPhone.set((event.target as HTMLInputElement).value);
  }

  onNewEmailInput(event: Event) {
    this.newEmail.set((event.target as HTMLInputElement).value);
  }

  totalPoints = computed(() => this.customers().reduce((sum, c) => sum + c.points, 0));
  totalSpent = computed(() => this.customers().reduce((sum, c) => sum + c.totalSpent, 0));
  vipCount = computed(() => this.customers().filter(c => c.tier === 'VIP' || c.tier === 'Gold').length);

  filteredCustomers = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const tier = this.selectedTierFilter();

    return this.customers().filter(c => {
      const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
      const matchesTier = tier === 'ALL' || c.tier === tier;
      return matchesQuery && matchesTier;
    });
  });

  async ngOnInit() {
    await this.loadCustomers();

    this.subs.push(
      this.os.events.subscribe<CustomerUpdatedPayload>('crm.customer_updated', (evt: OsEvent<CustomerUpdatedPayload>) => {
        const payload = evt.payload;
        if (payload?.customerId) {
          const targetCustomerId = payload.customerId;
          this.loadCustomers().then(() => {
            const customer = this.customers().find(c => c.id === targetCustomerId);
            if (customer) {
              const actionText = payload.earnedPoints 
                ? `Acúmulo de +${payload.earnedPoints} pts (${payload.action || 'Venda'})`
                : 'Atualização de Cadastro';

              this.loyaltyFeed.update(feed => [
                {
                  id: `lf_${Date.now()}`,
                  customerName: customer.name,
                  points: payload.earnedPoints || 0,
                  action: actionText,
                  timestamp: new Date()
                },
                ...feed.slice(0, 9)
              ]);
            }
          });
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  async loadCustomers() {
    try {
      const data = await this.getCustomersUseCase.execute(this.os.companyId);
      this.customers.set(data);
    } catch (e: unknown) {
      console.error('Failed to load customers', e);
    }
  }

  async saveNewCustomer() {
    if (!this.newName().trim() || !this.newPhone().trim()) return;

    this.isSaving.set(true);
    try {
      const created = await this.createCustomerUseCase.execute({
        companyId: this.os.companyId,
        name: this.newName().trim(),
        phone: this.newPhone().trim(),
        email: this.newEmail().trim()
      });

      this.customers.update(list => [...list, created]);
      this.feedbackMessage.set(`Cliente "${created.name}" cadastrado.`);
      
      this.loyaltyFeed.update(feed => [
        {
          id: `lf_${Date.now()}`,
          customerName: created.name,
          points: 15,
          action: 'Cadastro Efetuado (Bônus Boas-vindas)',
          timestamp: new Date()
        },
        ...feed
      ]);

      this.newName.set('');
      this.newPhone.set('');
      this.newEmail.set('');
      this.showNewCustomerModal.set(false);
    } catch {
      this.feedbackMessage.set('Erro ao cadastrar cliente.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async printLoyaltyCard(customer: Customer) {
    try {
      await this.os.print(`Extrato Fidelidade - ${customer.name}`, 
`========================================
       ${this.os.companyName.toUpperCase()}
     CLUBE DE FIDELIDADE & CASHBACK
========================================
DATA: ${new Date().toLocaleString('pt-BR')}
CLIENTE: ${customer.name.toUpperCase()}
TELEFONE: ${customer.phone}
CATEGORIA: ★ ${customer.tier.toUpperCase()}
----------------------------------------
SALDO ATUAL: ${customer.points} PONTOS
CONSUMO HISTÓRICO: R$ ${customer.totalSpent.toFixed(2)}
----------------------------------------
* A cada R$ 10 em compras acumule 1 ponto!
* Resgate pontos em descontos no caixa.
========================================
       Obrigado pela preferência!
========================================`);
      this.feedbackMessage.set(`Extrato do cliente ${customer.name} impresso.`);
    } catch (err: unknown) {
      this.feedbackMessage.set(`Aviso da Impressora: ${err instanceof Error ? err.message : 'offline'}`);
    }
  }

  getTierBadgeClass(tier: string): string {
    if (tier === 'Bronze') return 'bg-amber-100 text-amber-800 border border-amber-300';
    if (tier === 'Silver') return 'bg-slate-200 text-slate-800 border border-slate-300';
    if (tier === 'Gold') return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    if (tier === 'VIP') return 'bg-purple-100 text-purple-900 border border-purple-300';
    return 'bg-slate-100 text-slate-700 border border-slate-200';
  }

  async runSimulation(action: 'seed' | 'purchase' | 'redeem' | 'full') {
    this.isSimulating.set(true);
    try {
      const response = await fetch('/api/v1/simulation/customers/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: this.os.companyId,
          action
        })
      });

      if (!response.ok) {
        throw new Error(`Servidor retornou status ${response.status}`);
      }

      const result = await response.json() as {
        success: boolean;
        logs: { step: string; action: string; status: string; details: string }[];
        customers: Customer[];
        transactions: {
          loyaltyAdjustments: { customerId: string; customerName: string; change: number; newTotal: number; reason: string }[];
        };
      };

      if (result.success) {
        this.simulationLogs.set(result.logs || []);
        
        // Atualiza a lista local de clientes
        if (result.customers && result.customers.length > 0) {
          this.customers.set(result.customers);
          for (const c of result.customers) {
            await this.os.storage.put(c.id, c);
          }
        }

        // Adiciona ajustes ao feed de fidelidade
        if (result.transactions?.loyaltyAdjustments) {
          for (const adj of result.transactions.loyaltyAdjustments) {
            this.loyaltyFeed.update(feed => [
              {
                id: `lf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                customerName: adj.customerName,
                points: Math.abs(adj.change),
                action: adj.reason,
                timestamp: new Date()
              },
              ...feed
            ]);
          }
        }

        const actionLabels: Record<string, string> = {
          seed: '5 Personas de clientes criadas com sucesso!',
          purchase: 'Compra simulada no PDV com crédito de cashback!',
          redeem: 'Resgate de pontos simulado com desconto na venda!',
          full: 'Ciclo completo de clientes (Povoamento + Compras + Resgate) executado!'
        };

        this.feedbackMessage.set(actionLabels[action] || 'Simulação concluída com sucesso.');
        this.os.notify('Simulação de Clientes', actionLabels[action] || 'Concluído', 'success');
      } else {
        this.feedbackMessage.set('Aviso: Falha na execução da simulação.');
      }
    } catch (err: unknown) {
      console.error('Falha ao simular clientes:', err);
      this.feedbackMessage.set(`Erro na simulação: ${err instanceof Error ? err.message : 'desconhecido'}`);
    } finally {
      this.isSimulating.set(false);
    }
  }
}
