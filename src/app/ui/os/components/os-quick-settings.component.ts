import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LinuxThemeService, LINUX_THEME_PRESETS, LINUX_WALLPAPERS } from '../../../core/theme/linux-theme.service';
import { OsProfileType } from '../../../core/os-profile/os-profile.service';

@Component({
  selector: 'app-os-quick-settings',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (isOpen()) {
      <div 
        [class]="themeService.isDeskTheme() 
          ? 'absolute bottom-16 left-4 right-4 sm:left-auto sm:w-92 max-h-[calc(100vh-6rem)] overflow-y-auto z-50 rounded-2xl desk-drawer border border-amber-600/40 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-[#fef3c7] p-4 space-y-4 animate-tray-slide' 
          : 'absolute bottom-16 left-4 right-4 sm:left-auto sm:w-92 max-h-[calc(100vh-6rem)] overflow-y-auto z-50 rounded-2xl linux-glass border border-white/10 shadow-2xl text-[var(--text-primary)] p-4 space-y-4 animate-tray-slide linux-accent-glow'">
        
        <!-- Header: BigLinux Control Center or DEsk Switchboard -->
        <div [class]="themeService.isDeskTheme() ? 'flex justify-between items-center border-b border-amber-600/30 pb-2.5' : 'flex justify-between items-center border-b border-white/10 pb-2.5'">
          <div class="flex items-center gap-2">
            <div 
              [class]="themeService.isDeskTheme() ? 'w-6 h-6 rounded desk-brass-plate flex items-center justify-center text-amber-950 font-bold' : 'text-[var(--accent-color)]'">
              <mat-icon class="text-sm">tune</mat-icon>
            </div>
            <h3 class="text-xs font-bold text-white">
              {{ themeService.isDeskTheme() ? 'Painel de Comando Físico (DEsk)' : 'Centro de Controle OS' }}
            </h3>
          </div>
          <span 
            [class]="themeService.isDeskTheme() ? 'text-[9px] uppercase font-mono font-bold text-amber-300 tracking-wider' : 'text-[9px] uppercase font-mono font-bold text-[var(--accent-color)] tracking-wider'">
            {{ themeService.currentTheme().distro.split(' ')[0] }}
          </span>
        </div>

        <!-- Operational Profile Selector (Varejo x Restaurantes) -->
        <div class="space-y-2 border-b border-white/10 pb-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Modo Operacional da Empresa</span>
            <span 
              [class]="themeService.isDeskTheme() ? 'text-[8px] font-mono text-amber-300' : 'text-[8px] font-mono text-[var(--accent-color)]'">
              Suíte Pré-instalada
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <!-- Varejo Button -->
            <button 
              type="button"
              (click)="selectProfile.emit('retail')"
              [class]="activeProfile() === 'retail'
                ? (themeService.isDeskTheme() ? 'desk-brass-plate text-amber-950 font-bold ring-2 ring-amber-400/80 shadow-md' : 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400')
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'"
              class="p-2.5 rounded-xl flex flex-col gap-1 text-left transition-all">
              <div class="flex items-center justify-between">
                <mat-icon class="text-base">storefront</mat-icon>
                @if (activeProfile() === 'retail') {
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                }
              </div>
              <span class="text-[11px] font-bold">Modo Varejo</span>
              <span class="text-[8px] opacity-80 leading-tight">PDV, Estoque, CRM e Telegram</span>
            </button>

            <!-- Restaurantes Button -->
            <button 
              type="button"
              (click)="selectProfile.emit('restaurant')"
              [class]="activeProfile() === 'restaurant'
                ? (themeService.isDeskTheme() ? 'desk-brass-plate text-amber-950 font-bold ring-2 ring-amber-400/80 shadow-md' : 'bg-amber-600 text-white font-bold ring-2 ring-amber-400')
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'"
              class="p-2.5 rounded-xl flex flex-col gap-1 text-left transition-all">
              <div class="flex items-center justify-between">
                <mat-icon class="text-base">restaurant</mat-icon>
                @if (activeProfile() === 'restaurant') {
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                }
              </div>
              <span class="text-[11px] font-bold">Modo Restaurante</span>
              <span class="text-[8px] opacity-80 leading-tight">Mesas/KDS, Finanças e PDV</span>
            </button>
          </div>
        </div>

        <!-- Distro Theme Selector (BigLinux, KDE Plasma, Manjaro, Ubuntu, Arch, DEsk) -->
        <div class="space-y-2">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ambiente Visual & Temas</span>
          <div class="grid grid-cols-2 gap-1.5">
            @for (theme of distroThemes; track theme.id) {
              <button 
                type="button"
                (click)="themeService.setTheme(theme.id)"
                [class]="themeService.activeThemeId() === theme.id 
                  ? 'border-[var(--accent-color)] bg-white/15 text-white ring-1 ring-[var(--accent-color)]' 
                  : 'border-white/5 bg-white/5 hover:bg-white/10 text-slate-300'"
                class="p-2 border rounded-xl flex items-center gap-2 text-left transition-all">
                <span class="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" [style.backgroundColor]="theme.accentColor"></span>
                <div class="min-w-0">
                  <div class="text-[10px] font-bold truncate">{{ theme.name }}</div>
                  <div class="text-[8px] text-slate-400 truncate">{{ theme.distro.split(' ')[0] }}</div>
                </div>
              </button>
            }
          </div>
        </div>

        <!-- Dock Layout Mode (Floating Dock vs Fixed Panel) -->
        <div class="space-y-1.5 border-t border-white/10 pt-3">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Layout da Barra de Tarefas</span>
          <div class="grid grid-cols-2 gap-2">
            <button 
              type="button"
              (click)="themeService.setDockMode('floating')"
              [class]="themeService.dockMode() === 'floating' 
                ? 'border-[var(--accent-color)] bg-white/15 text-white ring-1 ring-[var(--accent-color)]' 
                : 'border-white/5 bg-white/5 hover:bg-white/10 text-slate-300'"
              class="p-2 border rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all">
              <mat-icon class="text-sm text-[var(--accent-color)]">dock</mat-icon>
              <span>Dock Flutuante</span>
            </button>
            <button 
              type="button"
              (click)="themeService.setDockMode('panel')"
              [class]="themeService.dockMode() === 'panel' 
                ? 'border-[var(--accent-color)] bg-white/15 text-white ring-1 ring-[var(--accent-color)]' 
                : 'border-white/5 bg-white/5 hover:bg-white/10 text-slate-300'"
              class="p-2 border rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all">
              <mat-icon class="text-sm text-[var(--accent-color)]">web_asset</mat-icon>
              <span>Painel Fixo</span>
            </button>
          </div>
        </div>

        <!-- Quick Toggles Matrix (Hardware & Connectivity) -->
        <div class="space-y-1.5 border-t border-white/10 pt-3">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hardware & Conectividade</span>
          <div class="grid grid-cols-2 gap-2">
            
            <!-- Toggle 1: Connection -->
            <button 
              type="button"
              (click)="toggleNetwork.emit()"
              [class]="isOnline() ? 'bg-[var(--accent-color)] text-slate-950 font-bold border-transparent' : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/5'"
              class="p-2.5 border rounded-xl flex flex-col gap-1 text-left transition-all">
              <mat-icon class="text-base">{{ isOnline() ? 'wifi' : 'wifi_off' }}</mat-icon>
              <span class="text-[10px] font-bold">Rede Local</span>
              <span class="text-[9px] opacity-80">{{ isOnline() ? 'Online' : 'Offline' }}</span>
            </button>

            <!-- Toggle 2: Printer Paper Status -->
            <button 
              type="button"
              (click)="togglePrinterPaper.emit()"
              [class]="hasPaper() ? 'bg-emerald-600 text-white font-bold border-transparent' : 'bg-rose-950/60 text-rose-300 border-rose-500/30'"
              class="p-2.5 border rounded-xl flex flex-col gap-1 text-left transition-all">
              <mat-icon class="text-base">print</mat-icon>
              <span class="text-[10px] font-bold">Bobina Térmica</span>
              <span class="text-[9px] opacity-80">{{ hasPaper() ? 'Pronta' : 'Sem Papel' }}</span>
            </button>

            <!-- Toggle 3: Run Diagnostics -->
            <button 
              type="button"
              (click)="triggerDiagnostics.emit()"
              class="p-2.5 border border-white/5 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col gap-1 text-left text-white transition-all">
              <mat-icon class="text-base text-[var(--accent-color)]">analytics</mat-icon>
              <span class="text-[10px] font-bold">Diagnóstico OS</span>
              <span class="text-[9px] text-slate-400">Integridade</span>
            </button>

            <!-- Toggle 4: Reprint last job -->
            <button 
              type="button"
              (click)="reprintLastReceipt.emit()"
              class="p-2.5 border border-white/5 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col gap-1 text-left text-white transition-all">
              <mat-icon class="text-base text-amber-400">receipt_long</mat-icon>
              <span class="text-[10px] font-bold">Reimprimir</span>
              <span class="text-[9px] text-slate-400">Segunda Via</span>
            </button>

            <!-- Toggle 5: Skeuomorphic Desk Lamp Lighting (fyzugx/DEsk inspired) -->
            <button 
              type="button"
              (click)="themeService.toggleDeskLamp()"
              [class]="themeService.deskLampEnabled() ? 'bg-amber-500 text-slate-950 font-bold border-transparent' : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/5'"
              class="p-2.5 border rounded-xl flex flex-col gap-1 text-left transition-all">
              <mat-icon class="text-base" [class.text-amber-300]="themeService.deskLampEnabled()">light_mode</mat-icon>
              <span class="text-[10px] font-bold">Luminária Balcão</span>
              <span class="text-[9px] opacity-80">{{ themeService.deskLampEnabled() ? 'Acesa' : 'Apagada' }}</span>
            </button>

            <!-- Toggle 6: Cash Drawer / Gaveta -->
            <button 
              type="button"
              (click)="triggerCashDrawer()"
              class="p-2.5 border border-white/5 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col gap-1 text-left text-white transition-all">
              <mat-icon class="text-base text-yellow-500">payments</mat-icon>
              <span class="text-[10px] font-bold">Gaveta Física</span>
              <span class="text-[9px] text-slate-400">Abrir Caixa</span>
            </button>

          </div>
        </div>

        <!-- Window Arrangement Tools -->
        <div class="space-y-1.5 border-t border-white/10 pt-3">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gerenciador de Janelas</span>
          <div class="grid grid-cols-2 gap-1.5">
            <button 
              type="button"
              (click)="openDisplaySettings.emit(); closePanel.emit()"
              class="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-[10px] py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1">
              <mat-icon class="text-xs text-[var(--accent-color)]">desktop_windows</mat-icon>
              Resolução Display
            </button>
            <button 
              type="button"
              (click)="autoFitWindows.emit(); closePanel.emit()"
              class="bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-slate-950 font-bold text-[10px] py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1">
              <mat-icon class="text-xs">aspect_ratio</mat-icon>
              Organizar em Grade
            </button>
          </div>
        </div>

        <!-- Curated Linux Wallpaper Selector -->
        <div class="space-y-1.5 border-t border-white/10 pt-3">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Papéis de Parede</span>
          <div class="flex gap-2 overflow-x-auto no-scrollbar py-1">
            @for (wp of linuxWallpapers; track wp.id) {
              <button 
                type="button"
                (click)="onSelectWallpaper(wp)"
                [title]="wp.name + ' (' + wp.distro + ')'"
                [class]="themeService.activeWallpaperId() === wp.id ? 'ring-2 ring-[var(--accent-color)] scale-105' : 'opacity-70 hover:opacity-100'"
                class="w-10 h-10 rounded-xl overflow-hidden border border-white/15 shrink-0 transition-all flex flex-col items-center justify-center"
                [style.backgroundColor]="wp.previewColor">
                <mat-icon class="text-white text-xs opacity-80">wallpaper</mat-icon>
                <span class="text-[7px] text-white font-mono font-bold">{{ wp.distro.slice(0, 3).toUpperCase() }}</span>
              </button>
            }
          </div>
        </div>

      </div>
    }
  `
})
export class OsQuickSettingsComponent {
  themeService = inject(LinuxThemeService);

  isOpen = input<boolean>(false);
  isOnline = input<boolean>(true);
  hasPaper = input<boolean>(true);
  outboxCount = input<number>(0);
  autoFitActive = input<boolean>(true);
  desktopIconSize = input<'small' | 'normal' | 'large'>('normal');
  wallpapers = input<{ id: string; name: string; css: string }[]>([]);
  activeWallpaper = input<string>('');
  activeProfile = input<OsProfileType>('retail');

  closePanel = output<void>();
  toggleNetwork = output<void>();
  togglePrinterPaper = output<void>();
  triggerDiagnostics = output<void>();
  reprintLastReceipt = output<void>();
  triggerManualSync = output<void>();
  toggleAutoFit = output<void>();
  setDesktopIconSize = output<'small' | 'normal' | 'large'>();
  openDisplaySettings = output<void>();
  autoFitWindows = output<void>();
  setWallpaper = output<string>();
  openCashDrawer = output<void>();
  selectProfile = output<OsProfileType>();

  distroThemes = Object.values(LINUX_THEME_PRESETS);
  linuxWallpapers = LINUX_WALLPAPERS;

  triggerCashDrawer() {
    this.openCashDrawer.emit();
  }

  onSelectWallpaper(wp: typeof LINUX_WALLPAPERS[0]) {
    this.themeService.setWallpaper(wp.id);
    this.setWallpaper.emit(wp.css);
  }
}
