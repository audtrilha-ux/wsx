import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { VirtualFile, VirtualFolder } from '../../../../../contracts/storage/virtual-fs.contract';

@Component({
  selector: 'app-file-grid',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex-1 flex flex-col overflow-y-auto p-4 bg-slate-900/50">
      
      <!-- Root View: Drives and Top Folders -->
      @if (currentFolderId() === 'root') {
        
        <div class="space-y-5">
          <!-- Pastas de Acesso do Usuário -->
          <div>
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pastas do Sistema</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              @for (folder of mainFolders(); track folder.id) {
                <button 
                  type="button"
                  (click)="folderSelect.emit(folder.id)"
                  class="flex items-center gap-3 p-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 rounded-xl text-left transition-all group cursor-pointer">
                  <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 group-hover:scale-105 transition-transform" [ngClass]="folder.iconColor">
                    <mat-icon class="text-xl">{{ folder.icon }}</mat-icon>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-semibold text-white truncate">{{ folder.name }}</div>
                    <div class="text-[10px] text-slate-400 truncate">{{ getFileCount(folder.id) }} arquivos</div>
                  </div>
                </button>
              }
            </div>
          </div>

          <!-- Unidades e Dispositivos -->
          <div>
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Dispositivos e Unidades</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="p-3 bg-white/[0.03] border border-white/5 rounded-xl flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <mat-icon class="text-2xl">storage</mat-icon>
                </div>
                <div class="flex-1 min-w-0 space-y-1">
                  <div class="text-xs font-bold text-white">Disco Local (C:)</div>
                  <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full bg-sky-500 rounded-full" style="width: 28%"></div>
                  </div>
                  <div class="text-[10px] text-slate-400">184 GB livres de 256 GB · Sistema & Tenant</div>
                </div>
              </div>

              <div class="p-3 bg-white/[0.03] border border-white/5 rounded-xl flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <mat-icon class="text-2xl">cloud_sync</mat-icon>
                </div>
                <div class="flex-1 min-w-0 space-y-1">
                  <div class="text-xs font-bold text-white">3eatcru Cloud Storage (Z:)</div>
                  <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full bg-indigo-500 rounded-full" style="width: 52%"></div>
                  </div>
                  <div class="text-[10px] text-slate-400">4.8 GB livres de 10.0 GB · Backup Sincronizado</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      } @else {
        
        <!-- Specific Folder Contents View -->
        @if (displayedFiles().length === 0) {
          <div class="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-2 py-16">
            <mat-icon class="text-5xl text-slate-600">folder_open</mat-icon>
            <div class="text-xs font-medium">Esta pasta está vazia.</div>
            <button 
              type="button"
              (click)="openNewFile.emit()" 
              class="text-xs text-sky-400 hover:text-sky-300 hover:underline cursor-pointer">
              Clique aqui para criar um novo arquivo
            </button>
          </div>
        } @else {
          
          <!-- Mode: Grid View -->
          @if (viewMode() === 'grid') {
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              @for (file of displayedFiles(); track file.id) {
                <button 
                  type="button"
                  (click)="fileSelect.emit(file)"
                  (dblclick)="fileOpen.emit(file)"
                  (keydown.enter)="fileOpen.emit(file)"
                  [class.bg-sky-600/20]="selectedFile()?.id === file.id"
                  [class.border-sky-500/40]="selectedFile()?.id === file.id"
                  class="flex flex-col items-center p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-center cursor-pointer transition-all group relative focus:outline-none focus:ring-1 focus:ring-sky-500">
                  
                  <div class="w-12 h-12 rounded-lg flex items-center justify-center mb-2 group-hover:scale-105 transition-transform" [ngClass]="getExtensionBadgeClass(file.extension)">
                    <mat-icon class="text-2xl">{{ getExtensionIcon(file.extension) }}</mat-icon>
                  </div>

                  <div class="text-xs font-medium text-slate-200 truncate w-full group-hover:text-white" [title]="file.name">
                    {{ file.name }}
                  </div>
                  <div class="text-[10px] text-slate-400 font-mono mt-0.5">
                    {{ formatBytes(file.sizeBytes) }}
                  </div>
                </button>
              }
            </div>
          } @else {
            <!-- Mode: List / Details View -->
            <div class="border border-white/5 rounded-xl overflow-hidden bg-slate-950/40">
              <table class="w-full text-left text-xs">
                <thead class="bg-white/5 text-slate-400 border-b border-white/5">
                  <tr>
                    <th class="py-2 px-3 font-semibold">Nome</th>
                    <th class="py-2 px-3 font-semibold">Data de Modificação</th>
                    <th class="py-2 px-3 font-semibold">Tipo</th>
                    <th class="py-2 px-3 font-semibold text-right">Tamanho</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  @for (file of displayedFiles(); track file.id) {
                    <tr 
                      (click)="fileSelect.emit(file)"
                      (dblclick)="fileOpen.emit(file)"
                      (keydown.enter)="fileOpen.emit(file)"
                      tabindex="0"
                      [class.bg-sky-600/20]="selectedFile()?.id === file.id"
                      class="hover:bg-white/5 cursor-pointer transition-colors focus:outline-none focus:bg-sky-600/20">
                      <td class="py-2 px-3 flex items-center gap-2.5">
                        <mat-icon class="text-base" [ngClass]="getExtensionColor(file.extension)">{{ getExtensionIcon(file.extension) }}</mat-icon>
                        <span class="font-medium text-slate-200 truncate max-w-[240px]">{{ file.name }}</span>
                      </td>
                      <td class="py-2 px-3 text-slate-400 font-mono text-[11px]">{{ file.updatedAt }}</td>
                      <td class="py-2 px-3 text-slate-400 uppercase text-[10px] font-mono">{{ file.extension }}</td>
                      <td class="py-2 px-3 text-slate-400 font-mono text-[11px] text-right">{{ formatBytes(file.sizeBytes) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

        }

      }

    </div>
  `
})
export class FileGridComponent {
  currentFolderId = input<string>('root');
  mainFolders = input<VirtualFolder[]>([]);
  displayedFiles = input<VirtualFile[]>([]);
  allFiles = input<VirtualFile[]>([]);
  viewMode = input<'grid' | 'list'>('grid');
  selectedFile = input<VirtualFile | null>(null);

  folderSelect = output<string>();
  fileSelect = output<VirtualFile>();
  fileOpen = output<VirtualFile>();
  openNewFile = output<void>();

  getFileCount(folderId: string): number {
    return this.allFiles().filter(f => f.folderId === folderId).length;
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  getExtensionIcon(ext: string): string {
    switch (ext) {
      case 'txt':
      case 'log': return 'article';
      case 'json':
      case 'sql':
      case 'sqlite': return 'data_object';
      case 'pdf': return 'picture_as_pdf';
      case 'csv':
      case 'xlsx': return 'table_chart';
      case 'png':
      case 'jpg': return 'image';
      default: return 'insert_drive_file';
    }
  }

  getExtensionColor(ext: string): string {
    switch (ext) {
      case 'txt': return 'text-slate-300';
      case 'json': return 'text-amber-400';
      case 'sql':
      case 'sqlite': return 'text-purple-400';
      case 'pdf': return 'text-rose-400';
      case 'csv':
      case 'xlsx': return 'text-emerald-400';
      case 'png':
      case 'jpg': return 'text-sky-400';
      case 'log': return 'text-indigo-400';
      default: return 'text-slate-400';
    }
  }

  getExtensionBadgeClass(ext: string): string {
    switch (ext) {
      case 'txt': return 'bg-slate-500/10 text-slate-300 border border-slate-500/20';
      case 'json': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'sql':
      case 'sqlite': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'pdf': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'csv':
      case 'xlsx': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'png':
      case 'jpg': return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
      case 'log': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      default: return 'bg-white/5 text-slate-300 border border-white/10';
    }
  }
}
