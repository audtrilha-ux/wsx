import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { PrinterService } from '../../../../core/printing/printer.service';
import { FileViewerModalComponent } from './components/file-viewer-modal.component';
import { FileDialogsComponent } from './components/file-dialogs.component';
import { FileGridComponent } from './components/file-grid.component';
import { FileExplorerSidebarComponent } from './components/file-explorer-sidebar.component';
import { VirtualFile, VirtualFolder } from '../../../../contracts/storage/virtual-fs.contract';
import { LinuxThemeService } from '../../../../core/theme/linux-theme.service';

@Component({
  selector: 'app-file-explorer',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    FileViewerModalComponent,
    FileDialogsComponent,
    FileGridComponent,
    FileExplorerSidebarComponent
  ],
  template: `
    <div [class]="themeService.isDeskTheme() ? 'h-full flex flex-col bg-[#16120e] text-amber-100 select-none font-sans overflow-hidden' : 'h-full flex flex-col bg-slate-900 text-slate-200 select-none font-sans overflow-hidden'">
      
      <!-- Top Ribbon / Action Bar (Windows 10 Explorer Style) -->
      <div [class]="themeService.isDeskTheme() ? 'bg-[#0f0c09] border-b border-amber-600/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0' : 'bg-slate-950/80 border-b border-white/10 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0'">
        
        <!-- Navigation Buttons & Address Bar -->
        <div class="flex items-center gap-2 flex-1 min-w-[280px]">
          <!-- Back / Forward / Up -->
          <div class="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
            <button 
              type="button"
              (click)="goBack()" 
              [disabled]="historyIndex() <= 0"
              [class.opacity-30]="historyIndex() <= 0"
              title="Voltar"
              class="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-300 disabled:hover:bg-transparent transition-colors cursor-pointer">
              <mat-icon class="text-sm">arrow_back</mat-icon>
            </button>
            <button 
              type="button"
              (click)="goForward()" 
              [disabled]="historyIndex() >= history().length - 1"
              [class.opacity-30]="historyIndex() >= history().length - 1"
              title="Avançar"
              class="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-300 disabled:hover:bg-transparent transition-colors cursor-pointer">
              <mat-icon class="text-sm">arrow_forward</mat-icon>
            </button>
            <button 
              type="button"
              (click)="goUp()" 
              [disabled]="currentFolderId() === 'root'"
              [class.opacity-30]="currentFolderId() === 'root'"
              title="Subir Nível"
              class="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-300 disabled:hover:bg-transparent transition-colors cursor-pointer">
              <mat-icon class="text-sm">arrow_upward</mat-icon>
            </button>
          </div>

          <!-- Address Bar / Breadcrumb Path -->
          <div class="flex-1 flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-300 truncate">
            <mat-icon class="text-xs text-amber-400">folder</mat-icon>
            <span class="text-slate-400">Este Computador</span>
            @if (currentFolder()) {
              <mat-icon class="text-xs text-slate-500">chevron_right</mat-icon>
              <span class="font-semibold text-white">{{ currentFolder()?.name }}</span>
            }
          </div>

          <!-- Refresh Button -->
          <button 
            type="button"
            (click)="refreshFolder()" 
            title="Atualizar Pasta"
            class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-300 transition-colors cursor-pointer">
            <mat-icon class="text-sm">refresh</mat-icon>
          </button>
        </div>

        <!-- Right Side: Actions & Search -->
        <div class="flex items-center gap-2">
          <!-- Action Buttons -->
          <div class="flex items-center gap-1">
            <button 
              type="button"
              (click)="openNewFileDialog()"
              [disabled]="currentFolderId() === 'root'"
              [class.opacity-40]="currentFolderId() === 'root'"
              title="Criar Novo Arquivo"
              class="flex items-center gap-1 px-2.5 py-1.5 bg-sky-600/30 hover:bg-sky-600/50 border border-sky-500/40 text-sky-300 text-xs font-medium rounded-lg transition-colors cursor-pointer">
              <mat-icon class="text-xs">note_add</mat-icon>
              <span class="hidden sm:inline">Novo Arquivo</span>
            </button>

            <button 
              type="button"
              (click)="openNewFolderDialog()"
              title="Nova Pasta"
              class="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-300 text-xs font-medium rounded-lg transition-colors cursor-pointer">
              <mat-icon class="text-xs">create_new_folder</mat-icon>
              <span class="hidden sm:inline">Nova Pasta</span>
            </button>

            @if (selectedFile()) {
              <button 
                type="button"
                (click)="deleteSelectedFile()"
                [disabled]="selectedFile()?.isSystem"
                title="Excluir Arquivo"
                class="flex items-center gap-1 px-2 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-300 text-xs font-medium rounded-lg transition-colors cursor-pointer">
                <mat-icon class="text-xs">delete</mat-icon>
              </button>
            }
          </div>

          <!-- View Mode Toggle -->
          <div class="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/5">
            <button 
              type="button"
              (click)="viewMode.set('grid')"
              [class.bg-white/10]="viewMode() === 'grid'"
              [class.text-white]="viewMode() === 'grid'"
              [class.text-slate-400]="viewMode() !== 'grid'"
              title="Exibição em Grade"
              class="w-7 h-7 flex items-center justify-center rounded text-xs transition-colors cursor-pointer">
              <mat-icon class="text-sm">grid_view</mat-icon>
            </button>
            <button 
              type="button"
              (click)="viewMode.set('list')"
              [class.bg-white/10]="viewMode() === 'list'"
              [class.text-white]="viewMode() === 'list'"
              [class.text-slate-400]="viewMode() !== 'list'"
              title="Exibição em Lista"
              class="w-7 h-7 flex items-center justify-center rounded text-xs transition-colors cursor-pointer">
              <mat-icon class="text-sm">format_list_bulleted</mat-icon>
            </button>
          </div>

          <!-- Search Input -->
          <div class="relative w-36 sm:w-48">
            <mat-icon class="absolute left-2 top-1.5 text-slate-400 text-xs">search</mat-icon>
            <input 
              type="text" 
              [value]="searchFilter()"
              (input)="onSearchInput($event)"
              placeholder="Pesquisar..." 
              class="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500">
          </div>
        </div>

      </div>

      <!-- Main Layout: Sidebar Tree + Content Viewport -->
      <div class="flex-1 flex overflow-hidden">
        
        <!-- Modular Left Tree Sidebar -->
        <app-file-explorer-sidebar
          [currentFolderId]="currentFolderId()"
          [mainFolders]="mainFolders()"
          (folderSelect)="navigateTo($event)" />

        <!-- Modular Main Content Grid / List View -->
        <app-file-grid
          [currentFolderId]="currentFolderId()"
          [mainFolders]="mainFolders()"
          [displayedFiles]="displayedFiles()"
          [allFiles]="files()"
          [viewMode]="viewMode()"
          [selectedFile]="selectedFile()"
          (folderSelect)="navigateTo($event)"
          (fileSelect)="selectFile($event)"
          (fileOpen)="previewFile($event)"
          (openNewFile)="openNewFileDialog()" />

      </div>

      <!-- Bottom Status Bar -->
      <div class="bg-slate-950 px-3 py-1.5 border-t border-white/5 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <span>{{ currentFolderId() === 'root' ? (mainFolders().length + ' pastas principais') : (displayedFiles().length + ' itens') }}</span>
          @if (selectedFile()) {
            <span class="text-sky-400">1 item selecionado ({{ formatBytes(selectedFile()!.sizeBytes) }})</span>
          }
        </div>
        <div class="flex items-center gap-4">
          <span>Armazenamento local do terminal</span>
          <span class="text-emerald-400 flex items-center gap-1 font-mono">
            <mat-icon class="text-[12px]">check_circle</mat-icon> Sincronizado com Outbox
          </span>
        </div>
      </div>

      <!-- Modular Modal: File Content Viewer & Thermal Spooler -->
      <app-file-viewer-modal
        [file]="activePreviewFile()"
        (closeModal)="activePreviewFile.set(null)"
        (printThermal)="printPreviewFile($event)"
        (download)="downloadFile($event)"
        (copyContent)="copyFileContent($event)" />

      <!-- Modular Dialogs: New File & New Folder -->
      <app-file-dialogs
        [isNewFileDialogOpen]="isNewFileDialogOpen()"
        [isNewFolderDialogOpen]="isNewFolderDialogOpen()"
        (closeNewFile)="isNewFileDialogOpen.set(false)"
        (createFile)="confirmCreateFile($event)"
        (closeNewFolder)="isNewFolderDialogOpen.set(false)"
        (createFolder)="confirmCreateFolder($event)" />

    </div>
  `
})
export class FileExplorerComponent {
  themeService = inject(LinuxThemeService);
  private printerService = inject(PrinterService);

