import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { InventoryItem } from '../../domain/inventory.entity';

@Component({
  selector: 'app-inventory-adjust-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (item(); as it) {
      <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-in">
          <!-- Header -->
          <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h3 class="text-sm font-bold text-slate-900">Ajuste de Estoque</h3>
              <p class="text-xs text-slate-500 font-mono mt-0.5">{{ it.sku }} · {{ it.name }}</p>
            </div>
            <button
              (click)="closed.emit()"
              class="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer">
              <mat-icon class="text-[18px]">close</mat-icon>
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 space-y-4">
            <!-- Current Stock Summary -->
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span class="text-slate-500 font-medium">Estoque Atual:</span>
              <span class="font-bold text-slate-900">{{ it.stockQuantity }} {{ it.unit }}</span>
            </div>

            <!-- Type Selector -->
            <div>
              <span class="block text-xs font-bold text-slate-700 mb-1.5">Tipo de Movimentação</span>
              <div class="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de Movimentação">
                <button
                  type="button"
                  (click)="adjustType.set('IN')"
                  [class]="adjustType() === 'IN'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600'"
                  class="border rounded-xl p-2.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                  <mat-icon class="text-[18px]">add_circle</mat-icon>
                  Entrada (Reposição)
                </button>
                <button
                  type="button"
                  (click)="adjustType.set('OUT')"
                  [class]="adjustType() === 'OUT'
                    ? 'bg-rose-50 border-rose-500 text-rose-700 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600'"
                  class="border rounded-xl p-2.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                  <mat-icon class="text-[18px]">remove_circle</mat-icon>
                  Saída (Perda / Ajuste)
                </button>
              </div>
            </div>

            <!-- Quantity Input -->
            <div>
              <label for="adjust-qty" class="block text-xs font-bold text-slate-700 mb-1.5">Quantidade a Movimentar</label>
              <input
                id="adjust-qty"
                type="number"
                min="1"
                [value]="quantity()"
                (input)="onQuantityInput($event)"
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <!-- Reason Input -->
            <div>
              <label for="adjust-reason" class="block text-xs font-bold text-slate-700 mb-1.5">Motivo / Justificativa</label>
              <input
                id="adjust-reason"
                type="text"
                [value]="reason()"
                (input)="onReasonInput($event)"
                placeholder="Ex: Chegada de NF-e, Inventário Físico..."
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <!-- New Projected Stock -->
            <div class="p-3 bg-teal-50/70 rounded-xl border border-teal-200 flex items-center justify-between text-xs text-teal-900">
              <span class="font-medium">Novo Estoque Calculado:</span>
              <span class="font-bold text-sm">
                {{ calculateNewStock(it.stockQuantity) }} {{ it.unit }}
              </span>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
            <button
              (click)="closed.emit()"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer">
              Cancelar
            </button>
            <button
              [disabled]="quantity() <= 0"
              (click)="confirmAdjustment()"
              class="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5">
              <mat-icon class="text-[16px]">check</mat-icon>
              Confirmar Ajuste
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class InventoryAdjustModalComponent {
  item = input<InventoryItem | null>(null);
  closed = output<void>();
  adjusted = output<{ itemId: string; delta: number; reason: string }>();

  adjustType = signal<'IN' | 'OUT'>('IN');
  quantity = signal<number>(1);
  reason = signal<string>('Contagem de inventário');

  onQuantityInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.quantity.set(val ? Number(val) : 0);
  }

  onReasonInput(event: Event) {
    this.reason.set((event.target as HTMLInputElement).value);
  }

  calculateNewStock(current: number): number {
    const delta = this.adjustType() === 'IN' ? this.quantity() : -this.quantity();
    return Math.max(0, current + delta);
  }

  confirmAdjustment() {
    const currentItem = this.item();
    if (!currentItem) return;
    const delta = this.adjustType() === 'IN' ? this.quantity() : -this.quantity();
    this.adjusted.emit({
      itemId: currentItem.id,
      delta,
      reason: this.reason()
    });
  }
}
