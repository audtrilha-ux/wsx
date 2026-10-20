import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { VirtualFolder } from '../../../../../contracts/storage/virtual-fs.contract';

@Component({
  selector: 'app-file-explorer-sidebar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-52 border-r border-white/10 bg-slate-950/60 p-3 flex flex-col gap-4 shrink-0 overflow-y-auto hidden sm:flex">
      
      <!-- Quick Access Group -->
      <div class="space-y-1">
        <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1">
          <mat-icon class="text-[12px] text-amber-400">star</mat-icon>
          <span>Acesso Rápido</span>
        </div>
        
        <button 
          type="button"
          (click)="folderSelect.emit('root')"
          [class.bg-white/10]="currentFolderId() === 'root'"
          [class.text-white]="currentFolderId() === 'root'"
          [class.text-slate-300]="currentFolderId() !== 'root'"
          class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-xs transition-colors text-left cursor-pointer">
          <mat-icon class="text-sm text-sky-400">computer</mat-icon>
          <span>Este Computador</span>
        </button>

        @for (folder of mainFolders(); track folder.id) {
          <button 
            type="button"
            (click)="folderSelect.emit(folder.id)"
            [class.bg-white/10]="currentFolderId() === folder.id"
            [class.text-white]="currentFolderId() === folder.id"
            [class.text-slate-300]="currentFolderId() !== folder.id"
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-xs transition-colors text-left cursor-pointer">
            <mat-icon class="text-sm" [ngClass]="folder.iconColor">{{ folder.icon }}</mat-icon>
            <span class="truncate">{{ folder.name }}</span>
          </button>
        }
      </div>

      <!-- Storage Drivers Section -->
      <div class="space-y-1.5 pt-2 border-t border-white/5">
        <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2">Unidades Virtuais</div>
        
        <div class="px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
          <div class="flex items-center justify-between text-[11px]">
            <div class="flex items-center gap-1.5 font-medium text-slate-300">
              <mat-icon class="text-xs text-sky-400">hard_drive</mat-icon>
              <span>OS Root (C:)</span>
            </div>
            <span class="text-[10px] text-slate-400">184 GB livres</span>
          </div>
          <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div class="h-full bg-sky-500 rounded-full" style="width: 28%"></div>
          </div>
        </div>

        <div class="px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
          <div class="flex items-center justify-between text-[11px]">
            <div class="flex items-center gap-1.5 font-medium text-slate-300">
              <mat-icon class="text-xs text-indigo-400">cloud</mat-icon>
              <span>3eatcru Cloud (Z:)</span>
            </div>
            <span class="text-[10px] text-slate-400">4.8 GB livres</span>
          </div>
          <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div class="h-full bg-indigo-500 rounded-full" style="width: 52%"></div>
          </div>
        </div>
      </div>

    </div>
  `
})
export class FileExplorerSidebarComponent {
  currentFolderId = input<string>('root');
  mainFolders = input<VirtualFolder[]>([]);

  folderSelect = output<string>();
}
