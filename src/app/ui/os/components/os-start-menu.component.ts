import { Component, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LinuxThemeService } from '../../../core/theme/linux-theme.service';
import { OsProfileService } from '../../../core/os-profile/os-profile.service';

export interface StartMenuAppItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  category: 'ALL' | 'OFFICE' | 'NETWORK' | 'SYSTEM' | 'UTILITIES';
  isSystem: boolean;
}

export type LinuxMenuCategory = 'ALL' | 'OFFICE' | 'NETWORK' | 'SYSTEM' | 'UTILITIES';

export interface InstalledAppItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
}

@Component({
  selector: 'app-os-start-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (isOpen()) {
      <div 
        id="linux-start-menu"
        [class]="themeService.isDeskTheme() 
          ? 'absolute bottom-16 left-2 sm:left-4 w-[calc(100vw-1rem)] sm:w-[680px] md:w-[740px] h-[540px] max-h-[calc(100vh-5rem)] z-50 desk-drawer rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] text-[#fef3c7] flex flex-col overflow-hidden animate-start-slide select-none border border-amber-600/40' 
          : 'absolute bottom-16 left-2 sm:left-4 w-[calc(100vw-1rem)] sm:w-[680px] md:w-[740px] h-[540px] max-h-[calc(100vh-5rem)] z-50 linux-glass border border-white/10 rounded-2xl shadow-2xl text-[var(--text-primary)] flex flex-col overflow-hidden animate-start-slide select-none linux-accent-glow'">
        
        <!-- Top Distro & Operator Header -->
        <div 
          [class]="themeService.isDeskTheme() ? 'px-4 py-3 border-b border-amber-600/30 flex items-center justify-between bg-black/40 shrink-0' : 'px-4 py-3 border-b border-white/10 flex items-center justify-between bg-black/30 shrink-0'">
          <div class="flex items-center gap-3">
            <div 
              [class]="themeService.isDeskTheme() 
                ? 'w-9 h-9 rounded-xl desk-brass-plate text-amber-950 flex items-center justify-center font-bold shadow-md' 
                : 'w-9 h-9 rounded-xl bg-[var(--accent-color)] text-slate-950 flex items-center justify-center font-bold shadow-md'">
              <mat-icon class="text-xl">{{ themeService.isDeskTheme() ? 'inventory_2' : 'terminal' }}</mat-icon>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-white tracking-wide">
                  {{ themeService.isDeskTheme() ? 'Fichário & Gaveta Central' : themeService.currentTheme().distro }}
                </span>
                <span 
                  [class]="themeService.isDeskTheme() 
                    ? 'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                    : 'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-white/10 text-[var(--accent-color)] border border-white/10'">
                  {{ themeService.currentTheme().name }}
                </span>
                <span 
                  [class]="profileService.activeProfile() === 'retail' 
                    ? 'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30'">
                  {{ profileService.activeProfile() === 'retail' ? '🏬 Varejo' : '🍽️ Restaurante' }}
                </span>
              </div>
              <div class="text-[10px] text-amber-200/70 font-mono flex items-center gap-1.5 mt-0.5">
                <span>{{ operatorName() }}</span>
                @if (companyName()) {
                  <span>•</span>
                  <span class="text-amber-100 font-semibold">{{ companyName() }}</span>
                }
                <span>•</span>
                <span class="text-amber-400 font-bold uppercase">{{ operatorRole() }}</span>
              </div>
            </div>
          </div>

          <!-- Quick Action Buttons in Header -->
          <div class="flex items-center gap-1">
            <button 
              type="button"
              (click)="openSettings.emit(); closeMenu.emit()"
              title="Configurações do Sistema"
              class="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <mat-icon class="text-sm">settings</mat-icon>
            </button>
            <button 
              type="button"
              (click)="lockSystem.emit(); closeMenu.emit()"
              title="Bloquear Terminal (Super + L)"
              class="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <mat-icon class="text-sm">lock</mat-icon>
            </button>
            <button 
              type="button"
              (click)="closeMenu.emit()"
              title="Fechar Menu"
              class="w-8 h-8 rounded-lg hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center text-slate-400 transition-colors">
              <mat-icon class="text-sm">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Fast Search Input -->
        <div class="p-3 border-b border-white/5 bg-black/20 shrink-0">
          <div class="relative flex items-center">
            <mat-icon class="absolute left-3 text-slate-400 text-sm">search</mat-icon>
            <input 
              id="start-menu-search"
              type="text" 
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              (keydown.enter)="onSearchEnter()"
              placeholder="Pesquisar aplicativos, utilitários e manuais..."
              class="w-full bg-slate-900/80 border border-white/10 focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all font-mono"
            />
            @if (searchQuery()) {
              <button 
                type="button"
                (click)="searchQuery.set('')"
                class="absolute right-2 text-slate-400 hover:text-white p-1">
                <mat-icon class="text-xs">clear</mat-icon>
              </button>
            }
          </div>
        </div>

        <!-- Middle Body: Categories Sidebar + App Grid -->
        <div class="flex-1 flex min-h-0">
          
          <!-- Categories Sidebar (BigLinux Style) -->
          <div class="w-44 sm:w-48 border-r border-white/5 bg-black/20 py-2 flex flex-col gap-0.5 overflow-y-auto no-scrollbar shrink-0">
            @for (cat of categories; track cat.id) {
              <button 
                type="button"
                (click)="selectedCategory.set(cat.id)"
                [class]="selectedCategory() === cat.id 
                  ? (themeService.isDeskTheme() ? 'desk-brass-plate !text-amber-950 font-bold pl-3 shadow-sm' : 'bg-white/10 text-white font-bold border-l-2 border-[var(--accent-color)] pl-3.5')
                  : (themeService.isDeskTheme() ? 'text-amber-200/70 hover:text-amber-100 hover:bg-amber-950/30 pl-3.5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 pl-4')"
                class="w-full py-2.5 pr-3 text-left text-xs flex items-center gap-2.5 transition-all cursor-pointer">
                <mat-icon class="text-sm" [class.text-[var(--accent-color)]]="selectedCategory() === cat.id && !themeService.isDeskTheme()" [class.text-amber-950]="selectedCategory() === cat.id && themeService.isDeskTheme()">
                  {{ cat.icon }}
                </mat-icon>
                <span class="truncate">{{ cat.label }}</span>
              </button>
            }

            <div class="my-2 border-t border-white/5 mx-3"></div>

            <!-- Fast Native App Launchers in Sidebar -->
            <button 
              type="button"
              (click)="openBrowser.emit(); closeMenu.emit()"
              class="w-full py-2 pl-4 pr-3 text-left text-xs flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              <mat-icon class="text-sm text-cyan-400">explore</mat-icon>
              <span>Navegador Web</span>
            </button>
            <button 
              type="button"
              (click)="openTaskManager.emit(); closeMenu.emit()"
              class="w-full py-2 pl-4 pr-3 text-left text-xs flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              <mat-icon class="text-sm text-emerald-400">view_timeline</mat-icon>
              <span>Gerenciador</span>
            </button>
            <button 
              type="button"
              (click)="openCalculator.emit(); closeMenu.emit()"
              class="w-full py-2 pl-4 pr-3 text-left text-xs flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              <mat-icon class="text-sm text-amber-400">calculate</mat-icon>
              <span>Calculadora</span>
            </button>
            <button 
              type="button"
              (click)="openFileExplorer.emit(); closeMenu.emit()"
              class="w-full py-2 pl-4 pr-3 text-left text-xs flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              <mat-icon class="text-sm text-indigo-400">folder_open</mat-icon>
              <span>Explorador</span>
            </button>
          </div>

          <!-- Apps Grid Area -->
          <div class="flex-1 p-3.5 overflow-y-auto no-scrollbar">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              @for (app of categoryFilteredApps(); track app.id) {
                <button 
                  type="button"
                  (click)="onSelectApp(app)"
                  [class]="themeService.isDeskTheme()
                    ? 'group flex items-start gap-3 p-2.5 rounded-xl bg-[#261910]/80 hover:bg-[#342216] border border-amber-600/30 hover:border-amber-400 transition-all duration-200 text-left shadow-sm'
                    : 'group flex items-start gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[var(--accent-color)]/50 transition-all duration-200 text-left'">
                  
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform" [ngClass]="app.color">
                    <mat-icon class="text-white text-lg">{{ app.icon }}</mat-icon>
                  </div>
                  
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold transition-colors truncate" [class.text-amber-100]="themeService.isDeskTheme()" [class.text-white]="!themeService.isDeskTheme()" [class.group-hover:text-amber-300]="themeService.isDeskTheme()" [class.group-hover:text-[var(--accent-color)]]="!themeService.isDeskTheme()">
                        {{ app.name }}
                      </span>
                      @if (app.isSystem) {
                        <span class="px-1 py-0.2 rounded text-[8px] font-mono" [class.bg-amber-500/20]="themeService.isDeskTheme()" [class.text-amber-300]="themeService.isDeskTheme()" [class.bg-white/10]="!themeService.isDeskTheme()" [class.text-slate-300]="!themeService.isDeskTheme()">CORE</span>
                      }
                    </div>
                    <p class="text-[10px] line-clamp-1 mt-0.5" [class.text-amber-300/70]="themeService.isDeskTheme()" [class.text-slate-400]="!themeService.isDeskTheme()">
                      {{ app.desc }}
                    </p>
                  </div>
                </button>
              }

              @if (categoryFilteredApps().length === 0) {
                <div class="col-span-full py-12 flex flex-col items-center justify-center text-center text-slate-500">
                  <mat-icon class="text-3xl text-slate-600 mb-2">search_off</mat-icon>
                  <p class="text-xs font-semibold text-slate-400">Nenhum aplicativo encontrado</p>
                  <p class="text-[10px] text-slate-500 mt-0.5">Pressione Enter para pesquisar nos manuais</p>
                </div>
              }
            </div>
          </div>

        </div>

        <!-- Bottom Footer Bar: Session controls -->
        <div class="px-4 py-2.5 border-t border-white/10 bg-black/40 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <button 
              type="button"
              (click)="openInstalledApps.emit(); closeMenu.emit()"
              class="px-3 py-1.5 rounded-xl bg-[var(--accent-color)] text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-[var(--accent-hover)] transition-all shadow-md">
              <mat-icon class="text-sm">apps</mat-icon>
              <span>Meus Aplicativos</span>
            </button>
            <button 
              type="button"
              (click)="openSettings.emit(); closeMenu.emit()"
              class="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 text-xs flex items-center gap-1.5 transition-colors">
              <mat-icon class="text-sm">tune</mat-icon>
              <span>Ajustes</span>
            </button>
            <button 
              type="button"
              (click)="refreshDesktop.emit(); closeMenu.emit()"
              title="Recarregar Área de Trabalho"
              class="px-2 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 text-xs flex items-center gap-1 transition-colors">
              <mat-icon class="text-sm">refresh</mat-icon>
            </button>
          </div>

          <button 
            type="button"
            (click)="logoutSession.emit(); closeMenu.emit()"
            class="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-1.5 transition-colors font-medium">
            <mat-icon class="text-sm">power_settings_new</mat-icon>
            <span>Encerrar Sessão</span>
          </button>
        </div>

      </div>
    }
  `
})
export class OsStartMenuComponent {
  themeService = inject(LinuxThemeService);
  profileService = inject(OsProfileService);

  isOpen = input<boolean>(false);
  companyName = input<string>('');
  activeOperator = input<{ name: string; role: string } | null>(null);
  installedApps = input<InstalledAppItem[]>([]);

  closeMenu = output<void>();
  openInstalledApps = output<void>();
  openSettings = output<void>();
  openBrowser = output<void>();
  openTaskManager = output<void>();
  openCalculator = output<void>();
  openFileExplorer = output<void>();
  openApp = output<string>();
  launchApp = output<StartMenuAppItem>();
  lockSystem = output<void>();
  refreshDesktop = output<void>();
  logoutSession = output<void>();
  searchWeb = output<string>();

  searchQuery = signal<string>('');
  selectedCategory = signal<LinuxMenuCategory>('ALL');

  operatorName = computed(() => this.activeOperator()?.name || 'Operador');
  operatorRole = computed(() => this.activeOperator()?.role || 'OPERATOR');

  readonly categories: { id: LinuxMenuCategory; label: string; icon: string }[] = [
    { id: 'ALL', label: 'Todos os Apps', icon: 'apps' },
    { id: 'OFFICE', label: 'Escritório & Negócios', icon: 'point_of_sale' },
    { id: 'NETWORK', label: 'Canais & Integrações', icon: 'hub' },
    { id: 'SYSTEM', label: 'Sistema & Kernel', icon: 'tune' },
    { id: 'UTILITIES', label: 'Utilitários & Ferramentas', icon: 'build' }
  ];

  allAppItems = computed<StartMenuAppItem[]>(() => {
    const rawBusinessApps = this.installedApps() || [];
    const businessApps: StartMenuAppItem[] = rawBusinessApps.map(app => ({
      id: app.id,
      name: app.name,
      desc: app.description || 'Aplicativo corporativo do tenant',
      icon: app.icon || 'apps',
      color: this.getAppColor(app.category, app.id),
      category: this.mapBusinessCategory(app.category, app.id),
      isSystem: false
    }));

    const systemApps: StartMenuAppItem[] = [
      { id: 'app_settings', name: 'Painel de Controle', desc: 'Configurações de temas Linux, som e tela', icon: 'settings', color: 'bg-slate-700', category: 'SYSTEM', isSystem: true },
      { id: 'app_store', name: 'Loja de Apps', desc: 'Gerenciador de pacotes e catálogo central', icon: 'storefront', color: 'bg-indigo-600', category: 'OFFICE', isSystem: true },
      { id: 'app_dev_hub', name: 'Developer Hub', desc: 'Depurador de Kernel, releases OTA e telemetria', icon: 'developer_board', color: 'bg-emerald-600', category: 'SYSTEM', isSystem: true },
      { id: 'app_browser', name: 'Navegador Web', desc: 'Navegador integrado para documentação e web', icon: 'language', color: 'bg-cyan-600', category: 'NETWORK', isSystem: true },
      { id: 'app_calculator', name: 'Calculadora', desc: 'Calculadora rápida para conferência de caixa', icon: 'calculate', color: 'bg-amber-600', category: 'UTILITIES', isSystem: true },
      { id: 'app_notes', name: 'Bloco de Notas', desc: 'Editor rápido de anotações da operação', icon: 'description', color: 'bg-teal-600', category: 'UTILITIES', isSystem: true },
      { id: 'app_health_diagnostics', name: 'Diagnósticos de Hardware', desc: 'Status da impressora térmica, balança e SQLite', icon: 'monitor_heart', color: 'bg-purple-600', category: 'SYSTEM', isSystem: true }
    ];

    return [...businessApps, ...systemApps];
  });

  categoryFilteredApps = computed<StartMenuAppItem[]>(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
    const items = this.allAppItems();

    if (query) {
      return items.filter(a => 
        a.name.toLowerCase().includes(query) || 
        a.desc.toLowerCase().includes(query) ||
        a.id.toLowerCase().includes(query)
      );
    }

    if (cat === 'ALL') {
      return items;
    }

    return items.filter(a => a.category === cat);
  });

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input?.value || '');
  }

  onSearchEnter() {
    const q = this.searchQuery().trim();
    if (q) {
      this.searchWeb.emit(q);
      this.closeMenu.emit();
    }
  }

  onSelectApp(app: StartMenuAppItem) {
    this.launchApp.emit(app);
    this.openApp.emit(app.id);
    this.closeMenu.emit();
  }

  private mapBusinessCategory(category?: string, appId?: string): LinuxMenuCategory {
    if (appId === 'app_pos' || category === 'SALES' || appId === 'app_tables' || category === 'RESTAURANT' || appId === 'app_finance' || category === 'FINANCE') {
      return 'OFFICE';
    }
    if (appId === 'app_whatsapp' || appId === 'app_telegram' || appId === 'app_ifood' || appId === 'app_public_space') {
      return 'NETWORK';
    }
    if (appId === 'app_inventory' || category === 'INVENTORY' || appId === 'app_crm' || category === 'CRM') {
      return 'OFFICE';
    }
    return 'UTILITIES';
  }

  private getAppColor(category?: string, appId?: string): string {
    if (appId === 'app_pos' || category === 'SALES') return 'bg-cyan-600';
    if (appId === 'app_inventory' || category === 'INVENTORY') return 'bg-emerald-600';
    if (appId === 'app_crm' || category === 'CRM') return 'bg-purple-600';
    if (appId === 'app_finance' || category === 'FINANCE') return 'bg-teal-600';
    if (appId === 'app_tables' || category === 'RESTAURANT') return 'bg-amber-600';
    if (appId === 'app_public_space' || category === 'PUBLIC_SPACE') return 'bg-blue-600';
    if (appId === 'app_whatsapp') return 'bg-emerald-500';
    if (appId === 'app_telegram') return 'bg-sky-500';
    if (appId === 'app_ifood') return 'bg-rose-500';
    return 'bg-indigo-600';
  }
}
