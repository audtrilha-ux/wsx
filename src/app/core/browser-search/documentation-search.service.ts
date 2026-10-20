import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WindowManagerService } from '../application/window-manager.service';

export interface SearchSource {
  title: string;
  uri: string;
}

export interface BrowserTab {
  id: string;
  title: string;
  query: string;
  isSearching: boolean;
  searchResult: string | null;
  searchSources: SearchSource[];
  searchError: string | null;
  category: 'all' | 'news' | 'saas' | 'finance';
}

@Injectable({
  providedIn: 'root'
})
export class DocumentationSearchService {
  private http = inject(HttpClient);
  private windowManager = inject(WindowManagerService);

  readonly tabs = signal<BrowserTab[]>([]);
  readonly activeTabId = signal<string>('');

  constructor() {
    this.initDefaultTab();
  }

  private initDefaultTab() {
    const id = this.generateId();
    this.tabs.set([{
      id,
      title: 'Documentos Locais',
      query: '',
      isSearching: false,
      searchResult: null,
      searchSources: [],
      searchError: null,
      category: 'all'
    }]);
    this.activeTabId.set(id);
  }

  readonly activeTab = computed(() => {
    const list = this.tabs();
    const activeId = this.activeTabId();
    return list.find(t => t.id === activeId) || list[0];
  });

  // Keep compatibility with old code that reads these fields directly
  readonly searchQuery = computed(() => this.activeTab()?.query || '');
  readonly isSearching = computed(() => this.activeTab()?.isSearching || false);
  readonly searchResult = computed(() => this.activeTab()?.searchResult || null);
  readonly searchSources = computed(() => this.activeTab()?.searchSources || []);
  readonly searchError = computed(() => this.activeTab()?.searchError || null);

  createNewTab(title = 'Nova Busca', query = '', category: 'all' | 'news' | 'saas' | 'finance' = 'all'): string {
    const id = this.generateId();
    const newTab: BrowserTab = {
      id,
      title,
      query,
      isSearching: false,
      searchResult: null,
      searchSources: [],
      searchError: null,
      category
    };
    this.tabs.update(list => [...list, newTab]);
    this.activeTabId.set(id);
    return id;
  }

  closeTab(id: string) {
    const list = this.tabs();
    if (list.length <= 1) {
      // Don't close the last tab, just reset it
      this.tabs.update(l => l.map(t => {
        if (t.id === id) {
          return {
            ...t,
            title: 'Documentos Locais',
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
      return;
    }

    const index = list.findIndex(t => t.id === id);
    this.tabs.update(l => l.filter(t => t.id !== id));

    if (this.activeTabId() === id) {
      // Find a replacement active tab
      const remaining = this.tabs();
      const nextActiveIndex = Math.max(0, index - 1);
      this.activeTabId.set(remaining[nextActiveIndex].id);
    }
  }

  setActiveTab(id: string) {
    this.activeTabId.set(id);
  }

  performSearch(query: string, category: 'all' | 'news' | 'saas' | 'finance' = 'all', forceSameTab = false) {
    if (!query.trim()) return;

    let targetTab = this.activeTab();

    // If active tab is already searching or has a result, create a NEW tab,
    // unless forceSameTab is true OR the active tab is just the clean empty Homepage tab.
    if (!forceSameTab && targetTab && (targetTab.isSearching || targetTab.searchResult || targetTab.query)) {
      if (targetTab.query !== query) {
        const newTabId = this.createNewTab(query, query, category);
        targetTab = this.tabs().find(t => t.id === newTabId)!;
      }
    }

    const tabId = targetTab.id;

    // Update tab status to searching
    this.tabs.update(list => list.map(t => {
      if (t.id === tabId) {
        return {
          ...t,
          title: query.length > 15 ? query.substring(0, 15) + '...' : query,
          query,
          category,
          isSearching: true,
          searchResult: null,
          searchSources: [],
          searchError: null
        };
      }
      return t;
    }));

    // Ensure browser window is opened
    this.windowManager.openWindow('browser', 'Docs & Especificações', 'menu_book');

    this.http.post<{ answer: string; sources: SearchSource[] }>('/api/v1/docs/search', { query, category })
      .subscribe({
        next: (res) => {
          this.tabs.update(list => list.map(t => {
            if (t.id === tabId) {
              return {
                ...t,
                isSearching: false,
                searchResult: res.answer,
                searchSources: res.sources || []
              };
            }
            return t;
          }));
        },
        error: (err) => {
          this.tabs.update(list => list.map(t => {
            if (t.id === tabId) {
              return {
                ...t,
                isSearching: false,
                searchError: err.error?.details || err.message || 'Falha ao buscar documentos locais.'
              };
            }
            return t;
          }));
        }
      });
  }

  private generateId(): string {
    return 'tab_' + Math.random().toString(36).substring(2, 11);
  }
}