  readonly currentFolderId = signal<string>('root');
  readonly history = signal<string[]>(['root']);
  readonly historyIndex = signal<number>(0);
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly searchFilter = signal<string>('');
  readonly selectedFile = signal<VirtualFile | null>(null);
  readonly activePreviewFile = signal<VirtualFile | null>(null);

  readonly isNewFileDialogOpen = signal<boolean>(false);
  readonly isNewFolderDialogOpen = signal<boolean>(false);

  readonly mainFolders = signal<VirtualFolder[]>([
    { id: 'documentos', name: 'Documentos', icon: 'folder_shared', iconColor: 'text-amber-400', parentId: 'root', description: 'Relatórios gerenciais e fiscais' },
    { id: 'downloads', name: 'Downloads', icon: 'download_for_offline', iconColor: 'text-sky-400', parentId: 'root', description: 'Arquivos baixados da web' },
    { id: 'imagens', name: 'Imagens', icon: 'photo_library', iconColor: 'text-emerald-400', parentId: 'root', description: 'Logotipos de recibo e banners' },
    { id: 'recibos', name: 'Cupons e Recibos', icon: 'receipt_long', iconColor: 'text-indigo-400', parentId: 'root', description: 'Bobinas térmicas de 80mm emitidas' },
    { id: 'backups', name: 'Backups e Sync', icon: 'cloud_sync', iconColor: 'text-purple-400', parentId: 'root', description: 'Filas offline e schemas' },
    { id: 'logs', name: 'Logs do Sistema', icon: 'dvr', iconColor: 'text-rose-400', parentId: 'root', description: 'Telemetria do Kernel e auditoria' }
  ]);

