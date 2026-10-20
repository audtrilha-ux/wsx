import { Component, input, output, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DiningTable } from '../../domain/table.entity';

@Component({
  selector: 'app-table-split-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fade-in-up animate-duration-200">
        
        <div class="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <mat-icon class="text-indigo-400 font-bold">call_split</mat-icon>
            <h3 class="text-sm font-bold">Separar Comanda: {{ table().name }}</h3>
          </div>
          <button (click)="closeModal.emit()" class="text-slate-400 hover:text-white">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <div class="p-6 space-y-4">
          
          <!-- Instructions -->
          <p class="text-xs text-slate-500">
            Selecione a quantidade de cada item que deseja mover para outra mesa e escolha a mesa de destino abaixo.
          </p>

          <!-- Items Selection List -->
          <div class="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-y-auto max-h-[30vh]">
            @for (item of activeItems(); track item.id) {
              <div class="p-3 flex items-center justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-slate-800 truncate">{{ item.name }}</div>
                  <div class="text-[10px] text-slate-500 font-mono">
                    Unitário: R$ {{ item.unitPrice | number:'1.2-2' }} | Total: R$ {{ item.totalPrice | number:'1.2-2' }}
                  </div>
                </div>

                <!-- Interactive Split Counter -->
                <div class="flex items-center gap-1.5 shrink-0">
                  <button 
                    type="button"
                    (click)="decrementItem(item.id)"
                    class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs select-none">
                    -
                  </button>
                  <span class="w-12 text-center text-xs font-bold font-mono bg-slate-50 border border-slate-200 py-1 rounded-lg">
                    {{ getMoveQty(item.id) }} / {{ item.quantity }}
                  </span>
                  <button 
                    type="button"
                    (click)="incrementItem(item.id, item.quantity)"
                    class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs select-none">
                    +
                  </button>
                </div>
              </div>
            } @empty {
              <div class="p-6 text-center text-xs text-slate-400">Não há itens ativos nesta comanda para separar.</div>
            }
          </div>

          <!-- Target Table Choice -->
          <div class="space-y-1">
            <label for="split-target-table" class="block text-xs font-bold text-slate-700">Mesa de Destino</label>
            <select 
              id="split-target-table"
              [value]="targetTableId()"
              (change)="onTargetChange($event)"
              class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Selecione Mesa de Destino...</option>
              @for (t of availableTables(); track t.id) {
                @if (t.id !== table().id) {
                  <option [value]="t.id">
                    {{ t.name }} (Capacidade: {{ t.capacity }} - Status: {{ t.status }})
                  </option>
                }
              }
            </select>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button 
              (click)="closeModal.emit()"
              class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button 
              (click)="onConfirm()"
              [disabled]="!targetTableId() || !hasSelectedItems()"
              class="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-lg transition-colors shadow-sm flex items-center gap-1">
              <mat-icon class="text-xs">call_split</mat-icon> Confirmar Divisão
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableSplitModalComponent {
  table = input.required<DiningTable>();
  availableTables = input<DiningTable[]>([]);

  closeModal = output<void>();
  confirmSplit = output<{ targetTableId: string; itemIdsToMove: { itemId: string; quantity: number }[] }>();

  targetTableId = signal<string>('');
  quantitiesToMove = signal<Record<string, number>>({});

  activeItems = computed(() => {
    return (this.table().currentOrder?.items || []).filter(i => i.status !== 'CANCELLED');
  });

  hasSelectedItems = computed(() => {
    return Object.values(this.quantitiesToMove()).some(qty => qty > 0);
  });

  getMoveQty(itemId: string): number {
    return this.quantitiesToMove()[itemId] || 0;
  }

  decrementItem(itemId: string) {
    const curr = this.getMoveQty(itemId);
    if (curr <= 0) return;
    this.quantitiesToMove.update(q => ({
      ...q,
      [itemId]: curr - 1
    }));
  }

  incrementItem(itemId: string, maxQty: number) {
    const curr = this.getMoveQty(itemId);
    if (curr >= maxQty) return;
    this.quantitiesToMove.update(q => ({
      ...q,
      [itemId]: curr + 1
    }));
  }

  onTargetChange(event: Event) {
    this.targetTableId.set((event.target as HTMLSelectElement).value);
  }

  onConfirm() {
    const selectedTarget = this.targetTableId();
    if (!selectedTarget) return;

    const items = Object.entries(this.quantitiesToMove())
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        itemId,
        quantity: qty
      }));

    if (items.length === 0) return;

    this.confirmSplit.emit({
      targetTableId: selectedTarget,
      itemIdsToMove: items
    });
  }
}
