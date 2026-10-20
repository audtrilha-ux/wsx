import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { 
  GetTransactionsUseCase, 
  CreateTransactionUseCase, 
  GetCashSummaryUseCase,
  GetActiveSessionUseCase,
  OpenSessionUseCase,
  CloseSessionUseCase,
  ConciliateSessionUseCase,
  GetAllSessionsUseCase
} from '../application/finance.usecases';
import { CashTransaction, CashSummary, CashSession } from '../domain/finance.entity';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { OsContext } from '../../../contracts/os/os-context.contract';
import { FinanceSummaryCardsComponent } from './components/finance-summary-cards.component';
import { FinanceTxModalComponent, NewTxPayload } from './components/finance-tx-modal.component';
import { FinanceSessionsComponent } from './components/finance-sessions.component';

@Component({
  selector: 'app-finance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, 
    MatIconModule, 
    FinanceSummaryCardsComponent, 
    FinanceTxModalComponent,
    FinanceSessionsComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-50 font-sans text-slate-800">
      <!-- Header Bar -->
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <mat-icon class="text-xl">account_balance_wallet</mat-icon>
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-900 leading-tight flex items-center gap-2">
              Fluxo de Caixa & Finanças
              <span class="text-[9px] font-mono uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Módulo OS</span>
            </h2>
            <p class="text-[11px] text-slate-500 font-medium">Controle de liquidez, conciliação e fechamento de turnos com emissão de Relatório Z térmico.</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          @if (activeSession()) {
            <button 
              (click)="printCashClosingReport()"
              class="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer">
              <mat-icon class="text-sm">receipt_long</mat-icon>
              Emitir Relatório Z (Parcial)
            </button>
            
            <button 
              (click)="showNewTxModal.set(true)"
              class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer">
              <mat-icon class="text-sm">add_circle</mat-icon>
              Nova Movimentação
            </button>
          } @else {
            <div class="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
              <mat-icon class="text-[16px]">lock</mat-icon>
              Caixa Fechado (Abra para lançar)
            </div>
          }
        </div>
      </header>

      <!-- Tab Selectors -->
      <div class="bg-white border-b border-slate-200 flex items-center px-6 shrink-0">
        <div class="flex border-b border-slate-100" role="tablist" aria-label="Navegação Financeira">
          <button
            role="tab"
            [aria-selected]="activeTab() === 'TRANSACTIONS'"
            (click)="activeTab.set('TRANSACTIONS')"
            [class]="activeTab() === 'TRANSACTIONS' 
              ? 'border-emerald-600 text-emerald-700 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-800'"
            class="px-4 py-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer">
            Extrato de Movimentações
          </button>
          <button
            role="tab"
            [aria-selected]="activeTab() === 'SESSIONS'"
            (click)="activeTab.set('SESSIONS')"
            [class]="activeTab() === 'SESSIONS' 
              ? 'border-emerald-600 text-emerald-700 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-800'"
            class="px-4 py-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer flex items-center gap-1.5">
            <mat-icon class="text-[16px]">vpn_key</mat-icon>
            Gestão de Turnos (Caixa)
          </button>
        </div>
      </div>

      <!-- Toast Feedback -->
      @if (feedbackMessage()) {
        <div class="bg-emerald-50 border-b border-emerald-200 px-6 py-2 text-xs text-emerald-900 flex items-center justify-between">
          <span class="flex items-center gap-2 font-medium">
            <mat-icon class="text-emerald-600 text-sm">info</mat-icon>
            {{ feedbackMessage() }}
          </span>
          <button (click)="feedbackMessage.set('')" class="text-emerald-700 font-bold hover:underline cursor-pointer">FECHAR</button>
        </div>
      }

      <!-- Main Content Container -->
      <div class="flex-1 overflow-y-auto p-6">
        
        @if (activeTab() === 'TRANSACTIONS') {
          <div class="space-y-6">
            <!-- Extracted KPI Cards & Payment Breakdown -->
            <app-finance-summary-cards [summary]="summary()" />

            <!-- Ledger History Section -->
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div class="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <h3 class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <mat-icon class="text-slate-500 text-base">format_list_bulleted</mat-icon>
                    Extrato de Movimentações (Turno Atual)
                  </h3>
                  <p class="text-[10px] text-slate-500">Histórico de lançamentos, vendas de balcão e saídas de caixa.</p>
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                  <!-- Filtro de Tipo -->
                  <div class="flex bg-slate-200/80 p-0.5 rounded-lg text-[10px] font-bold">
                    <button 
                      (click)="activeFilter.set('ALL')"
                      [class.bg-white]="activeFilter() === 'ALL'"
                      [class.shadow-xs]="activeFilter() === 'ALL'"
                      [class.text-slate-900]="activeFilter() === 'ALL'"
                      [class.text-slate-600]="activeFilter() !== 'ALL'"
                      class="px-2.5 py-1 rounded-md transition-all cursor-pointer">
                      Todos
                    </button>
                    <button 
                      (click)="activeFilter.set('INFLOW')"
                      [class.bg-white]="activeFilter() === 'INFLOW'"
                      [class.shadow-xs]="activeFilter() === 'INFLOW'"
                      [class.text-emerald-700]="activeFilter() === 'INFLOW'"
                      [class.text-slate-600]="activeFilter() !== 'INFLOW'"
                      class="px-2.5 py-1 rounded-md transition-all cursor-pointer">
                      Entradas
                    </button>
                    <button 
                      (click)="activeFilter.set('OUTFLOW')"
                      [class.bg-white]="activeFilter() === 'OUTFLOW'"
                      [class.shadow-xs]="activeFilter() === 'OUTFLOW'"
                      [class.text-rose-700]="activeFilter() === 'OUTFLOW'"
                      [class.text-slate-600]="activeFilter() !== 'OUTFLOW'"
                      class="px-2.5 py-1 rounded-md transition-all cursor-pointer">
                      Saídas
                    </button>
                    <button 
                      (click)="activeFilter.set('BLEED')"
                      [class.bg-white]="activeFilter() === 'BLEED'"
                      [class.shadow-xs]="activeFilter() === 'BLEED'"
                      [class.text-amber-700]="activeFilter() === 'BLEED'"
                      [class.text-slate-600]="activeFilter() !== 'BLEED'"
                      class="px-2.5 py-1 rounded-md transition-all cursor-pointer">
                      Sangrias
                    </button>
                  </div>

                  <!-- Input de Busca -->
                  <div class="relative">
                    <mat-icon class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">search</mat-icon>
                    <input 
                      type="text" 
                      [value]="searchQuery()" 
                      (input)="onSearchInput($event)"
                      placeholder="Filtrar lançamentos..." 
                      class="pl-7 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs w-44 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  </div>
                </div>
              </div>

              <!-- Tabela de Movimentações -->
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-600">
                  <thead class="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold tracking-wider text-[10px]">
                    <tr>
                      <th class="py-3 px-4">Data/Hora</th>
                      <th class="py-3 px-4">Tipo</th>
                      <th class="py-3 px-4">Categoria</th>
                      <th class="py-3 px-4">Descrição</th>
                      <th class="py-3 px-4">Operador</th>
                      <th class="py-3 px-4">Meio Pagto</th>
                      <th class="py-3 px-4 text-right">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    @if (filteredTransactions().length === 0) {
                      <tr>
                        <td colspan="7" class="py-8 text-center text-slate-400">
                          <mat-icon class="text-3xl mb-1 text-slate-300">search_off</mat-icon>
                          <p>Nenhuma movimentação encontrada para os filtros selecionados.</p>
                        </td>
                      </tr>
                    }
                    @for (tx of filteredTransactions(); track tx.id) {
                      <tr class="hover:bg-slate-50 transition-colors">
                        <td class="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {{ tx.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}
                        </td>
                        <td class="py-3 px-4">
                          @if (tx.isIncome()) {
                            <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <mat-icon class="text-[12px]">add_circle</mat-icon> ENTRADA
                            </span>
                          } @else {
                            <span class="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                              <mat-icon class="text-[12px]">remove_circle</mat-icon> SAÍDA
                            </span>
                          }
                        </td>
                        <td class="py-3 px-4">
                          @if (tx.category === 'BLEED') {
                            <span class="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 w-fit">
                              <mat-icon class="text-[12px]">lock_clock</mat-icon> Sangria
                            </span>
                          } @else if (tx.category === 'SUPPLY') {
                            <span class="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 w-fit">
                              <mat-icon class="text-[12px]">savings</mat-icon> Suprimento
                            </span>
                          } @else if (tx.category === 'SALE') {
                            <span class="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 w-fit">
                              <mat-icon class="text-[12px]">point_of_sale</mat-icon> Venda Balcão
                            </span>
                          } @else {
                            <span class="text-slate-600 font-medium bg-slate-100 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 w-fit">
                              <mat-icon class="text-[12px]">receipt</mat-icon> Despesa
                            </span>
                          }
                        </td>
                        <td class="py-3 px-4 font-semibold text-slate-900">
                          {{ tx.description }}
                        </td>
                        <td class="py-3 px-4 text-slate-500">
                          {{ tx.operator }}
                        </td>
                        <td class="py-3 px-4">
                          <span class="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-semibold">
                            {{ tx.paymentMethod }}
                          </span>
                        </td>
                        <td class="py-3 px-4 text-right font-bold font-mono"
                            [class.text-emerald-600]="tx.isIncome()"
                            [class.text-rose-600]="tx.isExpense()">
                          {{ tx.isIncome() ? '+' : '-' }} R$ {{ tx.amount | number:'1.2-2' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        } @else {
          <!-- CASH SESSIONS SCREEN -->
          <app-finance-sessions
            [activeSession]="activeSession()"
            [sessions]="sessions()"
            [activeInflowOutflowBalance]="activeInflowOutflowBalance()"
            (openRequested)="handleOpenSession($event)"
            (closeRequested)="handleCloseSession($event)"
            (conciliateRequested)="handleConciliateSession($event)">
          </app-finance-sessions>
        }

      </div>

      <!-- Extracted Modal: Nova Movimentação no Caixa -->
      @if (showNewTxModal()) {
        <app-finance-tx-modal
          [operatorName]="os.operatorName || 'Operador'"
          (closeModal)="showNewTxModal.set(false)"
          (save)="onSaveTransaction($event)" />
      }

    </div>
  `
})
export class FinanceComponent implements OnInit, OnDestroy {
  private getTransactionsUseCase = inject(GetTransactionsUseCase);
  private createTransactionUseCase = inject(CreateTransactionUseCase);
  private getCashSummaryUseCase = inject(GetCashSummaryUseCase);
  
  // Use cases para controle de turno
  private getActiveSessionUseCase = inject(GetActiveSessionUseCase);
  private openSessionUseCase = inject(OpenSessionUseCase);
  private closeSessionUseCase = inject(CloseSessionUseCase);
  private conciliateSessionUseCase = inject(ConciliateSessionUseCase);
  private getAllSessionsUseCase = inject(GetAllSessionsUseCase);

  private osSdk = inject(OsSdkService);
  os: OsContext = this.osSdk.bind('app_finance');

  private subs: { unsubscribe: () => void }[] = [];

  activeTab = signal<'TRANSACTIONS' | 'SESSIONS'>('TRANSACTIONS');
  transactions = signal<CashTransaction[]>([]);
  summary = signal<CashSummary | null>(null);
  feedbackMessage = signal<string>('');
  activeFilter = signal<'ALL' | 'INFLOW' | 'OUTFLOW' | 'BLEED' | 'SUPPLY'>('ALL');
  searchQuery = signal('');
  showNewTxModal = signal<boolean>(false);

  // Turno states
  activeSession = signal<CashSession | null>(null);
  sessions = signal<CashSession[]>([]);

  // Calculate dynamic delta of transactions that occurred strictly after the current session's opening time.
  activeInflowOutflowBalance = computed(() => {
    const session = this.activeSession();
    if (!session) return 0;
    const opTime = new Date(session.openingTime).getTime();
    
    // Filter transactions starting after openingTime
    const currentTxs = this.transactions().filter(t => new Date(t.timestamp).getTime() >= opTime);
    
    let balance = 0;
    for (const tx of currentTxs) {
      const amt = tx.amount;
      if (tx.isIncome()) {
        balance += amt;
      } else {
        balance -= amt;
      }
    }
    return balance;
  });

  filteredTransactions = computed(() => {
    let list = this.transactions();
    const filter = this.activeFilter();
    const query = this.searchQuery().toLowerCase().trim();

    if (filter === 'INFLOW') {
      list = list.filter(t => t.isIncome());
    } else if (filter === 'OUTFLOW') {
      list = list.filter(t => t.isExpense());
    } else if (filter === 'BLEED') {
      list = list.filter(t => t.category === 'BLEED');
    } else if (filter === 'SUPPLY') {
      list = list.filter(t => t.category === 'SUPPLY');
    }

    if (query) {
      list = list.filter(t => 
        t.description.toLowerCase().includes(query) || 
        t.operator.toLowerCase().includes(query) ||
        t.paymentMethod.toLowerCase().includes(query)
      );
    }

    return list;
  });

  async ngOnInit() {
    await this.loadFinanceData();

    // Reactively reload finance dashboard on any completed sale event in the OS
    this.subs.push(
      this.os.events.subscribe('sale.completed', () => {
        this.loadFinanceData();
      }),
      this.os.events.subscribe('finance.session.open', () => {
        this.loadFinanceData();
      }),
      this.os.events.subscribe('finance.session.close', () => {
        this.loadFinanceData();
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  async loadFinanceData() {
    try {
      const companyId = this.os.companyId;
      const [txs, sum, active, allSessions] = await Promise.all([
        this.getTransactionsUseCase.execute(companyId),
        this.getCashSummaryUseCase.execute(companyId),
        this.getActiveSessionUseCase.execute(companyId),
        this.getAllSessionsUseCase.execute(companyId)
      ]);
      this.transactions.set(txs);
      this.summary.set(sum);
      this.activeSession.set(active);
      this.sessions.set(allSessions);
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err);
    }
  }

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  async onSaveTransaction(payload: NewTxPayload) {
    try {
      const companyId = this.os.companyId;
      const opName = this.os.operatorName || 'Operador';
      
      await this.createTransactionUseCase.execute({
        companyId,
        type: payload.type,
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        paymentMethod: payload.paymentMethod,
        operator: opName
      });

      // Publish event to the OS EventBus so other apps (like Telegram Bot) can monitor in real-time
      this.os.events.publish('finance.transaction_created', {
        type: payload.type,
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        operator: opName
      }, 'app_finance');

      this.showNewTxModal.set(false);
      this.feedbackMessage.set(`Movimentação de R$ ${payload.amount.toFixed(2)} registrada com sucesso!`);
      await this.loadFinanceData();
    } catch (err) {
      console.error('Erro ao registrar transação:', err);
      this.feedbackMessage.set('Falha ao registrar movimentação.');
    }
  }

  async handleOpenSession(event: { operator: string; terminalId: string; openingBalance: number }) {
    try {
      await this.openSessionUseCase.execute(this.os.companyId, event.operator, event.terminalId, event.openingBalance);
      this.feedbackMessage.set(`Caixa aberto com sucesso para o operador ${event.operator}!`);
      await this.loadFinanceData();
    } catch (err: unknown) {
      this.feedbackMessage.set(`Erro ao abrir caixa: ${String(err)}`);
    }
  }

  async handleCloseSession(event: { sessionId: string; closingBalance: number; calculatedBalance: number }) {
    try {
      const closed = await this.closeSessionUseCase.execute(event.sessionId, event.closingBalance, event.calculatedBalance);
      
      // Emit printable receipt for physical cash closed
      await this.printPhysicalClosingReceipt(closed);

      this.feedbackMessage.set(`Turno de caixa encerrado com sucesso! Saldo Contado: R$ ${event.closingBalance.toFixed(2)}.`);
      await this.loadFinanceData();
    } catch (err: unknown) {
      this.feedbackMessage.set(`Erro ao fechar caixa: ${String(err)}`);
    }
  }

  async handleConciliateSession(sessionId: string) {
    try {
      await this.conciliateSessionUseCase.execute(sessionId);
      this.feedbackMessage.set('Sessão de caixa auditada e conciliada com sucesso pelo supervisor!');
      await this.loadFinanceData();
    } catch (err: unknown) {
      this.feedbackMessage.set(`Erro ao conciliar caixa: ${String(err)}`);
    }
  }

  async printPhysicalClosingReceipt(session: CashSession) {
    const diff = session.difference || 0;
    const diffText = diff === 0 
      ? 'CONFORMIDADE (SEM DIVERGÊNCIA)' 
      : diff > 0 
        ? `SOBRA DE CAIXA: +R$ ${diff.toFixed(2)}` 
        : `QUEBRA DE CAIXA (FALTA): R$ ${diff.toFixed(2)}`;

    const content = `
========================================
       3EATCRU OS - RECIBO DE FECHAMENTO
========================================
TERMINAL: ${session.terminalId}
OPERADOR: ${session.operator.toUpperCase()}
Abertura: ${new Date(session.openingTime).toLocaleString('pt-BR')}
Fechamento: ${new Date(session.closingTime!).toLocaleString('pt-BR')}
----------------------------------------
VALORES DE CONFERÊNCIA:
Troco Inicial:           R$ ${session.openingBalance.toFixed(2)}
Saldo Estimado (Faturamento): R$ ${session.calculatedBalance?.toFixed(2)}
Físico Contado em Gaveta:     R$ ${session.closingBalance?.toFixed(2)}
----------------------------------------
SITUAÇÃO DE AUDITORIA:
${diffText}
========================================
    `;
    try {
      await this.os.print(`Fechamento #${session.id.substring(8, 14)}`, content);
    } catch (e) {
      console.warn('Falha ao acionar spooler de impressora no fechamento:', e);
    }
  }

  async printCashClosingReport() {
    const sum = this.summary();
    const companyName = this.os.companyName;
    const dateStr = new Date().toLocaleString('pt-BR');

    const formattedContent = `
========================================
       3EATCRU OS - RELATÓRIO Z
      FECHAMENTO DE CAIXA / TURNO
========================================
EMPRESA: ${companyName.toUpperCase()}
TERMINAL: CAIXA PRINCIPAL 01
DATA/HORA: ${dateStr}
----------------------------------------
RESUMO DE MOVIMENTAÇÕES:
(+) TOTAL DE ENTRADAS:   R$ ${(sum?.totalInflow || 0).toFixed(2)}
(-) TOTAL DE SAÍDAS:     R$ ${(sum?.totalOutflow || 0).toFixed(2)}
----------------------------------------
SANGRIAS (COFRE):        R$ ${(sum?.totalBleed || 0).toFixed(2)}
SUPRIMENTOS (TROCO):     R$ ${(sum?.totalSupply || 0).toFixed(2)}
VENDAS REALIZADAS:       ${sum?.salesCount || 0} operacoes
----------------------------------------
DISTRIBUIÇÃO POR MEIO DE PAGTO:
- DINHEIRO:              R$ ${(sum?.breakdownByMethod?.dinheiro || 0).toFixed(2)}
- PIX:                   R$ ${(sum?.breakdownByMethod?.pix || 0).toFixed(2)}
- CARTÃO DE DÉBITO:      R$ ${(sum?.breakdownByMethod?.cartaoDebito || 0).toFixed(2)}
- CARTÃO DE CRÉDITO:     R$ ${(sum?.breakdownByMethod?.cartaoCredito || 0).toFixed(2)}
----------------------------------------
SALDO LÍQUIDO EM CAIXA:  R$ ${(sum?.currentCashBalance || 0).toFixed(2)}
========================================
ASSINATURA DO OPERADOR:
 
________________________________________
 
ASSINATURA DO GERENTE:
 
________________________________________
    `;

    try {
      await this.os.print('Fechamento de Caixa (Relatório Z)', formattedContent);
      this.feedbackMessage.set('Relatório Z de Fechamento de Caixa impresso na impressora térmica!');
      
      // Publish event to OS EventBus for manager alerts / telemetry
      this.os.events.publish('finance.shift_closed', {
        totalInflow: sum?.totalInflow || 0,
        totalOutflow: sum?.totalOutflow || 0,
        currentBalance: sum?.currentCashBalance || 0,
        salesCount: sum?.salesCount || 0,
        operator: this.os.operatorName || 'Operador'
      }, 'app_finance');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Falha na impressora';
      this.feedbackMessage.set(`Atenção: ${errMsg}. Verifique a impressora.`);
    }
  }
}
