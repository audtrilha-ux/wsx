import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Company } from '../../../../../core/domain/company/company.entity';

export interface CreditAdjustmentPayload {
  companyId: string;
  amount: number;
  description: string;
}

@Component({
  selector: 'app-tenant-credit-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <mat-icon class="text-sm">add_card</mat-icon>
            </div>
            <div>
              <h4 class="text-sm font-bold text-white uppercase tracking-wider">Adicionar Créditos</h4>
              <p class="text-[11px] text-slate-400 font-mono">{{ company().name }}</p>
            </div>
          </div>
          <button (click)="dismiss.emit()" class="text-slate-500 hover:text-white transition-colors">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          <!-- Current Balance Info -->
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
            <span class="text-xs text-slate-400 font-bold uppercase tracking-wider">Saldo Atual:</span>
            <span class="text-base font-mono font-bold" [ngClass]="company().balance < 0 ? 'text-rose-400' : 'text-emerald-400'">
              {{ company().balance | currency:'BRL' }}
            </span>
          </div>

          <!-- Quick Amount Presets -->
          <div>
            <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Valores Rápidos</span>
            <div class="grid grid-cols-4 gap-2">
              @for (preset of [100, 250, 500, 1000]; track preset) {
                <button type="button" (click)="amount.set(preset)"
                        class="py-2 px-1 rounded-lg border text-xs font-mono font-bold transition-all"
                        [ngClass]="amount() === preset ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'">
                  R$ {{ preset }}
                </button>
              }
            </div>
          </div>

          <!-- Custom Amount -->
          <div>
            <label for="credit-amount-input" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Valor do Crédito (R$) *
            </label>
            <input id="credit-amount-input" type="number" 
                   [value]="amount()"
                   (input)="onAmountInput($event)"
                   min="1" step="10"
                   class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white font-mono focus:border-indigo-500 outline-none">
          </div>

          <!-- Description / Motive -->
          <div>
            <label for="credit-desc-input" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Motivo / Observação da Recarga
            </label>
            <input id="credit-desc-input" type="text" 
                   [value]="description()"
                   (input)="onDescriptionInput($event)"
                   placeholder="Ex: Aporte via PIX Corporativo"
                   class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 outline-none">
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
          <button (click)="dismiss.emit()" class="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white text-xs font-bold uppercase transition-colors">
            Cancelar
          </button>
          <button (click)="submit()" [disabled]="amount() <= 0"
                  class="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors">
            <mat-icon class="text-sm">check_circle</mat-icon>
            Confirmar Recarga
          </button>
        </div>
      </div>
    </div>
  `
})
export class TenantCreditModalComponent {
  company = input.required<Company>();
  submitCredit = output<CreditAdjustmentPayload>();
  dismiss = output<void>();

  amount = signal(500);
  description = signal('Aporte via PIX Corporativo');

  onAmountInput(event: Event) {
    this.amount.set(Number((event.target as HTMLInputElement).value));
  }

  onDescriptionInput(event: Event) {
    this.description.set((event.target as HTMLInputElement).value);
  }

  submit() {
    if (this.amount() <= 0) return;
    this.submitCredit.emit({
      companyId: this.company().id,
      amount: this.amount(),
      description: this.description().trim() || 'Aporte de Créditos'
    });
  }
}