  readonly files = signal<VirtualFile[]>([
    {
      id: 'doc_1',
      name: 'balancete_gerencial_2026.txt',
      folderId: 'documentos',
      extension: 'txt',
      sizeBytes: 4200,
      updatedAt: '14/09/2026 09:30',
      content: '================================================\n   3EATCRU OS - BALANCETE GERENCIAL CONSOLIDADO \n================================================\nPeriodo: Setembro/2026\nReceita Bruta: R$ 64.250,00\nDespesas Fixas: R$ 12.400,00\nCMV: R$ 21.320,00\nLucro Operacional: R$ 30.530,00 (Margem: 47.5%)\n\nResumo de Caixas:\n- Caixa Balcão 01: R$ 2.450,00\n- Caixa Balcão 02: R$ 1.820,00\n- Conta Digital Matriz: R$ 59.980,00'
    },
    {
      id: 'doc_2',
      name: 'dre_trimestral_q3.csv',
      folderId: 'documentos',
      extension: 'csv',
      sizeBytes: 8420,
      updatedAt: '12/09/2026 18:15',
      content: 'Mes,Receita_Bruta,CMV,Despesas_Operacionais,Lucro_Liquido\nJulho,125000.00,42000.00,31000.00,52000.00\nAgosto,138000.00,46500.00,32500.00,59000.00\nSetembro,64000.00,21000.00,16000.00,27000.00'
    },
    {
      id: 'doc_3',
      name: 'politica_privacidade_lgpd.txt',
      folderId: 'documentos',
      extension: 'txt',
      sizeBytes: 3120,
      updatedAt: '10/09/2026 11:00',
      content: 'TERMOS DE PRIVACIDADE E CONFORMIDADE LGPD - 3EATCRU OS\nTodos os dados de clientes coletados no módulo CRM são criptografados em repouso e protegidos contra IDOR através de Company-Id isolado.'
    },
    {
      id: 'dl_1',
      name: 'kernel_v2.4_patch.tar.gz',
      folderId: 'downloads',
      extension: 'log',
      sizeBytes: 2450000,
      updatedAt: '13/09/2026 21:40',
      content: 'PATCH BINÁRIO DO KERNEL 3EATCRU OS\nVersão: 2.4.0-stable\nArquitetura: WebOS / Node / Angular 21'
    },
    {
      id: 'dl_2',
      name: 'manual_operador_pdv.pdf',
      folderId: 'downloads',
      extension: 'pdf',
      sizeBytes: 984000,
      updatedAt: '08/09/2026 14:20',
      content: 'MANUAL PRÁTICO DO OPERADOR DE CAIXA\n1. Abertura com suprimento de troco\n2. Registro de itens por código de barras ou catálogo\n3. Finalização de venda com QR Code Pix ou Cartão\n4. Emissão de Cupom SAT 80mm'
    },
    {
      id: 'img_1',
      name: 'logo_empresa_80mm.png',
      folderId: 'imagens',
      extension: 'png',
      sizeBytes: 24500,
      updatedAt: '05/09/2026 10:15',
      content: '[IMAGEM BINÁRIA PNG: Logotipo Monocromático de Alta Resolução calibrado para Cabeçalho de Impressoras Térmicas 80mm ESC/POS]'
    },
    {
      id: 'img_2',
      name: 'banner_promocional_mesa.jpg',
      folderId: 'imagens',
      extension: 'jpg',
      sizeBytes: 340000,
      updatedAt: '07/09/2026 16:30',
      content: '[IMAGEM JPEG: Banner de Mesa para Escaneamento do Cardápio Digital do Public Space]'
    },
    {
      id: 'rec_1',
      name: 'cupom_fiscal_sat_#1042.txt',
      folderId: 'recibos',
      extension: 'txt',
      sizeBytes: 1540,
      updatedAt: '14/09/2026 10:05',
      content: '================================================\n            3EATCRU OS - RECIBO DE VENDA        \n================================================\nCNPJ: 12.345.678/0001-90  IE: 123.456.789.000\nRua das Palmeiras, 100 - São Paulo/SP\n------------------------------------------------\nEXTRATO No. 001042\nCUPOM FISCAL ELETRONICO - SAT\n------------------------------------------------\n#|COD|DESC|QTD|UN|VL UN R$|VL ITEM R$\n001  7891000  HAMBURGUER ARTESANAL    2 UN  34.90  69.80\n002  7892000  REFRIGERANTE LATA 350ML 2 UN   6.50  13.00\n003  7893000  BATATA RUSTICA TRUFADA  1 UN  22.00  22.00\n------------------------------------------------\nTOTAL BRUTO:                           R$ 104.80\nDESCONTO FIDELIDADE:                   -R$ 10.00\nTOTAL A PAGAR:                          R$ 94.80\nFORMA DE PAGAMENTO: PIX DINAMICO QR CODE\n------------------------------------------------\nOperador: João Caixa #01\nTerminal: POS-TER-04  Bobina: 80mm\n================================================\n       Obrigado pela preferência! Volte sempre! \n================================================'
    },
    {
      id: 'rec_2',
      name: 'comprovante_sangria_#12.txt',
      folderId: 'recibos',
      extension: 'txt',
      sizeBytes: 890,
      updatedAt: '14/09/2026 09:12',
      content: '================================================\n           COMPROVANTE DE SANGRIA DE CAIXA      \n================================================\nTerminal: POS-01  Data: 14/09/2026 09:12\nValor Retirado: R$ 800,00 (Oitocentos Reais)\nMotivo: Recolhimento para o cofre central\nOperador: João Caixa #01\nSupervisor: Gerente Marcos\nAssinatura: ____________________________________'
    },
    {
      id: 'bkp_1',
      name: 'snapshot_outbox_queue.json',
      folderId: 'backups',
      extension: 'json',
      sizeBytes: 4200,
      updatedAt: '14/09/2026 10:00',
      content: '{\n  "version": "1.0",\n  "timestamp": "2026-09-14T10:00:00.000Z",\n  "queueEngine": "IndexedDB/SQLite",\n  "pendingMutations": 0,\n  "status": "synchronized_with_hq"\n}'
    },
    {
      id: 'log_1',
      name: 'security_audit.log',
      folderId: 'logs',
      extension: 'log',
      sizeBytes: 12400,
      updatedAt: '14/09/2026 08:00',
      content: '[2026-09-14 08:00:01] [KERNEL] Boot sequence initiated successfully.\n[2026-09-14 08:00:02] [AUTH] Operator João Caixa authenticated via PIN.\n[2026-09-14 08:00:03] [HARDWARE] Printer EPSON TM-T20X detected on /dev/usb/lp0 (Status: ONLINE).\n[2026-09-14 08:15:20] [SYNC] Heartbeat to Central HQ validated (RTT: 42ms).'
    }
  ]);

