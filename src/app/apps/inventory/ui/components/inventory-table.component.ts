import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { InventoryItem } from '../../domain/inventory.entity';

@Component({
  selector: 'app-inventory-table',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col overflow-hidden">
      <!-- Search and Filter Bar -->
      <div class="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div class="relative flex-1 min-w-[220px] max-w-sm">
          <mat-icon class="absolute left-3 top-2.5 text-slate-400 text-sm">search</mat-icon>
          <input
            id="inventory-search"
            type="text"
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
            placeholder="Buscar por SKU, nome ou categoria..."
            class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
          />
        </div>

        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            (click)="statusFilter.set('ALL')"
            [class]="statusFilter() === 'ALL'
              ? 'bg-teal-600 text-white shadow-xs font-semibold'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            class="px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 cursor-pointer">
            Todos ({{ items().length }})
          </button>
          <button
            (click)="statusFilter.set('LOW')"
            [class]="statusFilter() === 'LOW'
              ? 'bg-rose-600 text-white shadow-xs font-semibold'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            class="px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1">
            <mat-icon class="text-[14px]">warning</mat-icon>
            Abaixo do Mínimo
          </button>
          <button
            (click)="statusFilter.set('OK')"
            [class]="statusFilter() === 'OK'
              ? 'bg-emerald-600 text-white shadow-xs font-semibold'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            class="px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 cursor-pointer">
            Estoque Normal
          </button>
        </div>
      </div>

      <!-- Table Content -->
      <div class="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
        <div class="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                <th class="p-3.5">SKU / Código</th>
                <th class="p-3.5">Produto & Categoria</th>
                <th class="p-3.5 text-right">Custo</th>
                <th class="p-3.5 text-right">Preço Venda</th>
                <th class="p-3.5 text-center">Nível em Estoque</th>
                <th class="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredItems(); track item.id) {
                <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors last:border-0 text-xs">
                  <td class="p-3.5 font-mono font-medium text-slate-500">{{ item.sku }}</td>
                  <td class="p-3.5">
                    <div class="font-semibold text-slate-900">{{ item.name }}</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">{{ item.category }} · Un: {{ item.unit }}</div>
                  </td>
                  <td class="p-3.5 text-right font-medium text-slate-600">
                    {{ item.costPrice | currency:'BRL' }}
                  </td>
                  <td class="p-3.5 text-right font-bold text-slate-900">
                    {{ item.salePrice | currency:'BRL' }}
                  </td>
                  <td class="p-3.5 text-center">
                    <span 
                      class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      [class]="item.stockQuantity <= item.minStock
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'">
                      <span class="w-1.5 h-1.5 rounded-full" [class]="item.stockQuantity <= item.minStock ? 'bg-rose-500' : 'bg-emerald-500'"></span>
                      {{ item.stockQuantity }} {{ item.unit }} (Mín: {{ item.minStock }})
                    </span>
                  </td>
                  <td class="p-3.5 text-right">
                    <button
                      (click)="adjustStockRequested.emit(item)"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors cursor-pointer">
                      <mat-icon class="text-[16px]">tune</mat-icon>
                      Ajustar Estoque
                    </button>
                  </td>
                </tr>
              }
              @if (filteredItems().length === 0) {
                <tr>
                  <td colspan="6" class="p-12 text-center text-slate-400">
                    <mat-icon class="text-3xl text-slate-300 mb-1">inventory_2</mat-icon>
                    <p class="text-xs">Nenhum item localizado no inventário.</p>
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
export class InventoryTableComponent {
  items = input<InventoryItem[]>([]);
  adjustStockRequested = output<InventoryItem>();

  searchQuery = signal<string>('');
  statusFilter = signal<'ALL' | 'LOW' | 'OK'>('ALL');

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  filteredItems = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.statusFilter();
    let list = this.items();

    if (filter === 'LOW') {
      list = list.filter(i => i.stockQuantity <= i.minStock);
    } else if (filter === 'OK') {
      list = list.filter(i => i.stockQuantity > i.minStock);
    }

    if (query) {
      list = list.filter(i =>
        i.name.toLowerCase().includes(query) ||
        i.sku.toLowerCase().includes(query) ||
        i.category.toLowerCase().includes(query)
      );
    }

    return list;
  });
}
