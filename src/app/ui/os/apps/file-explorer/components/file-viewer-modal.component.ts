import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { VirtualFile } from '../../../../../contracts/storage/virtual-fs.contract';

@Component({
  selector: 'app-file-viewer-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (file(); as active) {
      <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-fade-in-up">
          
          <!-- Modal Header -->
          <div class="p-3 bg-slate-950 border-b border-white/10 flex items-center justify-between">
            <div class="flex items-center gap-2 min-w-0">
              <mat-icon class="text-sky-400 text-base">description</mat-icon>
              <h4 class="text-xs font-bold text-white truncate">{{ active.name }}</h4>
              <span class="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-300 font-mono">
                {{ formatSize(active.sizeBytes) }}
              </span>
            </div>
            
            <div class="flex items-center gap-1.5">
              <!-- Print thermal button -->
              <button 
                (click)="printThermal.emit(active)"
                title="Imprimir no Spooler Térmico"
                class="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold rounded-md transition-colors">
                <mat-icon class="text-xs">print</mat-icon>
                <span>Imprimir Térmica</span>
              </button>

              <!-- Download button -->
              <button 
                (click)="download.emit(active)"
                title="Baixar Arquivo"
                class="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors">
                <mat-icon class="text-sm">download</mat-icon>
              </button>

              <!-- Copy to clipboard -->
              <button 
                (click)="copyContent.emit(active)"
                title="Copiar Conteúdo"
                class="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors">
                <mat-icon class="text-sm">content_copy</mat-icon>
              </button>

              <button 
                (click)="closeModal.emit()"
                class="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors ml-1">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>
          </div>

          <!-- Modal Body (File Content) -->
          <div class="flex-1 overflow-auto p-4 bg-slate-950/50">
            <pre class="font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-sky-500 selection:text-white">{{ active.content }}</pre>
          </div>

          <!-- Modal Footer -->
          <div class="p-3 bg-slate-950 border-t border-white/10 flex justify-between items-center text-[11px] text-slate-400">
            <span>Extensão: .{{ active.extension }}</span>
            <button 
              (click)="closeModal.emit()"
              class="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-md text-white transition-colors">
              Fechar
            </button>
          </div>

        </div>
      </div>
    }
  `
})
export class FileViewerModalComponent {
  file = input<VirtualFile | null>(null);

  closeModal = output<void>();
  printThermal = output<VirtualFile>();
  download = output<VirtualFile>();
  copyContent = output<VirtualFile>();

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
