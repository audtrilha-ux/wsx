import { Component, inject, signal, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DocumentationSearchService } from '../../../../core/browser-search/documentation-search.service';
import { PrinterService } from '../../../../core/printing/printer.service';
import { BrowserHomeComponent } from './components/browser-home.component';
import { BrowserResultsComponent } from './components/browser-results.component';
import { BrowserNavBarComponent } from './components/browser-nav-bar.component';

export interface Bookmark {
  id: string;
  title: string;
  query: string;
  category: 'all' | 'news' | 'saas' | 'finance';
  addedAt: string;
}

@Component({
  selector: 'app-browser',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    BrowserHomeComponent,
    BrowserResultsComponent,
    BrowserNavBarComponent
  ],
  template: `
    <div class="h-full w-full flex flex-col bg-slate-50 text-slate-800 font-sans select-text">
      
      <!-- Modular Navigation Bar with Tabs and Address Bar -->
      <app-browser-nav-bar
        [tabs]="searchService.tabs()"
        [activeTabId]="searchService.activeTabId()"
        [isSearching]="searchService.isSearching()"
        [queryControl]="queryControl"
        [showSuggestions]="showSuggestions()"
        [searchHistory]="searchHistory()"
        [bookmarks]="bookmarks()"
        (selectTab)="selectTab($event)"
        (addTab)="addTab()"
        (closeTab)="closeTab($event)"
        (goHome)="goHome()"
        (refresh)="refresh()"
        (submitSearch)="triggerSearch()"
        (openSuggestions)="openSuggestions()"
        (closeSuggestions)="closeSuggestions()"
        (selectSuggestion)="selectSuggestion($event)"
        (loadBookmark)="loadBookmark($event)" />

      <!-- Browser Screen Area -->
      <div class="flex-1 overflow-y-auto bg-slate-50 relative p-6">
        
        <!-- Searching Loader Overlay -->
        @if (searchService.isSearching()) {
          <div class="absolute inset-0 bg-white/70 backdrop-blur-xs z-20 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div class="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-lg text-indigo-600 relative">
              <mat-icon class="text-3xl animate-bounce">search</mat-icon>
              <div class="absolute -inset-1 rounded-2xl border border-indigo-500/20 animate-ping"></div>
            </div>
            
            <div class="mt-6 space-y-2 max-w-sm">
              <h3 class="text-sm font-bold text-slate-800">Consultando Documentos Locais</h3>
              <p class="text-xs text-slate-500 leading-relaxed animate-pulse">Varrendo arquivos de especificação e contratos técnicos do repositório local...</p>
            </div>
          </div>
        }

        <!-- Error Panel -->
        @if (searchService.searchError(); as err) {
          <div class="max-w-2xl mx-auto my-8 bg-rose-50 border border-rose-200 rounded-2xl p-5 flex gap-4 items-start">
            <div class="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
              <mat-icon>error_outline</mat-icon>
            </div>
            <div class="space-y-1">
              <h4 class="text-sm font-bold text-rose-900">Erro de Navegação</h4>
              <p class="text-xs text-rose-700 leading-relaxed">{{ err }}</p>
              <button (click)="refresh()" class="text-xs font-bold text-indigo-600 hover:underline mt-2 inline-block cursor-pointer">Tentar novamente</button>
            </div>
          </div>
        }

        <!-- Portal / Home Page View (Blank Tab) -->
        @if (!searchService.searchResult() && !searchService.isSearching() && !searchService.searchError()) {
          <app-browser-home
            [bookmarks]="bookmarks()"
            [searchHistory]="searchHistory()"
            (querySelect)="onQuerySelect($event)"
            (loadBookmark)="loadBookmark($event)"
            (removeBookmark)="deleteBookmark($event)"
            (clearHistory)="clearHistory()" />
        }

        <!-- Active Search Results View -->
        @if (searchService.searchResult(); as result) {
          <app-browser-results
            [result]="result"
            [sources]="searchService.searchSources()"
            [category]="selectedCategory()"
            [isBookmarked]="isBookmarked()"
            [printFeedback]="printFeedback()"
            (toggleBookmark)="toggleBookmark()"
            (printResult)="printResult()" />
        }

      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrowserComponent {
  searchService = inject(DocumentationSearchService);
  private printerService = inject(PrinterService);
  
  queryControl = new FormControl('');
  selectedCategory = signal<'all' | 'news' | 'saas' | 'finance'>('all');
  searchHistory = signal<string[]>([]);
  bookmarks = signal<Bookmark[]>([]);
  printFeedback = signal<string | null>(null);
  showSuggestions = signal<boolean>(false);

  constructor() {
    const savedHistory = localStorage.getItem('3eatcru_browser_history');
    if (savedHistory) {
      try {
        this.searchHistory.set(JSON.parse(savedHistory));
      } catch (e) {
        console.warn('Failed parsing search history', e);
      }
    }

    const savedBookmarks = localStorage.getItem('3eatcru_browser_bookmarks');
    if (savedBookmarks) {
      try {
        this.bookmarks.set(JSON.parse(savedBookmarks));
      } catch (e) {
        console.warn('Failed parsing bookmarks', e);
      }
    }

    effect(() => {
      const active = this.searchService.activeTab();
      if (active) {
        if (this.queryControl.value !== active.query) {
          this.queryControl.setValue(active.query || '', { emitEvent: false });
        }
        this.selectedCategory.set(active.category || 'all');
      }
    });
  }

  selectTab(id: string) {
    this.searchService.setActiveTab(id);
  }

  addTab() {
    const id = this.searchService.createNewTab('Nova Aba');
    this.selectTab(id);
  }

  closeTab(id: string) {
    this.searchService.closeTab(id);
  }

  goHome() {
    const active = this.searchService.activeTab();
    if (active) {
      this.searchService.tabs.update(list => list.map(t => {
        if (t.id === active.id) {
          return {
            ...t,
            title: 'Página Inicial',
            query: '',
            isSearching: false,
            searchResult: null,
            searchSources: [],
            searchError: null,
            category: 'all'
          };
        }
        return t;
      }));
    }
    this.queryControl.setValue('');
    this.printFeedback.set(null);
  }

  refresh() {
    const q = this.queryControl.value?.trim();
    if (q) {
      this.searchService.performSearch(q, this.selectedCategory(), true);
      this.addToHistory(q);
    }
  }

  triggerSearch() {
    const query = this.queryControl.value?.trim();
    if (query) {
      this.searchService.performSearch(query, this.selectedCategory(), true);
      this.addToHistory(query);
    }
  }

  openSuggestions() {
    this.showSuggestions.set(true);
  }

  closeSuggestions() {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  selectSuggestion(query: string) {
    this.queryControl.setValue(query);
    this.triggerSearch();
    this.showSuggestions.set(false);
  }

  onQuerySelect(event: { query: string; category: 'all' | 'news' | 'saas' | 'finance' }) {
    this.selectedCategory.set(event.category);
    this.queryControl.setValue(event.query);
    this.triggerSearch();
  }

  addToHistory(query: string) {
    const clean = query.trim();
    if (!clean) return;

    const updated = [clean, ...this.searchHistory().filter(h => h !== clean)].slice(0, 5);
    this.searchHistory.set(updated);
    localStorage.setItem('3eatcru_browser_history', JSON.stringify(updated));
  }

  clearHistory() {
    this.searchHistory.set([]);
    localStorage.removeItem('3eatcru_browser_history');
  }

  toggleBookmark() {
    const active = this.searchService.activeTab();
    if (!active || !active.query) return;

    const current = this.bookmarks();
    const exists = current.find(b => b.query.toLowerCase() === active.query.toLowerCase());

    if (exists) {
      const updated = current.filter(b => b.id !== exists.id);
      this.bookmarks.set(updated);
      localStorage.setItem('3eatcru_browser_bookmarks', JSON.stringify(updated));
    } else {
      const newBookmark: Bookmark = {
        id: 'bm_' + Math.random().toString(36).substring(2, 11),
        title: active.title || active.query,
        query: active.query,
        category: active.category,
        addedAt: new Date().toISOString()
      };
      const updated = [...current, newBookmark];
      this.bookmarks.set(updated);
      localStorage.setItem('3eatcru_browser_bookmarks', JSON.stringify(updated));
    }
  }

  isBookmarked(): boolean {
    const active = this.searchService.activeTab();
    if (!active || !active.query) return false;
    return this.bookmarks().some(b => b.query.toLowerCase() === active.query.toLowerCase());
  }

  deleteBookmark(id: string) {
    const updated = this.bookmarks().filter(b => b.id !== id);
    this.bookmarks.set(updated);
    localStorage.setItem('3eatcru_browser_bookmarks', JSON.stringify(updated));
  }

  loadBookmark(bm: Bookmark) {
    this.selectedCategory.set(bm.category);
    this.queryControl.setValue(bm.query);
    this.triggerSearch();
    this.showSuggestions.set(false);
  }

  printResult() {
    const query = this.searchService.searchQuery();
    const result = this.searchService.searchResult();
    if (!query || !result) return;

    this.printFeedback.set('Enviando documento para o Spooler de Impressão do OS...');

    const cleanText = result
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*|`|#|>/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    const lines = cleanText.split('\n');
    const formattedLines = lines.map(line => {
      const l = line.trim();
      if (l.startsWith('-') || l.startsWith('*')) {
        return `  * ${l.substring(1).trim()}`;
      }
      return l;
    }).filter(l => l.length > 0).join('\n');

    const receiptBody = `PESQUISA REALIZADA:\n"${query.toUpperCase()}"\n\nCONTEUDO SINTETIZADO:\n${formattedLines}`;

    this.printerService.print(`Pesquisa: ${query.substring(0, 20)}`, receiptBody)
      .then(() => {
        this.printFeedback.set('Comprovante enviado com sucesso para a Bobina Térmica!');
        setTimeout(() => this.printFeedback.set(null), 4000);
      })
      .catch((err: unknown) => {
        const errorMsg = err instanceof Error ? err.message : 'Impressora sem papel ou offline';
        this.printFeedback.set(`Falha ao imprimir: ${errorMsg}`);
        setTimeout(() => this.printFeedback.set(null), 5000);
      });
  }
}
