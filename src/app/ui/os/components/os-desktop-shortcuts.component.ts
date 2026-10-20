import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { OutboxOperation } from '../../../core/sync/sync.service';
import { LinuxThemeService } from '../../../core/theme/linux-theme.service';
import { OsProfileService } from '../../../core/os-profile/os-profile.service';

export interface AppShortcut {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface StickyNote {
  id: string;
  title: string;
  content: string;
  color: 'amber' | 'emerald' | 'indigo' | 'rose' | 'slate';
  createdAt: string;
}

@Component({
  selector: 'app-os-desktop-shortcuts',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main 
      (contextmenu)="onContextMenu($event)" 
      class="flex-1 relative p-6 flex flex-col flex-wrap gap-6 content-start z-0 overflow-y-auto">
      
      <!-- Desktop Shortcut: Este Computador / Explorador de Arquivos -->
      <button (click)="openFileExplorer.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-amber-600/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">folder_open</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">Este Computador</span>
      </button>

      <!-- Desktop Shortcut: Sacola & Comanda Balcão -->
      <button (click)="openCart.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform"
          [class]="themeService.isDeskTheme() ? 'desk-brass-plate !text-amber-950 font-bold border border-amber-300/60' : 'bg-amber-600/90'">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">receipt_long</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">Comanda Balcão</span>
      </button>

      <!-- Desktop Shortcut: App Store / Marketplace -->
      <button (click)="openStore.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-indigo-600/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">storefront</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">App Store</span>
      </button>

      <!-- Desktop Shortcut: Navegador Web Inteligente -->
      <button (click)="openBrowser.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-blue-600/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">public</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">Navegador</span>
      </button>

      <!-- Desktop Shortcut: Meus Aplicativos -->
      <button (click)="openInstalledApps.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-emerald-600/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">apps</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">Meus Apps</span>
      </button>

      <!-- Desktop Shortcut: Painel de Controle -->
      <button (click)="openSettings.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-slate-700/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">settings</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">Painel de Controle</span>
      </button>

      <!-- Desktop Shortcut: Gerenciador de Tarefas -->
      <button (click)="openTaskManager.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-rose-700/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">view_timeline</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">Tarefas OS</span>
      </button>

      <!-- Desktop Shortcuts Dinâmicos dos Aplicativos Instalados -->
      @for (app of installedAppShortcuts(); track app.id) {
        <button (click)="openApp.emit(app); $event.stopPropagation()" 
          [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
          class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
          <div 
            [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
            class="shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform" [ngClass]="app.color">
            <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                      [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                      [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                      class="leading-none flex items-center justify-center">{{ app.icon }}</mat-icon>
          </div>
          <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
                class="text-white font-semibold drop-shadow-md text-center leading-tight">{{ app.name }}</span>
        </button>
      }

      <!-- Premium B2B Operator & Sync Bento Dashboard Sidebar -->
      <div 
        (mousedown)="$event.stopPropagation()"
        [class]="themeService.isDeskTheme() 
          ? 'absolute top-6 right-6 bottom-20 w-[360px] desk-drawer border border-amber-600/40 rounded-2xl flex flex-col pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.85)] hidden lg:flex overflow-hidden text-[#fef3c7]' 
          : 'absolute top-6 right-6 bottom-20 w-[360px] linux-glass border border-white/10 rounded-2xl flex flex-col pointer-events-auto shadow-2xl hidden lg:flex overflow-hidden linux-accent-glow'">
        
        <!-- Dashboard Header -->
        <div [class]="themeService.isDeskTheme() ? 'p-3.5 border-b border-amber-600/30 flex items-center justify-between bg-black/40' : 'p-3.5 border-b border-white/10 flex items-center justify-between bg-black/30'">
          <div class="flex items-center gap-2">
            <div 
              [class]="themeService.isDeskTheme() ? 'w-6 h-6 rounded desk-brass-plate flex items-center justify-center text-amber-950 font-bold' : 'w-6 h-6 rounded-lg bg-[var(--accent-color)]/20 flex items-center justify-center text-[var(--accent-color)]'">
              <mat-icon class="text-sm">{{ themeService.isDeskTheme() ? 'desk' : 'terminal' }}</mat-icon>
            </div>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">Painel do Operador</span>
          </div>
          <div class="flex items-center gap-2">
            <span 
              [class]="themeService.isDeskTheme() ? 'text-[9px] font-mono text-amber-300 font-bold' : 'text-[9px] font-mono text-[var(--accent-color)]'">
              {{ themeService.currentTheme().distro.split(' ')[0] }}
            </span>
            <span class="h-2 w-2 rounded-full" [ngClass]="syncHealthy() ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'"></span>
          </div>
        </div>

        <!-- Dashboard Tab Selectors -->
        <div class="flex border-b border-white/5 bg-black/20 shrink-0">
          <button 
            type="button"
            (click)="activeTab.set('fastfetch')"
            [class]="activeTab() === 'fastfetch' ? 'border-b-2 border-[var(--accent-color)] text-[var(--accent-color)] font-bold bg-white/5' : 'text-slate-400 hover:text-slate-200'"
            class="flex-1 py-2 text-[10px] uppercase tracking-wider text-center transition-all">
            Terminal
          </button>
          <button 
            type="button"
            (click)="activeTab.set('status')"
            [class]="activeTab() === 'status' ? 'border-b-2 border-[var(--accent-color)] text-[var(--accent-color)] font-bold bg-white/5' : 'text-slate-400 hover:text-slate-200'"
            class="flex-1 py-2 text-[10px] uppercase tracking-wider text-center transition-all">
            Status
          </button>
          <button 
            type="button"
            (click)="activeTab.set('memos')"
            [class]="activeTab() === 'memos' ? 'border-b-2 border-[var(--accent-color)] text-[var(--accent-color)] font-bold bg-white/5' : 'text-slate-400 hover:text-slate-200'"
            class="flex-1 py-2 text-[10px] uppercase tracking-wider text-center transition-all relative">
            Memos
            @if (notes().length > 0) {
              <span class="absolute right-1.5 top-2 px-1 py-0.5 rounded-full text-[7px] font-bold bg-amber-500 text-slate-950 leading-none">
                {{ notes().length }}
              </span>
            }
          </button>
          <button 
            type="button"
            (click)="activeTab.set('sync')"
            [class]="activeTab() === 'sync' ? 'border-b-2 border-[var(--accent-color)] text-[var(--accent-color)] font-bold bg-white/5' : 'text-slate-400 hover:text-slate-200'"
            class="flex-1 py-2 text-[10px] uppercase tracking-wider text-center transition-all relative">
            Outbox
            @if (outboxOps().length > 0) {
              <span class="absolute right-1.5 top-2 px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-amber-500 text-slate-950 animate-pulse leading-none">
                {{ outboxOps().length }}
              </span>
            }
          </button>
        </div>

        <!-- Scrollable Tab Content Container -->
        <div class="flex-1 overflow-y-auto p-3.5 space-y-3.5 no-scrollbar">
          
          <!-- TAB 0: LINUX FASTFETCH / NEOFETCH DESKLET -->
          @if (activeTab() === 'fastfetch') {
            <div class="space-y-3 animate-fade-in font-mono text-[11px] text-slate-300">
              <div class="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2">
                <div class="flex items-center gap-2 pb-2 border-b border-white/10">
                  <div class="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                  <span class="text-[9px] text-slate-400 font-bold ml-1">terminal@3eatcru-linux:~</span>
                </div>

                <div class="space-y-1 text-[10px] leading-relaxed">
                  @if (themeService.isDeskTheme()) {
                    <div class="text-amber-400 font-bold font-mono text-[9px] leading-tight pb-1 border-b border-amber-600/30 whitespace-pre">{{ deskAsciiBanner }}</div>
                  } @else {
                    <div class="text-[var(--accent-color)] font-bold">
                      root@enterprise-terminal
                    </div>
                  }
                  <div class="text-slate-500">--------------------------------</div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">OS:</span>
                    <span class="text-white font-bold">{{ themeService.currentTheme().distro }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">Ambiente:</span>
                    <span class="text-slate-200">{{ themeService.isDeskTheme() ? 'Mesa de Nogueira + Gaveta Tátil' : 'BigLinux Glass / KWin' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">Modo OS:</span>
                    <span [class]="profileService.activeProfile() === 'retail' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'">
                      {{ profileService.activeProfile() === 'retail' ? 'Varejo & Comércio' : 'Restaurantes & Gastronomia' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">Iluminação:</span>
                    <span class="text-amber-400 font-bold">
                      {{ themeService.deskLampEnabled() ? 'Luminária Acesa (Incandescente)' : 'Luz Ambiente (Apagada)' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">Janelas:</span>
                    <span class="text-slate-200">{{ themeService.isDeskTheme() ? 'Folhas de Papel (Parchment)' : 'Frames Translúcidos KWin' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">DB Engine:</span>
                    <span class="text-emerald-400 font-bold">SQLite ACID Local-First</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">Rede Sync:</span>
                    <span [class]="networkOnline() ? 'text-emerald-400' : 'text-amber-400'">
                      {{ networkOnline() ? 'LAN Online' : 'Local Offline' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">Apps no Host:</span>
                    <span class="text-slate-200">{{ installedAppShortcuts().length }} apps do perfil</span>
                  </div>
                </div>

                <!-- Palette Colors Strip -->
                <div class="pt-2 border-t border-white/5 flex gap-1 justify-center">
                  <span class="w-4 h-3 rounded bg-slate-800"></span>
                  <span class="w-4 h-3 rounded bg-rose-600"></span>
                  <span class="w-4 h-3 rounded bg-amber-500"></span>
                  <span class="w-4 h-3 rounded bg-emerald-500"></span>
                  <span class="w-4 h-3 rounded bg-cyan-500"></span>
                  <span class="w-4 h-3 rounded bg-blue-500"></span>
                  <span class="w-4 h-3 rounded bg-purple-500"></span>
                  <span class="w-4 h-3 rounded bg-slate-200"></span>
                </div>
              </div>

              <!-- Quick Command Action -->
              <button 
                type="button"
                (click)="openBrowser.emit()"
                class="w-full bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] py-1.5 rounded-lg border border-white/10 transition-all flex items-center justify-center gap-1.5 font-mono">
                <mat-icon class="text-xs text-[var(--accent-color)]">menu_book</mat-icon>
                Consultar Manuais & Docs
              </button>
            </div>
          }

          <!-- TAB 1: TELEMETRIA E HARDWARE -->
          @if (activeTab() === 'status') {
            <div class="space-y-3.5 animate-fade-in">
              
              <!-- Connection Health Card -->
              <div class="bg-slate-900/60 border border-white/5 rounded-xl p-3 space-y-2.5">
                <span class="text-[9px] uppercase tracking-wider font-bold text-slate-400">Diagnóstico de Conexão</span>
                
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-slate-400 flex items-center gap-1.5">
                      <mat-icon class="text-sm">wifi</mat-icon> Rede Local
                    </span>
                    <span [class]="networkOnline() ? 'text-emerald-400 font-bold' : 'text-amber-500 font-bold'" class="flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full" [ngClass]="networkOnline() ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                      {{ networkOnline() ? 'Ativa' : 'Desconectada' }}
                    </span>
                  </div>
                  
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-slate-400 flex items-center gap-1.5">
                      <mat-icon class="text-sm">cloud_queue</mat-icon> Nuvem 3eatcru
                    </span>
                    <span [class]="serverReachable() ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'" class="flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full" [ngClass]="serverReachable() ? 'bg-emerald-400' : 'bg-rose-500'"></span>
                      {{ serverReachable() ? 'Alcançável' : 'Inalcançável' }}
                    </span>
                  </div>

                  <div class="flex items-center justify-between text-xs pt-1.5 border-t border-white/5">
                    <span class="text-slate-400">Status Geral:</span>
                    <span [class]="syncHealthy() ? 'text-emerald-400 font-bold' : 'text-amber-500 font-bold'">
                      {{ syncHealthy() ? '100% Saudável' : 'Requer Atenção' }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Hardware Paper Roll Monitor -->
              <div class="bg-slate-900/60 border border-white/5 rounded-xl p-3 space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-[9px] uppercase tracking-wider font-bold text-slate-400">Bobina Térmica Local</span>
                  <button 
                    type="button"
                    (click)="togglePrinterPaper.emit()"
                    class="text-[9px] text-indigo-400 hover:text-indigo-300 font-semibold uppercase hover:underline">
                    Alternar Papel
                  </button>
                </div>

                <div class="space-y-2">
                  <div class="flex justify-between text-xs items-center">
                    <span class="text-slate-400 flex items-center gap-1.5">
                      <mat-icon class="text-sm">print</mat-icon> Bobina 80mm
                    </span>
                    <span [class]="isPrinterOnline() ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'">
                      {{ isPrinterOnline() ? 'Papel Ok' : 'Sem Papel' }}
                    </span>
                  </div>

                  <!-- Simulated Paper Level Bar -->
                  <div class="space-y-1">
                    <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        [class]="isPrinterOnline() ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'" 
                        [style.width.%]="isPrinterOnline() ? 85 : 0"
                        class="h-full rounded-full transition-all duration-500">
                      </div>
                    </div>
                    <div class="flex justify-between text-[9px] text-slate-500">
                      <span>Vazio</span>
                      <span>Restante: {{ isPrinterOnline() ? '85%' : '0%' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Receipt Reprint Action -->
                <button 
                  type="button"
                  (click)="reprintLastReceipt.emit()"
                  class="w-full bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] py-1.5 rounded-lg border border-white/10 transition-all flex items-center justify-center gap-1">
                  <mat-icon class="text-xs">replay</mat-icon>
                  Imprimir 2ª Via do Último Cupom
                </button>
              </div>

              <!-- Platform Diagnostics Quick Card -->
              <div class="bg-slate-900/60 border border-white/5 rounded-xl p-3 space-y-3">
                <span class="text-[9px] uppercase tracking-wider font-bold text-slate-400">Auditoria & Core OS</span>
                
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div class="bg-slate-950/40 p-2 rounded-lg border border-white/5 text-center">
                    <div class="text-slate-400 text-[10px]">OS Target</div>
                    <div class="font-mono text-xs font-bold text-slate-200 mt-0.5">v1.2.0</div>
                  </div>
                  <div class="bg-slate-950/40 p-2 rounded-lg border border-white/5 text-center">
                    <div class="text-slate-400 text-[10px]">Banco SQLite</div>
                    <div class="font-mono text-xs font-bold text-emerald-400 mt-0.5">ACID OK</div>
                  </div>
                </div>

                <button 
                  type="button"
                  (click)="triggerDiagnostics.emit()"
                  class="w-full bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-[10px] py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md">
                  <mat-icon class="text-xs">monitor_heart</mat-icon>
                  Auditar Integridade do Core OS
                </button>
              </div>

            </div>
          }

          <!-- TAB 2: LEMBRETES PERSISTENTES (MEMOS) -->
          @if (activeTab() === 'memos') {
            <div class="space-y-4 animate-fade-in flex flex-col h-full">
              
              <!-- Memo controls / Navigation -->
              <div class="flex items-center justify-between border-b border-white/5 pb-2.5 shrink-0">
                <button 
                  type="button"
                  (click)="addNote()"
                  class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                  <mat-icon class="text-[12px]">add</mat-icon> Novo Memo
                </button>

                @if (notes().length > 1) {
                  <div class="flex items-center gap-1.5 text-xs text-slate-400">
                    <button 
                      type="button"
                      (click)="prevNote()" 
                      class="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors">
                      <mat-icon class="text-sm">chevron_left</mat-icon>
                    </button>
                    <span class="font-mono text-[10px] font-bold">
                      {{ getActiveNoteIndex() + 1 }} / {{ notes().length }}
                    </span>
                    <button 
                      type="button"
                      (click)="nextNote()" 
                      class="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors">
                      <mat-icon class="text-sm">chevron_right</mat-icon>
                    </button>
                  </div>
                }
              </div>

              <!-- Sticky Note Post-It Card visual -->
              @if (activeNote(); as note) {
                <div 
                  [ngClass]="{
                    'bg-amber-500/10 border-amber-500/30 text-amber-100': note.color === 'amber',
                    'bg-emerald-500/10 border-emerald-500/30 text-emerald-100': note.color === 'emerald',
                    'bg-indigo-500/10 border-indigo-500/30 text-indigo-100': note.color === 'indigo',
                    'bg-rose-500/10 border-rose-500/30 text-rose-100': note.color === 'rose',
                    'bg-slate-800/40 border-white/10 text-slate-200': note.color === 'slate'
                  }"
                  class="flex-1 border p-4 rounded-xl space-y-3 shadow-inner relative flex flex-col min-h-[220px]">
                  
                  <!-- Title Inplace Input -->
                  <div class="flex items-center justify-between gap-2 shrink-0">
                    <input 
                      type="text"
                      [value]="note.title"
                      (input)="updateNoteTitle($event)"
                      placeholder="Título do lembrete"
                      [ngClass]="{
                        'text-amber-200': note.color === 'amber',
                        'text-emerald-200': note.color === 'emerald',
                        'text-indigo-200': note.color === 'indigo',
                        'text-rose-200': note.color === 'rose',
                        'text-slate-100': note.color === 'slate'
                      }"
                      class="bg-transparent border-none p-0 focus:ring-0 focus:outline-none font-bold text-xs flex-1 placeholder-slate-500">
                    
                    <span class="text-[8px] font-mono opacity-50 shrink-0">{{ note.createdAt }}</span>
                  </div>

                  <!-- Textarea Content -->
                  <textarea 
                    rows="6"
                    [value]="note.content"
                    (input)="updateNoteContent($event)"
                    placeholder="Escreva seu lembrete..."
                    class="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-[11px] leading-relaxed resize-none flex-1 w-full placeholder-slate-500 font-sans"></textarea>

                  <!-- Note controls footer -->
                  <div class="flex justify-between items-center pt-2 border-t border-white/5 shrink-0">
                    <!-- Palette Switcher -->
                    <div class="flex items-center gap-1.5">
                      <button type="button" (click)="setNoteColor('amber')" class="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white/10 transition-transform hover:scale-110" title="Amarelo"></button>
                      <button type="button" (click)="setNoteColor('emerald')" class="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white/10 transition-transform hover:scale-110" title="Verde"></button>
                      <button type="button" (click)="setNoteColor('indigo')" class="w-3.5 h-3.5 rounded-full bg-indigo-500 border border-white/10 transition-transform hover:scale-110" title="Azul"></button>
                      <button type="button" (click)="setNoteColor('rose')" class="w-3.5 h-3.5 rounded-full bg-rose-500 border border-white/10 transition-transform hover:scale-110" title="Vermelho"></button>
                      <button type="button" (click)="setNoteColor('slate')" class="w-3.5 h-3.5 rounded-full bg-slate-500 border border-white/10 transition-transform hover:scale-110" title="Cinza"></button>
                    </div>

                    <!-- Delete button -->
                    <button 
                      type="button"
                      (click)="deleteNote()"
                      title="Excluir Lembrete"
                      class="text-rose-400 hover:text-rose-300 transition-colors">
                      <mat-icon class="text-xs">delete</mat-icon>
                    </button>
                  </div>
                </div>
              } @else {
                <div class="text-center py-12 text-slate-500 text-xs font-sans">
                  Nenhum lembrete salvo. Clique acima para criar um.
                </div>
              }

            </div>
          }

          <!-- TAB 3: REALTIME SYNCHRONIZER OUTBOX -->
          @if (activeTab() === 'sync') {
            <div class="space-y-4 animate-fade-in flex flex-col h-full">
              
              <!-- Quick Stats banner -->
              <div class="bg-slate-900/60 border border-white/5 rounded-xl p-3 flex justify-between items-center shrink-0">
                <div class="space-y-0.5">
                  <div class="text-[9px] uppercase tracking-wider font-bold text-slate-400">Tamanho da Fila Outbox</div>
                  <div class="text-sm font-black font-mono text-slate-100">{{ outboxOps().length }} transações</div>
                </div>
                
                <button 
                  type="button"
                  (click)="triggerManualSync.emit()"
                  [disabled]="outboxOps().length === 0"
                  [class]="outboxOps().length > 0 ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black animate-pulse shadow-md' : 'bg-white/5 text-slate-500 border border-white/10'"
                  class="px-3 py-1.5 text-[9px] rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 font-bold">
                  <mat-icon class="text-[11px]">sync</mat-icon>
                  Sincronizar
                </button>
              </div>

              <!-- Feed of Outbox Transactions -->
              <div class="flex-1 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                @for (op of outboxOps().slice(0, 5); track op.id) {
                  <div class="p-2.5 rounded-xl border bg-slate-900/40 border-white/5 flex items-start gap-2.5 text-xs transition-all hover:bg-slate-900/60">
                    <!-- Category Icon -->
                    <div class="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-300 flex items-center justify-center shrink-0">
                      <mat-icon class="text-sm">{{ getAppIcon(op.appId, op.action) }}</mat-icon>
                    </div>

                    <!-- Transaction details -->
                    <div class="flex-1 min-w-0 space-y-1">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-bold text-slate-200 truncate">{{ formatActionName(op.action) }}</span>
                        <span class="text-[8px] font-mono text-slate-500 shrink-0">{{ formatTime(op.timestamp) }}</span>
                      </div>
                      
                      <!-- Status Badge -->
                      <div class="flex items-center justify-between">
                        <span class="text-[9px] font-mono text-slate-400 truncate max-w-[120px]" [title]="op.idempotencyKey">
                          ID: {{ op.id.replace('op_', '') }}
                        </span>
                        
                        <!-- Badges based on status -->
                        @if (op.status === 'pending') {
                          <span class="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                            <span class="w-1 h-1 bg-amber-400 rounded-full animate-ping"></span> Pendente
                          </span>
                        } @else if (op.status === 'processing') {
                          <span class="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                            <span class="w-1 h-1 bg-sky-400 rounded-full animate-spin"></span> Processando
                          </span>
                        } @else if (op.status === 'failed') {
                          <span class="px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                            <mat-icon class="text-[8px] h-2 w-2 leading-none">warning</mat-icon> Falhou
                          </span>
                        } @else if (op.status === 'dead_letter') {
                          <span class="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5" [title]="op.lastError || 'Erro permanente'">
                            <mat-icon class="text-[8px] h-2 w-2 leading-none">error_outline</mat-icon> Morto
                          </span>
                        } @else {
                          <span class="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                            Sincro
                          </span>
                        }
                      </div>

                      <!-- Fail details for debugging -->
                      @if (op.status === 'dead_letter' || (op.status === 'failed' && op.lastError)) {
                        <p class="text-[8px] text-rose-300 bg-rose-950/30 p-1 rounded font-mono truncate leading-normal">
                          Erro: {{ op.lastError || 'Fator desconhecido' }}
                        </p>
                      }
                    </div>
                  </div>
                } @empty {
                  <div class="text-center py-8 bg-slate-900/20 border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center p-4">
                    <mat-icon class="text-3xl text-emerald-500/40">cloud_done</mat-icon>
                    <span class="text-[10px] font-bold text-slate-300 mt-2">Nenhuma transação pendente</span>
                    <span class="text-[8px] text-slate-500 mt-0.5">O banco local está totalmente consolidado.</span>
                  </div>
                }
              </div>

              <!-- Backoff alert if dead letters exist -->
              @if (deadLetterCount() > 0) {
                <div class="p-2.5 rounded-xl bg-rose-950/35 border border-rose-500/30 flex items-start gap-2 text-[10px] text-rose-300 shrink-0 animate-pulse">
                  <mat-icon class="text-xs text-rose-400 mt-0.5">warning</mat-icon>
                  <div>
                    <span class="font-bold block">Fila Morta (Dead-Letter Queue)</span>
                    <p class="text-[9px] opacity-80 mt-0.5">Existem {{ deadLetterCount() }} transações retidas devido a rejeição permanente da Central. Acesse Tarefas para resolver.</p>
                  </div>
                </div>
              }
            </div>
          }

        </div>

        <!-- Terminal Status Metadata Footer -->
        <div class="p-3 bg-slate-950/60 border-t border-white/10 flex items-center justify-between text-[9px] text-slate-500 font-mono shrink-0">
          <span>Licença: Enterprise</span>
          <span>Last Sync: {{ lastSyncedAt() ? (lastSyncedAt() | date:'HH:mm:ss') : 'N/A' }}</span>
        </div>

      </div>

    </main>
  `
})
export class OsDesktopShortcutsComponent {
  desktopIconSize = input<'small' | 'normal' | 'large'>('normal');
  installedAppShortcuts = input<AppShortcut[]>([]);
  isPrinterOnline = input<boolean>(true);
  outboxLength = input<number>(0);

  // New inputs for complete real-time dashboard status
  companyId = input<string>('');
  isOnline = input<boolean>(true);
  networkOnline = input<boolean>(true);
  serverReachable = input<boolean>(true);
  syncStatus = input<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  lastSyncedAt = input<Date | null>(null);
  deadLetterCount = input<number>(0);
  syncHealthy = input<boolean>(true);
  outboxOps = input<OutboxOperation[]>([]);

  openFileExplorer = output<void>();
  openStore = output<void>();
  openBrowser = output<void>();
  openInstalledApps = output<void>();
  openSettings = output<void>();
  openTaskManager = output<void>();
  openCart = output<void>();
  openApp = output<AppShortcut>();
  contextMenu = output<MouseEvent>();

  triggerDiagnostics = output<void>();
  triggerManualSync = output<void>();
  toggleNetwork = output<void>();
  togglePrinterPaper = output<void>();
  reprintLastReceipt = output<void>();
  themeService = inject(LinuxThemeService);
  profileService = inject(OsProfileService);

  readonly deskAsciiBanner = [
    ' ____  _____     _    ',
    '|  _ \\| ____|___| | __',
    '| | | |  _| / __| |/ /',
    '| |_| | |___\\__ \\   < ',
    '|____/|_____|___/_|\\_\\',
    'DEsk v0.1.2 (fyzugx/DEsk)'
  ].join('\n');

  // Dashboard state signals
  activeTab = signal<'fastfetch' | 'status' | 'memos' | 'sync'>('fastfetch');
  notes = signal<StickyNote[]>([]);
  activeNoteId = signal<string | null>(null);

  constructor() {
    // Automatically load & save persistent company-isolated sticky notes using a reactive effect
    effect(() => {
      const id = this.companyId();
      if (id) {
        const stored = localStorage.getItem(`3eatcru_memos_${id}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            this.notes.set(parsed);
            if (parsed.length > 0) {
              this.activeNoteId.set(parsed[0].id);
            } else {
              this.activeNoteId.set(null);
            }
          } catch {
            this.initializeDefaultNotes();
          }
        } else {
          this.initializeDefaultNotes();
        }
      }
    });
  }

  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    this.contextMenu.emit(event);
  }

  // Sticky Notes (Memos) Operations
  initializeDefaultNotes() {
    const defaultNotes: StickyNote[] = [
      {
        id: 'note_default_1',
        title: 'Memo de Operação',
        content: 'Bem-vindo ao 3eatcru OS!\nUse esta área de lembretes para anotações do turno do operador. Todas as notas mudam de cor e persistem automaticamente neste dispositivo por empresa.',
        color: 'amber',
        createdAt: new Date().toLocaleDateString('pt-BR')
      }
    ];
    this.notes.set(defaultNotes);
    this.activeNoteId.set('note_default_1');
    this.saveNotes();
  }

  saveNotes() {
    const id = this.companyId();
    if (id) {
      localStorage.setItem(`3eatcru_memos_${id}`, JSON.stringify(this.notes()));
    }
  }

  addNote() {
    const id = 'memo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newNote: StickyNote = {
      id,
      title: 'Nota Nova',
      content: 'Digite seu lembrete aqui...',
      color: 'amber',
      createdAt: new Date().toLocaleDateString('pt-BR')
    };
    this.notes.update(curr => [...curr, newNote]);
    this.activeNoteId.set(id);
    this.saveNotes();
  }

  deleteNote() {
    const currentId = this.activeNoteId();
    if (!currentId) return;
    
    const list = this.notes();
    if (list.length <= 1) {
      this.initializeDefaultNotes();
      return;
    }
    
    const idx = list.findIndex(n => n.id === currentId);
    const updated = list.filter(n => n.id !== currentId);
    this.notes.set(updated);
    
    const nextIdx = idx === 0 ? 0 : idx - 1;
    this.activeNoteId.set(updated[nextIdx].id);
    this.saveNotes();
  }

  updateNoteTitle(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const currentId = this.activeNoteId();
    if (!currentId || !inputEl) return;
    
    this.notes.update(curr => 
      curr.map(n => n.id === currentId ? { ...n, title: inputEl.value } : n)
    );
    this.saveNotes();
  }

  updateNoteContent(event: Event) {
    const textareaEl = event.target as HTMLTextAreaElement;
    const currentId = this.activeNoteId();
    if (!currentId || !textareaEl) return;
    
    this.notes.update(curr => 
      curr.map(n => n.id === currentId ? { ...n, content: textareaEl.value } : n)
    );
    this.saveNotes();
  }

  setNoteColor(color: 'amber' | 'emerald' | 'indigo' | 'rose' | 'slate') {
    const currentId = this.activeNoteId();
    if (!currentId) return;
    
    this.notes.update(curr => 
      curr.map(n => n.id === currentId ? { ...n, color } : n)
    );
    this.saveNotes();
  }

  prevNote() {
    const list = this.notes();
    if (list.length <= 1) return;
    const currentId = this.activeNoteId();
    const idx = list.findIndex(n => n.id === currentId);
    if (idx > 0) {
      this.activeNoteId.set(list[idx - 1].id);
    } else {
      this.activeNoteId.set(list[list.length - 1].id);
    }
  }

  nextNote() {
    const list = this.notes();
    if (list.length <= 1) return;
    const currentId = this.activeNoteId();
    const idx = list.findIndex(n => n.id === currentId);
    if (idx < list.length - 1) {
      this.activeNoteId.set(list[idx + 1].id);
    } else {
      this.activeNoteId.set(list[0].id);
    }
  }

  // Getters & Computeds
  activeNote = computed(() => {
    const currentId = this.activeNoteId();
    if (!currentId) return null;
    return this.notes().find(n => n.id === currentId) || null;
  });

  getActiveNoteIndex(): number {
    const currentId = this.activeNoteId();
    if (!currentId) return 0;
    return this.notes().findIndex(n => n.id === currentId);
  }

  // App Outbox List Helpers
  getAppIcon(appId?: string, action?: string): string {
    if (appId === 'app_pos' || action?.toLowerCase().includes('sale')) return 'point_of_sale';
    if (appId === 'app_inventory' || action?.toLowerCase().includes('stock')) return 'inventory_2';
    if (appId === 'app_tables' || action?.toLowerCase().includes('table')) return 'checklist';
    if (appId === 'app_crm' || action?.toLowerCase().includes('customer')) return 'groups';
    if (appId === 'app_finance' || action?.toLowerCase().includes('expense')) return 'payments';
    return 'settings_input_component';
  }

  formatActionName(action: string): string {
    if (!action) return 'Operação Geral';
    const lower = action.toLowerCase();
    if (lower.includes('sale') || lower.includes('transaction')) return 'Venda Frente Caixa';
    if (lower.includes('stock') || lower.includes('inventory')) return 'Ajuste de Estoque';
    if (lower.includes('customer') || lower.includes('crm')) return 'Atualização CRM';
    if (lower.includes('table') || lower.includes('order')) return 'Comanda/Mesa';
    if (lower.includes('finance') || lower.includes('expense')) return 'Movimentação Caixa';
    if (lower.includes('print')) return 'Impressão Cupom';
    
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  formatTime(isoString?: string): string {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      return `${h}:${m}:${s}`;
    } catch {
      return '';
    }
  }
}

