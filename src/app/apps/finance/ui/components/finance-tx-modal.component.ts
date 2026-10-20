import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TransactionType, TransactionCategory, PaymentMethod } from '../../domain/finance.entity';

export interface NewTxPayload {
  type: TransactionType;
  category: TransactionCategory;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

@Component({
  selector: 'app-finance-tx-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in-up">
        
        <div class="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <mat-icon class="text-emerald-400">payments</mat-icon>
            <h3 class="text-sm font-bold">Registrar Movimentação de Caixa</h3>
          </div>
          <button (click)="closeModal.emit()" class="text-slate-400 hover:text-white">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <form (submit)="onSubmit($event)" class="p-6 space-y-4">
          
          <!-- Tipo de Movimento -->
          <div>
            <label for="tx-type" class="block text-xs font-bold text-slate-700 mb-1">Tipo de Operação</label>
            <select 
              id="tx-type" 
              [value]="txType()" 
              name="type"
              (change)="onTypeChange($event)"
              class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="CASH_IN">Suprimento de Caixa (Entrada / Troco)</option>
              <option value="CASH_OUT">Sangria de Caixa (Retirada de Segurança)</option>
              <option value="INFLOW">Entrada / Receita Operacional</option>
              <option value="OUTFLOW">Saída / Despesa Operacional</option>
            </select>
          </div>

          <!-- Descrição -->
          <div>
            <label for="tx-desc" class="block text-xs font-bold text-slate-700 mb-1">Descrição / Motivo</label>
            <input 
              id="tx-desc"
              [value]="txDesc()" 
              (input)="onDescInput($event)"
              name="description" 
              type="text" 
              required
              placeholder="Ex: Fundo de troco da manhã, Sangria cofre, Compra descartáveis..."
              class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <!-- Valor -->
            <div>
              <label for="tx-amount" class="block text-xs font-bold text-slate-700 mb-1">Valor (R$)</label>
              <input 
                id="tx-amount"
                [value]="txAmount() ?? ''" 
                (input)="onAmountInput($event)"
                name="amount" 
                type="number" 
                step="0.01" 
                min="0.01" 
                required
                placeholder="0.00"
                class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500">
            </div>

            <!-- Forma de Pagamento -->
            <div>
              <label for="tx-method" class="block text-xs font-bold text-slate-700 mb-1">Forma Pagto</label>
              <select 
                id="tx-method" 
                [value]="txPaymentMethod()" 
                (change)="onMethodChange($event)"
                name="paymentMethod"
                class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="DINHEIRO">Dinheiro (Espécie)</option>
                <option value="PIX">PIX</option>
                <option value="CARTAO_DEBITO">Cartão de Débito</option>
                <option value="CARTAO_CREDITO">Cartão de Crédito</option>
              </select>
            </div>
          </div>

          <!-- Operador -->
          <div>
            <label for="tx-operator" class="block text-xs font-bold text-slate-700 mb-1">Nome do Operador</label>
            <input 
              id="tx-operator"
              [value]="operatorName()" 
              name="operator" 
              type="text" 
              readonly
              class="w-full text-xs p-2.5 bg-slate-100 border border-slate-300 rounded-lg text-slate-500 cursor-not-allowed">
          </div>

          <!-- Buttons -->
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button 
              type="button"
              (click)="closeModal.emit()"
              class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button 
              type="submit"
              class="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm">
              Salvar Movimentação
            </button>
          </div>

        </form>

      </div>
    </div>
  `
})
export class FinanceTxModalComponent {
  operatorName = input<string>('Operador');
  closeModal = output<void>();
  save = output<NewTxPayload>();

  txType = signal<TransactionType>('CASH_IN');
  txCategory = signal<TransactionCategory>('SUPPLY');
  txDesc = signal('Fundo de Troco / Suprimento Inicial');
  txAmount = signal<number | null>(100.00);
  txPaymentMethod = signal<PaymentMethod>('DINHEIRO');

  onTypeChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value as TransactionType;
    this.txType.set(val);
    if (val === 'CASH_IN') {
      this.txCategory.set('SUPPLY');
      this.txDesc.set('Fundo de Troco / Suprimento');
    } else if (val === 'CASH_OUT') {
      this.txCategory.set('BLEED');
      this.txDesc.set('Sangria de Caixa / Recolhimento para Cofre');
    } else if (val === 'INFLOW') {
      this.txCategory.set('OTHER');
      this.txDesc.set('Receita Extraordinária');
    } else {
      this.txCategory.set('EXPENSE');
      this.txDesc.set('Despesa Operacional Local');
    }
  }

  onDescInput(event: Event) {
    this.txDesc.set((event.target as HTMLInputElement).value);
  }

  onAmountInput(event: Event) {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.txAmount.set(isNaN(val) ? null : val);
  }

  onMethodChange(event: Event) {
    this.txPaymentMethod.set((event.target as HTMLSelectElement).value as PaymentMethod);
  }

  onSubmit(event: Event) {
    event.preventDefault();
    const amount = this.txAmount();
    if (!amount || amount <= 0) return;

    this.save.emit({
      type: this.txType(),
      category: this.txCategory(),
      description: this.txDesc().trim() || 'Movimentação sem descrição',
      amount,
      paymentMethod: this.txPaymentMethod()
    });
  }
}