  readonly currentFolder = computed(() => {
    const id = this.currentFolderId();
    if (id === 'root') return null;
    return this.mainFolders().find(f => f.id === id) || null;
  });

  readonly displayedFiles = computed(() => {
    const folderId = this.currentFolderId();
    if (folderId === 'root') return [];

    let list = this.files().filter(f => f.folderId === folderId);
    const filter = this.searchFilter().trim().toLowerCase();
    if (filter) {
      list = list.filter(f => f.name.toLowerCase().includes(filter));
    }
    return list;
  });

  navigateTo(folderId: string) {
    if (this.currentFolderId() === folderId) return;

    this.currentFolderId.set(folderId);
    this.selectedFile.set(null);
    this.searchFilter.set('');

    const currentHistory = this.history().slice(0, this.historyIndex() + 1);
    this.history.set([...currentHistory, folderId]);
    this.historyIndex.set(this.history().length - 1);
  }

  goBack() {
    if (this.historyIndex() > 0) {
      const newIndex = this.historyIndex() - 1;
      this.historyIndex.set(newIndex);
      this.currentFolderId.set(this.history()[newIndex]);
      this.selectedFile.set(null);
    }
  }

  goForward() {
    if (this.historyIndex() < this.history().length - 1) {
      const newIndex = this.historyIndex() + 1;
      this.historyIndex.set(newIndex);
      this.currentFolderId.set(this.history()[newIndex]);
      this.selectedFile.set(null);
    }
  }

