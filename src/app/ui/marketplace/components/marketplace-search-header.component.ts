import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-marketplace-search-header',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="desk-paper-sheet p-5 space-y-4 shadow-xl border border-amber-900/30 text-stone-900 relative select-none">
      
      <!-- Brass Screws on top corners -->
      <div class="absolute top-2.5 left-3 desk-brass-screw"></div>
      <div class="absolute top-2.5 right-3 desk-brass-screw"></div>

      <!-- Drawer Cabinet Title Plate & Modos de Visualização -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-stone-200/80 gap-3 pt-1">
        <div class="flex items-center gap-2">
          <div class="desk-brass-label-holder text-amber-100 text-[10px] font-mono font-bold tracking-widest uppercase">
            <span class="px-1 text-amber-200">GAVETA CATÁLOGO #01</span>
          </div>
          <span class="text-xs text-stone-600 font-serif font-bold hidden md:inline">Fichário Comercial do Ecossistema</span>
        </div>

        <!-- View Mode Switcher: Fichário (Cards) vs Livro-Razão (Tabela) vs Mapa Cartográfico -->
        <div class="flex items-center gap-1.5 self-end sm:self-auto bg-[#f5ecd7] p-1 rounded-xl border border-amber-600/30 text-xs shadow-inner">
          <button 
            type="button" 
            (click)="viewModeChange.emit('grid')"
            [class]="viewMode() === 'grid' 
              ? 'desk-brass-button text-amber-950 font-bold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 shadow-sm' 
              : 'text-stone-700 hover:text-amber-900 px-2 py-1 text-[11px] font-semibold flex items-center gap-1 transition-colors'"
            title="Visualização em Fichas com Textura">
            <mat-icon class="text-xs">view_module</mat-icon>
            <span>Fichário</span>
          </button>
          <button 
            type="button" 
            (click)="viewModeChange.emit('ledger')"
            [class]="viewMode() === 'ledger' 
              ? 'desk-brass-button text-amber-950 font-bold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 shadow-sm' 
              : 'text-stone-700 hover:text-amber-900 px-2 py-1 text-[11px] font-semibold flex items-center gap-1 transition-colors'"
            title="Visualização em Livro-Razão Contábil">
            <mat-icon class="text-xs">table_rows</mat-icon>
            <span>Livro-Razão</span>
          </button>
          <button 
            type="button" 
            (click)="viewModeChange.emit('map')"
            [class]="viewMode() === 'map' 
              ? 'desk-brass-button text-amber-950 font-bold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 shadow-sm' 
              : 'text-stone-700 hover:text-amber-900 px-2 py-1 text-[11px] font-semibold flex items-center gap-1 transition-colors'"
            title="Visualização em Carta Náutica / Radar Geográfico">
            <mat-icon class="text-xs">explore</mat-icon>
            <span>Mesa Cartográfica</span>
          </button>
        </div>
      </div>

      <!-- Top Search and Sort -->
      <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div class="relative w-full sm:max-w-md">
          <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <mat-icon class="text-sm">search</mat-icon>
          </span>
          <input 
            type="text" 
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
            placeholder="Pesquisar fichas por nome, prato, especialidade..." 
            class="w-full bg-white border border-stone-300 focus:border-amber-600 rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none transition-all shadow-inner font-sans">
        </div>
        
        <div class="flex items-center gap-2 text-xs shrink-0 self-end sm:self-auto font-sans">
          <label for="marketplace-sort-select" class="font-bold text-stone-700 uppercase tracking-wider text-[10px] font-mono">Classificar:</label>
          <select 
            id="marketplace-sort-select"
            [value]="sortBy()"
            (change)="onSortChange($event)"
            class="bg-white border border-stone-300 rounded-lg text-xs py-1.5 px-3 focus:outline-none text-stone-800 font-medium shadow-xs cursor-pointer">
            <option value="rating">Melhor Avaliação ⭐</option>
            <option value="distance">Menor Distância 📍</option>
            <option value="name">Ordem Alfabética [A-Z]</option>
          </select>
        </div>
      </div>

      <!-- Categories horizontal list (Styled like index binder tabs) -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-t border-stone-200/80 pt-3">
        @for (cat of categories; track cat) {
          <button 
            type="button"
            (click)="categoryChange.emit(cat)"
            [class]="selectedCategory() === cat
              ? 'desk-brass-button text-xs font-bold py-1.5 px-3.5 rounded-lg shadow-sm whitespace-nowrap'
              : 'border border-stone-300 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium py-1.5 px-3.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer'"
            class="cursor-pointer select-none transition-all font-serif">
            @if (cat === 'Restaurantes') { 🍕 }
            @else if (cat === 'Varejo') { 🛍 }
            @else if (cat === 'Serviços') { 💇 }
            @else if (cat === 'Outros') { 📦 }
            {{ cat }}
          </button>
        }
      </div>
    </div>
  `
})
export class MarketplaceSearchHeaderComponent {
  searchQuery = input.required<string>();
  sortBy = input.required<'rating' | 'distance' | 'name'>();
  selectedCategory = input.required<string>();
  viewMode = input<'grid' | 'ledger' | 'map'>('grid');

  searchQueryChange = output<string>();
  sortByChange = output<'rating' | 'distance' | 'name'>();
  categoryChange = output<string>();
  viewModeChange = output<'grid' | 'ledger' | 'map'>();

  categories = ['Todos', 'Restaurantes', 'Varejo', 'Serviços', 'Outros'];

  onSearchInput(event: Event) {
    this.searchQueryChange.emit((event.target as HTMLInputElement).value);
  }

  onSortChange(event: Event) {
    this.sortByChange.emit((event.target as HTMLSelectElement).value as 'rating' | 'distance' | 'name');
  }
}
