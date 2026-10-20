import { Component, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CashSession } from '../../domain/finance.entity';

@Component({
  selector: 'app-finance-sessions',
  standalone: true,
  imports: [CommonModule, MatIconModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      
      <!-- TOP BANNER: Active Session Status -->
      @if (activeSession()) {
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">CAIXA OPERANDO (ABERTO)</span>
              </div>
              <h3 class="text-base font-bold text-slate-900">Operado por {{ activeSession()?.operator }}</h3>
              <p class="text-xs text-slate-500 font-medium">
                Terminal: <strong class="text-slate-800">{{ activeSession()?.terminalId }}</strong> · 
                Aberto em: <strong class="text-slate-800">{{ activeSession()?.openingTime | date:'dd/MM/yyyy HH:mm:ss' }}</strong>
              </p>
            </div>

            <!-- Calculated Financials for current active session -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Abertura / Troco</p>
                <p class="text-sm font-bold text-slate-800 mt-1">{{ activeSession()?.openingBalance | currency:'BRL' }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lançado no Caixa</p>
                <p class="text-sm font-bold text-teal-600 mt-1">{{ activeInflowOutflowBalance() | currency:'BRL' }}</p>
              </div>
              <div class="col-span-2 sm:col-span-1">
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saldo Estimado</p>
                <p class="text-sm font-bold text-slate-950 mt-1">{{ calculatedBalance() | currency:'BRL' }}</p>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2 shrink-0">
              <button
                (click)="isCloseModalOpen.set(true)"
                class="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer">
                <mat-icon class="text-[16px]">lock_outline</mat-icon>
                Fechar Turno (Contagem)
              </button>
            </div>
          </div>
        </div>
      } @else {
        <!-- Caixa Fechado State -->
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center max-w-lg mx-auto">
          <div class="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <mat-icon class="text-2xl">lock</mat-icon>
          </div>
          <h3 class="text-sm font-bold text-slate-900">Caixa Fechado</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Nenhuma sessão de caixa ativa para esta filial. Abra o caixa para começar a registrar transações e vendas.
          </p>
          <button
            (click)="isOpenModalOpen.set(true)"
            class="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer">
            <mat-icon class="text-[16px]">vpn_key</mat-icon>
            Abrir Sessão de Caixa
          </button>
        </div>
      }

      <!-- PAST SESSIONS LIST -->
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-150 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 class="text-xs font-bold text-slate-900">Histórico de Fechamentos & Turnos</h3>
            <p class="text-[10px] text-slate-500">Histórico de conciliações e divergências de caixa.</p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th class="p-3.5">Terminal / Operador</th>
                <th class="p-3.5">Abertura ➔ Fechamento</th>
                <th class="p-3.5 text-right">Troco Inicial</th>
                <th class="p-3.5 text-right">Saldo Calculado</th>
                <th class="p-3.5 text-right">Saldo Informado</th>
                <th class="p-3.5 text-right">Divergência</th>
                <th class="p-3.5 text-center">Status</th>
                <th class="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              @for (session of sessions(); track session.id) {
                @if (session.status === 'closed') {
                  <tr class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td class="p-3.5 font-semibold text-slate-900">
                      {{ session.terminalId }}
                      <span class="block text-[10px] text-slate-500 font-normal">Operador: {{ session.operator }}</span>
                    </td>
                    <td class="p-3.5 text-slate-500 font-mono text-[10px] space-y-0.5">
                      <div>A: {{ session.openingTime | date:'dd/MM/yyyy HH:mm' }}</div>
                      <div>F: {{ session.closingTime | date:'dd/MM/yyyy HH:mm' }}</div>
                    </td>
                    <td class="p-3.5 text-right text-slate-600 font-medium">
                      {{ session.openingBalance | currency:'BRL' }}
                    </td>
                    <td class="p-3.5 text-right text-slate-600 font-medium">
                      {{ session.calculatedBalance | currency:'BRL' }}
                    </td>
                    <td class="p-3.5 text-right font-bold text-slate-900">
                      {{ session.closingBalance | currency:'BRL' }}
                    </td>
                    <td class="p-3.5 text-right font-bold">
                      @let diff = session.difference || 0;
                      @if (diff === 0) {
                        <span class="text-slate-500">R$ 0,00</span>
                      } @else if (diff > 0) {
                        <span class="text-emerald-600">+{{ diff | currency:'BRL' }} (Sobra)</span>
                      } @else {
                        <span class="text-rose-600">{{ diff | currency:'BRL' }} (Falta)</span>
                      }
                    </td>
                    <td class="p-3.5 text-center">
                      @if (session.conciliated) {
                        <span class="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                          <mat-icon class="text-[10px] w-2.5 h-2.5">verified</mat-icon> CONCILIADO
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          <mat-icon class="text-[10px] w-2.5 h-2.5">warning</mat-icon> PENDENTE
                        </span>
                      }
                    </td>
                    <td class="p-3.5 text-right">
                      @if (!session.conciliated) {
                        <button
                          (click)="conciliateRequested.emit(session.id)"
                          class="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer inline-flex items-center gap-0.5">
                          <mat-icon class="text-[11px]">gavel</mat-icon> Auditar
                        </button>
                      } @else {
                        <span class="text-[10px] text-slate-400 font-mono font-semibold">OK</span>
                      }
                    </td>
                  </tr>
                }
              }
              @if (sessions().filter(isClosedSession).length === 0) {
                <tr>
                  <td colspan="8" class="p-12 text-center text-slate-400">
                    <mat-icon class="text-3xl text-slate-300 mb-1">history</mat-icon>
                    <p class="text-xs">Nenhum turno de caixa encerrado localizado.</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- OPEN SESSION MODAL -->
      @if (isOpenModalOpen()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-in">
            <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 class="text-sm font-bold text-slate-900">Abertura de Caixa (Open Shift)</h3>
                <p class="text-[10px] text-slate-500 font-medium">Defina o operador e fundo de troco inicial.</p>
              </div>
              <button (click)="isOpenModalOpen.set(false)" class="text-slate-400 hover:text-slate-600 cursor-pointer">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="openForm" (ngSubmit)="onOpenSubmit()" class="p-5 space-y-4">
              <div>
                <label for="op-name" class="block text-xs font-bold text-slate-700 mb-1">Operador Responsável *</label>
                <input
                  id="op-name"
                  type="text"
                  formControlName="operator"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label for="term-id" class="block text-xs font-bold text-slate-700 mb-1">ID do Terminal / Ponto de Venda *</label>
                <input
                  id="term-id"
                  type="text"
                  formControlName="terminalId"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label for="open-balance" class="block text-xs font-bold text-slate-700 mb-1">Troco Inicial / Fundo de Caixa (R$) *</label>
                <input
                  id="open-balance"
                  type="number"
                  step="0.01"
                  min="0"
                  formControlName="openingBalance"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  (click)="isOpenModalOpen.set(false)"
                  class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="openForm.invalid"
                  class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1">
                  <mat-icon class="text-[16px]">lock_open</mat-icon>
                  Iniciar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- CLOSE SESSION MODAL -->
      @if (isCloseModalOpen()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-in">
            <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 class="text-sm font-bold text-slate-900">Encerramento & Contagem de Caixa</h3>
                <p class="text-[10px] text-slate-500 font-medium">Insira o saldo físico contado na gaveta de dinheiro.</p>
              </div>
              <button (click)="isCloseModalOpen.set(false)" class="text-slate-400 hover:text-slate-600 cursor-pointer">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="closeForm" (ngSubmit)="onCloseSubmit()" class="p-5 space-y-4">
              <!-- Meta Stats -->
              <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                <div class="flex justify-between text-slate-500">
                  <span>Troco Inicial (A):</span>
                  <span class="font-bold">{{ activeSession()?.openingBalance | currency:'BRL' }}</span>
                </div>
                <div class="flex justify-between text-slate-500">
                  <span>Lançamentos (B):</span>
                  <span class="font-bold">{{ activeInflowOutflowBalance() | currency:'BRL' }}</span>
                </div>
                <div class="flex justify-between text-slate-950 font-bold border-t border-slate-200 pt-1.5 mt-1.5">
                  <span>Saldo Estimado (A + B):</span>
                  <span>{{ calculatedBalance() | currency:'BRL' }}</span>
                </div>
              </div>

              <div>
                <label for="close-balance" class="block text-xs font-bold text-slate-700 mb-1">Saldo Físico Contado (R$) *</label>
                <input
                  id="close-balance"
                  type="number"
                  step="0.01"
                  min="0"
                  formControlName="closingBalance"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold text-lg"
                />
              </div>

              <!-- Live Divergence Preview -->
              @let entered = closeForm.get('closingBalance')?.value || 0;
              @let diffPreview = entered - calculatedBalance();
              <div class="flex items-center justify-between text-xs font-bold p-3 rounded-xl border"
                [class]="diffPreview === 0 
                  ? 'bg-slate-50 text-slate-600 border-slate-200' 
                  : diffPreview > 0 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border-rose-200'">
                <span>Divergência Estimada:</span>
                <span>
                  @if (diffPreview === 0) {
                    R$ 0,00 (Perfeito)
                  } @else if (diffPreview > 0) {
                    +{{ diffPreview | currency:'BRL' }} (Sobra)
                  } @else {
                    {{ diffPreview | currency:'BRL' }} (Falta / Quebra)
                  }
                </span>
              </div>

              <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  (click)="isCloseModalOpen.set(false)"
                  class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Voltar
                </button>
                <button
                  type="submit"
                  [disabled]="closeForm.invalid"
                  class="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1">
                  <mat-icon class="text-[16px]">lock</mat-icon>
                  Confirmar e Fechar Caixa
                </button>
              </div>
            </form>
          </div>
        </div>
      }

    </div>
  `
})
export class FinanceSessionsComponent {
  activeSession = input<CashSession | null>(null);
  sessions = input<CashSession[]>([]);
  activeInflowOutflowBalance = input<number>(0);

  openRequested = output<{ operator: string; terminalId: string; openingBalance: number }>();
  closeRequested = output<{ sessionId: string; closingBalance: number; calculatedBalance: number }>();
  conciliateRequested = output<string>();

  isCloseModalOpen = signal<boolean>(false);
  isOpenModalOpen = signal<boolean>(false);

  private fb = inject(FormBuilder);

  openForm: FormGroup = this.fb.group({
    operator: ['Operador Principal', [Validators.required, Validators.minLength(2)]],
    terminalId: ['CAIXA_01', [Validators.required, Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    openingBalance: [100.00, [Validators.required, Validators.min(0)]]
  });

  closeForm: FormGroup = this.fb.group({
    closingBalance: [0, [Validators.required, Validators.min(0)]]
  });

  calculatedBalance = computed(() => {
    const act = this.activeSession();
    if (!act) return 0;
    return act.openingBalance + this.activeInflowOutflowBalance();
  });

  isClosedSession(s: CashSession): boolean {
    return s.status === 'closed';
  }

  onOpenSubmit() {
    if (this.openForm.invalid) return;
    const v = this.openForm.value;
    this.openRequested.emit({
      operator: v.operator,
      terminalId: v.terminalId.toUpperCase(),
      openingBalance: Number(v.openingBalance)
    });
    this.isOpenModalOpen.set(false);
  }

  onCloseSubmit() {
    if (this.closeForm.invalid) return;
    const s = this.activeSession();
    if (!s) return;
    const v = this.closeForm.value;
    this.closeRequested.emit({
      sessionId: s.id,
      closingBalance: Number(v.closingBalance),
      calculatedBalance: this.calculatedBalance()
    });
    this.isCloseModalOpen.set(false);
    this.closeForm.reset({ closingBalance: 0 });
  }
}
