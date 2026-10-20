import { Component, input, output, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DiningTable } from '../../domain/table.entity';

@Component({
  selector: 'app-table-checkout-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in-up animate-duration-200">
        
        <div class="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <mat-icon class="text-emerald-400">payments</mat-icon>
            <h3 class="text-sm font-bold">Fechar & Receber: {{ table().name }}</h3>
          </div>
          <button (click)="closeModal.emit()" class="text-slate-400 hover:text-white">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <div class="p-6 space-y-4">
          <!-- Total Card -->
          <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
            <span class="text-xs text-emerald-800 font-bold uppercase tracking-wider">Valor Total da Mesa</span>
            <div class="text-2xl font-bold font-mono text-emerald-900 mt-1">
              R$ {{ (table().currentOrder?.total || 0) | number:'1.2-2' }}
            </div>
            
            @if ((table().currentOrder?.paidAmount || 0) > 0) {
              <div class="mt-2 space-y-1 text-xs border-t border-emerald-100 pt-2 font-mono">
                <div class="flex justify-between text-emerald-700">
                  <span>Já pago:</span>
                  <span>R$ {{ (table().currentOrder?.paidAmount || 0) | number:'1.2-2' }}</span>
                </div>
                <div class="flex justify-between text-emerald-900 font-bold">
                  <span>Saldo Restante:</span>
                  <span>R$ {{ remaining() | number:'1.2-2' }}</span>
                </div>
              </div>
            } @else if ((table().currentOrder?.customerCount || 1) > 1) {
              <div class="text-xs text-emerald-700 font-mono mt-1 border-t border-emerald-100 pt-2">
                Dividido em {{ table().currentOrder?.customerCount }} pessoas: 
                <strong>R$ {{ (table().currentOrder?.perPersonTotal || 0) | number:'1.2-2' }}</strong> por pessoa
              </div>
            }
          </div>

          <!-- Payment Mode Toggle -->
          <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div class="flex flex-col">
              <span class="text-xs font-bold text-slate-800">Pagamento Parcial</span>
              <span class="text-[10px] text-slate-500">Registrar pagamento e manter a mesa ativa</span>
            </div>
            <button 
              type="button"
              (click)="togglePartial()"
              [class]="isPartial() ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'"
              class="w-12 h-6 flex items-center rounded-full p-0.5 transition-all duration-300 relative">
              <div 
                [class]="isPartial() ? 'translate-x-6' : 'translate-x-0'"
                class="bg-white w-5 h-5 rounded-full shadow-md transform transition-all duration-300"></div>
            </button>
          </div>

          <!-- Partial Payment Value -->
          @if (isPartial()) {
            <div class="space-y-1">
              <label for="partial-val" class="block text-xs font-bold text-slate-700">Valor do Pagamento Parcial (R$)</label>
              <input 
                id="partial-val"
                type="number" 
                step="0.01" 
                min="0.01" 
                [max]="remaining()"
                [value]="partialAmount()"
                (input)="onPartialAmountInput($event)"
                class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500">
            </div>
          }

          <!-- Payment Method Selection -->
          <div>
            <label for="close-payment-method" class="block text-xs font-bold text-slate-700 mb-1">Forma de Pagamento</label>
            <select 
              id="close-payment-method"
              [value]="paymentMethod()"
              (change)="onPaymentMethodChange($event)"
              class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="DINHEIRO">Dinheiro em Espécie</option>
              <option value="PIX">PIX Instantâneo</option>
              <option value="CARTAO_DEBITO">Cartão de Débito</option>
              <option value="CARTAO_CREDITO">Cartão de Crédito</option>
            </select>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button 
              (click)="closeModal.emit()"
              class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
            
            @if (isPartial()) {
              <button 
                (click)="onConfirmPartial()"
                [disabled]="partialAmount() <= 0 || partialAmount() > remaining()"
                class="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 rounded-lg transition-colors shadow-sm flex items-center gap-1">
                <mat-icon class="text-xs">payments</mat-icon> Confirmar R$ {{ partialAmount() | number:'1.2-2' }}
              </button>
            } @else {
              <button 
                (click)="onConfirm()"
                class="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm flex items-center gap-1">
                <mat-icon class="text-xs">check</mat-icon> Confirmar R$ {{ remaining() | number:'1.2-2' }} & Liberar
              </button>
            }
          </div>
        </div>

      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableCheckoutModalComponent {
  table = input.required<DiningTable>();

  closeModal = output<void>();
  confirm = output<string>();
  payPartial = output<{ amount: number; paymentMethod: string }>();

  paymentMethod = signal<string>('DINHEIRO');
  isPartial = signal<boolean>(false);
  partialAmount = signal<number>(0);

  remaining = computed(() => {
    const total = this.table().currentOrder?.total || 0;
    const paid = this.table().currentOrder?.paidAmount || 0;
    return Math.max(0, total - paid);
  });

  togglePartial() {
    this.isPartial.set(!this.isPartial());
    if (this.isPartial()) {
      // Default to split per-person or full remaining
      const count = this.table().currentOrder?.customerCount || 1;
      this.partialAmount.set(Number((this.remaining() / count).toFixed(2)));
    }
  }

  onPartialAmountInput(event: Event) {
    this.partialAmount.set(Number((event.target as HTMLInputElement).value));
  }

  onPaymentMethodChange(event: Event) {
    this.paymentMethod.set((event.target as HTMLSelectElement).value);
  }

  onConfirm() {
    this.confirm.emit(this.paymentMethod());
  }

  onConfirmPartial() {
    const amt = this.partialAmount();
    if (amt <= 0 || amt > this.remaining()) return;
    this.payPartial.emit({
      amount: amt,
      paymentMethod: this.paymentMethod()
    });
  }
}
