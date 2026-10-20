import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Bookmark } from '../browser.component';

@Component({
  selector: 'app-browser-home',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto py-6 space-y-6 animate-fade-in">
      
      <!-- Elegant Brand Header -->
      <div class="text-center space-y-2">
        <div class="w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 flex items-center justify-center mx-auto hover:scale-105 transition-transform duration-300">
          <mat-icon class="text-2xl">menu_book</mat-icon>
        </div>
        <div>
          <h2 class="text-xl font-bold text-slate-900 tracking-tight">3eatcru Docs & Specifications</h2>
          <p class="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Navegador local de contratos do sistema, especificações técnicas de arquitetura, regras de ouro e planos de conformidade.
          </p>
        </div>
      </div>

      <!-- Quick Shortcuts Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button 
          type="button"
          (click)="querySelect.emit({ query: 'regras de ouro', category: 'all' })"
          class="p-3 bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-sm rounded-2xl text-left transition-all group cursor-pointer">
          <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <mat-icon class="text-base">gavel</mat-icon>
          </div>
          <h4 class="text-xs font-bold text-slate-800 mt-2 group-hover:text-indigo-600">Regras de Ouro</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">Princípios e restrições</p>
        </button>

        <button 
          type="button"
          (click)="querySelect.emit({ query: 'modos varejo restaurante', category: 'all' })"
          class="p-3 bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-sm rounded-2xl text-left transition-all group cursor-pointer">
          <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <mat-icon class="text-base">storefront</mat-icon>
          </div>
          <h4 class="text-xs font-bold text-slate-800 mt-2 group-hover:text-emerald-600">Modos Varejo & Gastronomia</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">Suítes pré-instaladas</p>
        </button>

        <button 
          type="button"
          (click)="querySelect.emit({ query: 'tema desk skeuomorfico', category: 'all' })"
          class="p-3 bg-white border border-slate-200/80 hover:border-amber-300 hover:shadow-sm rounded-2xl text-left transition-all group cursor-pointer">
          <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <mat-icon class="text-base">desk</mat-icon>
          </div>
          <h4 class="text-xs font-bold text-slate-800 mt-2 group-hover:text-amber-700">Tema Físico DEsk</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">Madeira nobre e latão</p>
        </button>

        <button 
          type="button"
          (click)="querySelect.emit({ query: 'sqlite', category: 'all' })"
          class="p-3 bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-sm rounded-2xl text-left transition-all group cursor-pointer">
          <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <mat-icon class="text-base">storage</mat-icon>
          </div>
          <h4 class="text-xs font-bold text-slate-800 mt-2 group-hover:text-indigo-600">Arquitetura de Dados</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">SQLite, store e sync</p>
        </button>

        <button 
          type="button"
          (click)="querySelect.emit({ query: 'segurança', category: 'all' })"
          class="p-3 bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-sm rounded-2xl text-left transition-all group cursor-pointer">
          <div class="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <mat-icon class="text-base">security</mat-icon>
          </div>
          <h4 class="text-xs font-bold text-slate-800 mt-2 group-hover:text-indigo-600">Segurança & Isola.</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">Anti-IDOR e senhas</p>
        </button>

        <button 
          type="button"
          (click)="querySelect.emit({ query: 'plano de correção', category: 'all' })"
          class="p-3 bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-sm rounded-2xl text-left transition-all group cursor-pointer">
          <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <mat-icon class="text-base">assignment</mat-icon>
          </div>
          <h4 class="text-xs font-bold text-slate-800 mt-2 group-hover:text-indigo-600">Plano de Correção</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">Fases de evolução</p>
        </button>
      </div>

      <!-- Bookmarks and History Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Bookmarks Section -->
        <div class="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div class="flex items-center gap-2">
              <mat-icon class="text-amber-500 text-sm">star</mat-icon>
              <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Favoritos Salvos</h3>
            </div>
            <span class="text-[10px] text-slate-400 font-mono">{{ bookmarks().length }} itens</span>
          </div>

          <div class="flex-1 overflow-y-auto max-h-[180px] space-y-1.5 pr-1">
            @if (bookmarks().length === 0) {
              <div class="text-center py-6 text-slate-400 text-xs">
                <mat-icon class="text-slate-300 text-2xl mb-1">bookmark_border</mat-icon>
                <p>Nenhum favorito salvo ainda.</p>
                <p class="text-[10px] mt-0.5">Favorite pesquisas clicando na estrela nas respostas.</p>
              </div>
            } @else {
              @for (bm of bookmarks(); track bm.id) {
                <div class="p-2 rounded-xl bg-slate-50 hover:bg-amber-50/40 border border-slate-200/50 hover:border-amber-200/60 transition-all flex items-center justify-between group">
                  <button 
                    type="button"
                    (click)="loadBookmark.emit(bm)"
                    class="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer">
                    <mat-icon class="text-sm text-amber-500 shrink-0">bookmark</mat-icon>
                    <div class="min-w-0">
                      <h4 class="text-xs font-semibold text-slate-700 truncate group-hover:text-amber-700">{{ bm.title }}</h4>
                      <p class="text-[9px] text-slate-400 truncate">{{ bm.query }}</p>
                    </div>
                  </button>
                  <button 
                    type="button"
                    (click)="removeBookmark.emit(bm.id)"
                    title="Excluir Favorito"
                    class="w-6 h-6 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100">
                    <mat-icon class="text-xs">delete</mat-icon>
                  </button>
                </div>
              }
            }
          </div>
        </div>

        <!-- Recent History Section -->
        <div class="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div class="flex items-center gap-2">
              <mat-icon class="text-slate-400 text-sm">history</mat-icon>
              <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Histórico Recente</h3>
            </div>
            @if (searchHistory().length > 0) {
              <button 
                type="button"
                (click)="clearHistory.emit()"
                class="text-[10px] text-slate-400 hover:text-rose-600 font-bold transition-colors">
                Limpar
              </button>
            }
          </div>

          <div class="flex-1 overflow-y-auto max-h-[180px] space-y-1.5 pr-1">
            @if (searchHistory().length === 0) {
              <div class="text-center py-6 text-slate-400 text-xs">
                <mat-icon class="text-slate-300 text-2xl mb-1">history</mat-icon>
                <p>Histórico de buscas limpo.</p>
              </div>
            } @else {
              @for (hist of searchHistory(); track hist) {
                <button 
                  type="button"
                  (click)="querySelect.emit({ query: hist, category: 'all' })"
                  class="w-full p-2 rounded-xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-200/50 hover:border-indigo-100 text-left transition-all flex items-center gap-2 cursor-pointer group">
                  <mat-icon class="text-sm text-slate-400 shrink-0">history</mat-icon>
                  <span class="text-xs font-medium text-slate-700 truncate group-hover:text-indigo-600 flex-1">{{ hist }}</span>
                  <mat-icon class="text-[14px] text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0">arrow_forward</mat-icon>
                </button>
              }
            }
          </div>
        </div>

      </div>

      <!-- Informational Banner -->
      <div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-300 text-xs flex gap-3.5 items-center shadow-md">
        <mat-icon class="text-indigo-400 text-lg">security</mat-icon>
        <div class="leading-relaxed">
          <p class="font-bold text-white">Consulta de Especificações Offline</p>
          <p class="text-[11px] text-slate-400">Esta ferramenta realiza varredura direta e indexação em tempo real de documentos, diretrizes e contratos de engenharia armazenados localmente no projeto.</p>
        </div>
      </div>

    </div>
  `
})
export class BrowserHomeComponent {
  bookmarks = input<Bookmark[]>([]);
  searchHistory = input<string[]>([]);

  querySelect = output<{ query: string; category: 'all' | 'news' | 'saas' | 'finance' }>();
  loadBookmark = output<Bookmark>();
  removeBookmark = output<string>();
  clearHistory = output<void>();
}
