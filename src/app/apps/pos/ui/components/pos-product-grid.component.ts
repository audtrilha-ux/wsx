import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../domain/pos.entity';

@Component({
  selector: 'app-pos-product-grid',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col overflow-hidden">
      <!-- Search and Filter Bar -->
      <div class="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <!-- Search Input -->
        <div class="relative flex-1 min-w-[200px] max-w-md">
          <mat-icon class="absolute left-3 top-2.5 text-slate-400 text-sm">search</mat-icon>
          <input
            id="pos-search-products"
            type="text"
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
            placeholder="Buscar por nome ou código..."
            class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
          />
        </div>

        <!-- Categories Selector -->
        <div class="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
          @for (cat of categories(); track cat) {
            <button
              (click)="selectedCategory.set(cat)"
              [class]="selectedCategory() === cat
                ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              class="px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 whitespace-nowrap cursor-pointer">
              {{ cat }}
            </button>
          }
        </div>
      </div>

      <!-- Products Grid -->
      <div class="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
        @if (filteredProducts().length === 0) {
          <div class="h-full flex flex-col items-center justify-center text-slate-400 p-8">
            <mat-icon class="text-4xl text-slate-300">inventory_2</mat-icon>
            <p class="text-xs font-medium mt-2">Nenhum produto localizado</p>
          </div>
        } @else {
          <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            @for (product of filteredProducts(); track product.id) {
              <button
                (click)="productSelected.emit(product)"
                class="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col items-start hover:border-indigo-400 hover:shadow-xs transition-all text-left cursor-pointer group">
                <div class="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-2.5 text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                  <mat-icon class="text-[20px]">shopping_bag</mat-icon>
                </div>
                <div class="font-semibold text-xs text-slate-800 line-clamp-1 w-full">{{ product.name }}</div>
                @if (product.category) {
                  <span class="text-[10px] text-slate-400 font-medium mt-0.5">{{ product.category }}</span>
                }
                <div class="text-indigo-600 font-bold text-sm mt-2">
                  {{ product.price | currency:'BRL' }}
                </div>
                <div class="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full" [class]="product.stock > 10 ? 'bg-emerald-500' : 'bg-amber-500'"></span>
                  Estoque: {{ product.stock }}
                </div>
              </button>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class PosProductGridComponent {
  products = input<Product[]>([]);
  productSelected = output<Product>();

  searchQuery = signal<string>('');
  selectedCategory = signal<string>('Todos');

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  categories = computed(() => {
    const list = this.products();
    const set = new Set<string>();
    set.add('Todos');
    for (const p of list) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set);
  });

  filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
    let result = this.products();

    if (cat !== 'Todos') {
      result = result.filter(p => p.category === cat);
    }
    if (query) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.includes(query)) ||
        (p.category && p.category.toLowerCase().includes(query))
      );
    }
    return result;
  });
}
