import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-file-dialogs',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- New File Dialog Modal -->
    @if (isNewFileDialogOpen()) {
      <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-3">
          <div class="flex items-center gap-2">
            <mat-icon class="text-sky-400">note_add</mat-icon>
            <h4 class="text-xs font-bold text-white">Criar Novo Arquivo</h4>
          </div>

          <div class="space-y-1">
            <label for="dialog-file-name" class="text-[11px] text-slate-400">Nome do Arquivo (com extensão):</label>
            <input 
              id="dialog-file-name"
              type="text" 
              [value]="newFileName()"
              (input)="onFileNameInput($event)"
              placeholder="ex: notas_fechamento.txt"
              class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans">
          </div>

          <div class="space-y-1">
            <label for="dialog-file-content" class="text-[11px] text-slate-400">Conteúdo Inicial:</label>
            <textarea 
              id="dialog-file-content"
              [value]="newFileContent()"
              (input)="onFileContentInput($event)"
              rows="4" 
              placeholder="Digite o conteúdo do arquivo aqui..."
              class="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"></textarea>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button 
              type="button"
              (click)="closeNewFile.emit()"
              class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300">
              Cancelar
            </button>
            <button 
              type="button"
              (click)="submitCreateFile()"
              [disabled]="!newFileName().trim()"
              class="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-xs font-semibold text-white">
              Criar Arquivo
            </button>
          </div>
        </div>
      </div>
    }

    <!-- New Folder Dialog Modal -->
    @if (isNewFolderDialogOpen()) {
      <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-3">
          <div class="flex items-center gap-2">
            <mat-icon class="text-amber-400">create_new_folder</mat-icon>
            <h4 class="text-xs font-bold text-white">Criar Nova Pasta</h4>
          </div>

          <div class="space-y-1">
            <label for="dialog-folder-name" class="text-[11px] text-slate-400">Nome da Pasta:</label>
            <input 
              id="dialog-folder-name"
              type="text" 
              [value]="newFolderName()"
              (input)="onFolderNameInput($event)"
              placeholder="ex: Relatórios 2026"
              class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans">
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button 
              type="button"
              (click)="closeNewFolder.emit()"
              class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300">
              Cancelar
            </button>
            <button 
              type="button"
              (click)="submitCreateFolder()"
              [disabled]="!newFolderName().trim()"
              class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-xs font-semibold text-white">
              Criar Pasta
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class FileDialogsComponent {
  isNewFileDialogOpen = input<boolean>(false);
  isNewFolderDialogOpen = input<boolean>(false);

  closeNewFile = output<void>();
  createFile = output<{ name: string; content: string }>();

  closeNewFolder = output<void>();
  createFolder = output<string>();

  newFileName = signal<string>('');
  newFileContent = signal<string>('');
  newFolderName = signal<string>('');

  onFileNameInput(e: Event) {
    this.newFileName.set((e.target as HTMLInputElement).value);
  }

  onFileContentInput(e: Event) {
    this.newFileContent.set((e.target as HTMLTextAreaElement).value);
  }

  onFolderNameInput(e: Event) {
    this.newFolderName.set((e.target as HTMLInputElement).value);
  }

  submitCreateFile() {
    const name = this.newFileName().trim();
    if (!name) return;
    this.createFile.emit({ name, content: this.newFileContent() });
    this.newFileName.set('');
    this.newFileContent.set('');
  }

  submitCreateFolder() {
    const name = this.newFolderName().trim();
    if (!name) return;
    this.createFolder.emit(name);
    this.newFolderName.set('');
  }
}
