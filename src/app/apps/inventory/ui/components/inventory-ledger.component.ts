import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { StockMovement, InventoryItem } from '../../domain/inventory.entity';

@Component({
  selector: 'app-inventory-ledger',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col overflow-hidden">
      <!-- Header / Filter Bar -->
      <div class="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div class="relative flex-1 min-w-[220px] max-w-sm">
          <mat-icon class="absolute left-3 top-2.5 text-slate-400 text-sm">search</mat-icon>
          <input
            id="ledger-search"
            type="text"
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
            placeholder="Filtrar por ID do produto ou motivo..."
            class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
          />
        </div>

        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            (click)="typeFilter.set('ALL')"
            [class]="typeFilter() === 'ALL'
              ? 'bg-slate-800 text-white shadow-xs font-semibold'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            class="px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 cursor-pointer">
            Todas as Movimentações
          </button>
          <button
            (click)="typeFilter.set('IN')"
            [class]="typeFilter() === 'IN'
              ? 'bg-emerald-600 text-white shadow-xs font-semibold'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            class="px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 cursor-pointer">
            Entradas
          </button>
          <button
            (click)="typeFilter.set('OUT')"
            [class]="typeFilter() === 'OUT'
              ? 'bg-rose-600 text-white shadow-xs font-semibold'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            class="px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 cursor-pointer">
            Saídas
          </button>
        </div>
      </div>

      <!-- Ledger Table -->
      <div class="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
        <div class="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                <th class="p-3.5">Data & Hora</th>
                <th class="p-3.5">Produto</th>
                <th class="p-3.5 text-center">Tipo</th>
                <th class="p-3.5 text-right">Anterior</th>
                <th class="p-3.5 text-right">Qtd</th>
                <th class="p-3.5 text-right">Novo Saldo</th>
                <th class="p-3.5">Justificativa / Motivo</th>
              </tr>
            </thead>
            <tbody>
              @for (movement of filteredMovements(); track movement.id) {
                <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors last:border-0 text-xs">
                  <td class="p-3.5 text-slate-500 font-mono text-[11px]">
                    {{ movement.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}
                  </td>
                  <td class="p-3.5 font-medium text-slate-900">
                    {{ getProductName(movement.itemId) }}
                    <span class="block text-[10px] text-slate-400 font-mono mt-0.5">ID: {{ movement.itemId }}</span>
                  </td>
                  <td class="p-3.5 text-center">
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      [class]="movement.type === 'IN'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'">
                      {{ movement.type === 'IN' ? 'ENTRADA' : 'SAÍDA' }}
                    </span>
                  </td>
                  <td class="p-3.5 text-right font-medium text-slate-500">
                    {{ movement.previousStock }}
                  </td>
                  <td class="p-3.5 text-right font-bold text-slate-900" [class]="movement.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'">
                    {{ movement.type === 'IN' ? '+' : '-' }}{{ movement.quantity }}
                  </td>
                  <td class="p-3.5 text-right font-bold text-slate-900">
                    {{ movement.newStock }}
                  </td>
                  <td class="p-3.5 text-slate-600">
                    {{ movement.reason }}
                  </td>
                </tr>
              }
              @if (filteredMovements().length === 0) {
                <tr>
                  <td colspan="7" class="p-12 text-center text-slate-400">
                    <mat-icon class="text-3xl text-slate-300 mb-1">history</mat-icon>
                    <p class="text-xs">Nenhum registro de movimentação de estoque localizado.</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class InventoryLedgerComponent {
  movements = input<StockMovement[]>([]);
  products = input<InventoryItem[]>([]);

  searchQuery = signal<string>('');
  typeFilter = signal<'ALL' | 'IN' | 'OUT'>('ALL');

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  getProductName(itemId: string): string {
    const prod = this.products().find(p => p.id === itemId);
    return prod ? prod.name : 'Produto Desconhecido';
  }

  filteredMovements = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.typeFilter();
    let list = this.movements();

    if (filter === 'IN') {
      list = list.filter(m => m.type === 'IN');
    } else if (filter === 'OUT') {
      list = list.filter(m => m.type === 'OUT' || m.type === 'ADJUST');
    }

    if (query) {
      list = list.filter(m =>
        m.reason.toLowerCase().includes(query) ||
        m.itemId.toLowerCase().includes(query) ||
        this.getProductName(m.itemId).toLowerCase().includes(query)
      );
    }

    return list;
  });
}