  goUp() {
    this.navigateTo('root');
  }

  refreshFolder() {
    const jobs = this.printerService.jobs();
    if (jobs.length > 0) {
      const existing = new Set(this.files().map(f => f.id));
      const newFiles: VirtualFile[] = [];

      for (const job of jobs) {
        const fileId = `job_${job.id}`;
        if (!existing.has(fileId)) {
          newFiles.push({
            id: fileId,
            name: `cupom_spooler_${job.id.substring(0, 6)}.txt`,
            folderId: 'recibos',
            extension: 'txt',
            sizeBytes: job.content.length,
            updatedAt: (job.createdAt ? new Date(job.createdAt) : new Date()).toLocaleString('pt-BR'),
            content: job.content
          });
        }
      }

      if (newFiles.length > 0) {
        this.files.update(f => [...newFiles, ...f]);
      }
    }
  }

  onSearchInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.searchFilter.set(val);
  }

  selectFile(file: VirtualFile) {
    this.selectedFile.set(file);
  }

  previewFile(file: VirtualFile) {
    this.selectedFile.set(file);
    this.activePreviewFile.set(file);
  }

  printPreviewFile(file: VirtualFile) {
    this.printerService.enqueue(file.name, file.content, '80mm');
    this.activePreviewFile.set(null);
  }

  downloadFile(file: VirtualFile) {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  copyFileContent(file: VirtualFile) {
    navigator.clipboard?.writeText(file.content);
  }

  deleteSelectedFile() {
    const target = this.selectedFile();
    if (!target || target.isSystem) return;

    this.files.update(f => f.filter(item => item.id !== target.id));
    this.selectedFile.set(null);
  }

  openNewFileDialog() {
    this.isNewFileDialogOpen.set(true);
  }

  confirmCreateFile(data: { name: string; content: string }) {
    const name = data.name.trim();
    if (!name) return;

    const extMatch = name.split('.').pop()?.toLowerCase();
    const ext = (extMatch === 'json' || extMatch === 'csv' || extMatch === 'pdf' || extMatch === 'log') ? extMatch : 'txt';

    const newFile: VirtualFile = {
      id: `file_${Date.now()}`,
      name,
      folderId: this.currentFolderId(),
      extension: ext as VirtualFile['extension'],
      sizeBytes: data.content.length,
      updatedAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      content: data.content
    };

    this.files.update(f => [newFile, ...f]);
    this.isNewFileDialogOpen.set(false);
    this.selectedFile.set(newFile);
  }

  openNewFolderDialog() {
    this.isNewFolderDialogOpen.set(true);
  }

  confirmCreateFolder(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const id = `folder_${Date.now()}`;
    const newFolder: VirtualFolder = {
      id,
      name: trimmed,
      icon: 'folder',
      iconColor: 'text-amber-400',
      parentId: this.currentFolderId(),
      description: 'Pasta criada pelo operador'
    };

    this.mainFolders.update(folders => [...folders, newFolder]);
    this.isNewFolderDialogOpen.set(false);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
