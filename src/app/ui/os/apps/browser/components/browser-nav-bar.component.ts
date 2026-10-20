import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BrowserTab } from '../../../../../core/browser-search/documentation-search.service';
import { Bookmark } from '../browser.component';

@Component({
  selector: 'app-browser-nav-bar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- BROWSER TAB BAR (Chrome/OS design) -->
    <div class="bg-slate-100 px-3 pt-2 border-b border-slate-200 flex items-center gap-1 overflow-x-auto select-none shrink-0" style="scrollbar-width: none;">
      @for (tab of tabs(); track tab.id) {
        <button 
          type="button"
          (click)="selectTab.emit(tab.id)"
          [class.bg-white]="activeTabId() === tab.id"
          [class.text-indigo-700]="activeTabId() === tab.id"
          [class.font-bold]="activeTabId() === tab.id"
          [class.border-slate-200]="activeTabId() === tab.id"
          [class.shadow-xs]="activeTabId() === tab.id"
          [class.bg-slate-50]="activeTabId() !== tab.id"
          [class.text-slate-500]="activeTabId() !== tab.id"
          [class.hover:bg-slate-200/60]="activeTabId() !== tab.id"
          class="flex items-center gap-2 px-3 py-1.5 text-xs rounded-t-xl border-t border-x border-slate-200/60 cursor-pointer max-w-[160px] min-w-[110px] truncate shrink-0 transition-all duration-150 text-left font-normal border-b-0">
          
          <mat-icon class="text-sm shrink-0 text-slate-400" [class.text-indigo-500]="activeTabId() === tab.id">
            {{ tab.isSearching ? 'autorenew' : (tab.searchResult ? 'article' : 'menu_book') }}
          </mat-icon>
          
          <span class="truncate flex-1 text-[11px] leading-tight">
            {{ tab.title }}
          </span>
          
          <span 
            (click)="onCloseTab($event, tab.id)" 
            role="button"
            tabindex="0"
            (keydown.enter)="onCloseTab($event, tab.id)"
            title="Fechar Aba"
            class="w-4 h-4 rounded-full hover:bg-slate-300 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shrink-0">
            <mat-icon class="text-[12px] w-3 h-3 flex items-center justify-center">close</mat-icon>
          </span>
        </button>
      }
      
      <!-- Add tab button -->
      <button 
        (click)="addTab.emit()" 
        title="Nova Aba"
        class="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all ml-1 shrink-0 cursor-pointer">
        <mat-icon class="text-lg">add</mat-icon>
      </button>
    </div>

    <!-- Browser Navigation/Address Bar -->
    <div class="h-14 border-b border-slate-200 bg-white px-4 flex items-center gap-3 shrink-0 shadow-xs z-10">
      
      <!-- Controls Buttons -->
      <div class="flex items-center gap-1 shrink-0">
        <button (click)="goHome.emit()" title="Página Inicial" class="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all cursor-pointer">
          <mat-icon class="text-lg">home</mat-icon>
        </button>
        <button (click)="refresh.emit()" title="Atualizar" class="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all cursor-pointer" [class.animate-spin]="isSearching()">
          <mat-icon class="text-lg">refresh</mat-icon>
        </button>
      </div>

      <!-- Address Bar Input -->
      <div class="flex-1 relative">
        <mat-icon class="absolute left-3 top-2 text-slate-400 text-sm">menu_book</mat-icon>
        <input 
          type="text" 
          [formControl]="queryControl()"
          (focus)="openSuggestions.emit()"
          (blur)="closeSuggestions.emit()"
          (keydown.enter)="submitSearch.emit()"
          placeholder="Digite termos de busca nos documentos, regras de ouro, sqlite, conformidade..." 
          class="w-full bg-slate-100 border border-slate-200 hover:border-slate-300 focus:bg-white rounded-xl pl-9 pr-24 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
        
        <div class="absolute right-2 top-1.5 flex items-center gap-1 select-none">
          <span class="text-[9px] font-semibold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">Docs Locais</span>
        </div>

        <!-- Dynamic Address Bar Autocomplete & Suggestions Dropdown Panel -->
        @if (showSuggestions() && (searchHistory().length > 0 || bookmarks().length > 0)) {
          <div class="absolute top-11 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-fade-in max-h-72 overflow-y-auto">
            
            @if (searchHistory().length > 0) {
              <div class="space-y-1">
                <div class="px-2 text-[9px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <mat-icon class="text-[11px] w-3 h-3 flex items-center justify-center">history</mat-icon>
                  Pesquisas Recentes
                </div>
                @for (hist of searchHistory().slice(0, 3); track hist) {
                  <button 
                    type="button"
                    (mousedown)="selectSuggestion.emit(hist); $event.preventDefault()"
                    class="w-full px-2 py-1.5 rounded-lg hover:bg-indigo-50/40 text-left transition-colors flex items-center gap-2 cursor-pointer group">
                    <mat-icon class="text-sm text-slate-400 shrink-0">history</mat-icon>
                    <span class="text-xs text-slate-700 truncate group-hover:text-indigo-600 flex-1">{{ hist }}</span>
                    <mat-icon class="text-[12px] text-slate-300 group-hover:text-indigo-400 shrink-0">arrow_forward</mat-icon>
                  </button>
                }
              </div>
            }

            @if (searchHistory().length > 0 && bookmarks().length > 0) {
              <div class="border-t border-slate-100 my-1"></div>
            }

            @if (bookmarks().length > 0) {
              <div class="space-y-1">
                <div class="px-2 text-[9px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <mat-icon class="text-[11px] w-3 h-3 flex items-center justify-center text-amber-500">star</mat-icon>
                  Favoritos Rápidos
                </div>
                @for (bm of bookmarks().slice(0, 3); track bm.id) {
                  <button 
                    type="button"
                    (mousedown)="loadBookmark.emit(bm); $event.preventDefault()"
                    class="w-full px-2 py-1.5 rounded-lg hover:bg-indigo-50/40 text-left transition-colors flex items-center gap-2 cursor-pointer group">
                    <mat-icon class="text-sm text-amber-500 shrink-0">star</mat-icon>
                    <span class="text-xs text-slate-700 truncate group-hover:text-indigo-600 flex-1">{{ bm.title }}</span>
                    <span class="text-[9px] text-slate-400 capitalize shrink-0">{{ bm.category === 'all' ? 'Geral' : bm.category === 'news' ? 'Notícias' : bm.category === 'saas' ? 'Técnico' : 'Finanças' }}</span>
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Search button -->
      <button 
        (click)="submitSearch.emit()"
        [disabled]="isSearching() || !queryControl().value?.trim()"
        class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer">
        <mat-icon class="text-sm">search</mat-icon>
        Buscar
      </button>
    </div>
  `
})
export class BrowserNavBarComponent {
  tabs = input<BrowserTab[]>([]);
  activeTabId = input<string | null>(null);
  isSearching = input<boolean>(false);
  queryControl = input.required<FormControl<string | null>>();
  showSuggestions = input<boolean>(false);
  searchHistory = input<string[]>([]);
  bookmarks = input<Bookmark[]>([]);

  selectTab = output<string>();
  addTab = output<void>();
  closeTab = output<string>();
  goHome = output<void>();
  refresh = output<void>();
  submitSearch = output<void>();
  openSuggestions = output<void>();
  closeSuggestions = output<void>();
  selectSuggestion = output<string>();
  loadBookmark = output<Bookmark>();

  onCloseTab(event: Event, tabId: string) {
    event.stopPropagation();
    this.closeTab.emit(tabId);
  }
}
