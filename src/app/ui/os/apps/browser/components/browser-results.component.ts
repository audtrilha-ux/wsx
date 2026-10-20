import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-browser-results',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6 animate-fade-in select-text pb-8">
      
      <!-- Answer Card -->
      <div class="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm space-y-5 leading-relaxed">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3 gap-4">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
            <span class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Resposta Consolidada</span>
            
            <!-- Category Badge -->
            <span 
              [class]="getCategoryBadgeClass(category())"
              class="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <mat-icon class="text-[11px] w-3 h-3 flex items-center justify-center">{{ getCategoryIcon(category()) }}</mat-icon>
              {{ category() === 'all' ? 'Geral' : category() === 'news' ? 'Notícias' : category() === 'saas' ? 'Técnico' : 'Finanças' }}
            </span>
          </div>
          
          <div class="flex items-center gap-2 shrink-0 select-none">
            <!-- Bookmark Button -->
            <button 
              type="button"
              (click)="toggleBookmark.emit()"
              [title]="isBookmarked() ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'"
              [class.text-amber-500]="isBookmarked()"
              [class.bg-amber-50]="isBookmarked()"
              [class.border-amber-200]="isBookmarked()"
              [class.text-slate-500]="!isBookmarked()"
              [class.hover:bg-slate-50]="!isBookmarked()"
              class="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 transition-all cursor-pointer">
              <mat-icon class="text-lg">{{ isBookmarked() ? 'star' : 'star_border' }}</mat-icon>
            </button>

            <!-- Print Action Button -->
            <button 
              type="button"
              (click)="printResult.emit()"
              title="Imprimir Pesquisa na Bobina Térmica"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 font-bold text-[10px] rounded-lg border border-indigo-200 transition-all cursor-pointer">
              <mat-icon class="text-sm">print</mat-icon>
              Imprimir Recibo
            </button>
          </div>
        </div>

        <!-- Inline Print Notification Feedback Banner -->
        @if (printFeedback()) {
          <div 
            [class]="printFeedback()?.includes('sucesso') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : printFeedback()?.includes('Enviando') ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-rose-50 border-rose-200 text-rose-700'"
            class="p-2.5 border rounded-xl text-xs flex items-center gap-2 animate-fade-in">
            <mat-icon class="text-sm">
              {{ printFeedback()?.includes('sucesso') ? 'check_circle' : printFeedback()?.includes('Enviando') ? 'hourglass_empty' : 'warning' }}
            </mat-icon>
            <span class="font-medium">{{ printFeedback() }}</span>
          </div>
        }

        <!-- Styled Markdown Content -->
        <div class="text-slate-700 text-sm space-y-4 font-sans leading-relaxed" [innerHTML]="formatMarkdown(result() || '')"></div>
      </div>

      <!-- Grounded Sources Footnotes -->
      @if (sources() && sources()!.length > 0) {
        <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3.5">
          <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
            <mat-icon class="text-xs">link</mat-icon>
            Fontes Citadas na Pesquisa
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            @for (source of sources(); track source.uri) {
              <a 
                [href]="source.uri" 
                target="_blank" 
                rel="noreferrer"
                class="p-2.5 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/20 text-slate-700 hover:text-indigo-600 transition-all flex items-center gap-2.5 group">
                <div class="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100/40 group-hover:text-indigo-600 transition-colors shrink-0">
                  <mat-icon class="text-sm">open_in_new</mat-icon>
                </div>
                <div class="min-w-0 flex-1">
                  <h4 class="text-xs font-semibold truncate leading-none mb-1">{{ source.title }}</h4>
                  <p class="text-[9px] text-slate-400 truncate leading-none">{{ source.uri }}</p>
                </div>
              </a>
            }
          </div>
        </div>
      }

    </div>
  `
})
export class BrowserResultsComponent {
  result = input<string | null>(null);
  sources = input<{ title: string; uri: string }[] | null>(null);
  category = input<'all' | 'news' | 'saas' | 'finance'>('all');
  isBookmarked = input<boolean>(false);
  printFeedback = input<string | null>(null);

  toggleBookmark = output<void>();
  printResult = output<void>();

  getCategoryIcon(cat: string): string {
    switch (cat) {
      case 'news': return 'trending_up';
      case 'saas': return 'code';
      case 'finance': return 'payments';
      default: return 'search';
    }
  }

  getCategoryBadgeClass(cat: string): string {
    switch (cat) {
      case 'news': return 'bg-amber-50 border border-amber-200 text-amber-700';
      case 'saas': return 'bg-emerald-50 border border-emerald-200 text-emerald-700';
      case 'finance': return 'bg-indigo-50 border border-indigo-200 text-indigo-700';
      default: return 'bg-slate-150 border border-slate-200 text-slate-700';
    }
  }

  formatMarkdown(raw: string): string {
    if (!raw) return '';

    let formatted = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings
    formatted = formatted.replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-slate-900 mt-4 mb-2 tracking-tight">$1</h3>');
    formatted = formatted.replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-slate-900 mt-5 mb-2.5 pb-1 border-b border-slate-100 tracking-tight">$1</h2>');
    formatted = formatted.replace(/^# (.*$)/gim, '<h1 class="text-lg font-extrabold text-slate-900 mt-6 mb-3 tracking-tight">$1</h1>');

    // Bold / italic
    formatted = formatted.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-slate-900">$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/gim, '<em class="italic text-slate-600">$1</em>');

    // Bullet points
    formatted = formatted.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-4 list-disc text-slate-700 my-1 leading-relaxed">$1</li>');

    // Numbered lists
    formatted = formatted.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="ml-4 list-decimal text-slate-700 my-1 leading-relaxed">$2</li>');

    // Code blocks
    formatted = formatted.replace(/`([^`]+)`/gim, '<code class="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded text-xs font-mono font-semibold">$1</code>');

    // Paragraphs
    formatted = formatted.replace(/\n\n+/g, '</p><p class="my-2 leading-relaxed text-slate-700">');

    return `<p class="my-2 leading-relaxed text-slate-700">${formatted}</p>`;
  }
}
