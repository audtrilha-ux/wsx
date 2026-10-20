import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WindowState } from '../../../core/application/window-manager.service';
import { LinuxThemeService } from '../../../core/theme/linux-theme.service';
import { OsProfileType } from '../../../core/os-profile/os-profile.service';

@Component({
  selector: 'app-os-taskbar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="themeService.isFloatingDock() ? 'p-2 flex justify-center w-full z-50 pointer-events-none' : 'w-full z-50'">
      <footer 
        [class]="themeService.isDeskTheme()
          ? 'h-14 max-w-6xl w-full rounded-2xl desk-drawer flex items-center justify-between px-3.5 z-50 shrink-0 select-none shadow-2xl pointer-events-auto transition-all duration-300 relative'
          : (themeService.isFloatingDock() 
            ? 'h-14 max-w-6xl w-full rounded-2xl linux-glass border border-white/10 linux-accent-glow flex items-center justify-between px-3.5 z-50 shrink-0 select-none shadow-2xl pointer-events-auto transition-all duration-300 relative' 
            : 'h-14 w-full bg-[var(--bg-surface)]/90 backdrop-blur-md border-t border-white/5 flex items-center justify-between px-4 z-50 shrink-0 select-none transition-all duration-300 relative')">
        
        <!-- DEsk Drawer Central Brass Pull Handle Accent -->
        @if (themeService.isDeskTheme()) {
          <div class="absolute left-1/2 -top-2.5 -translate-x-1/2 px-3 py-0.5 rounded-full desk-brass-plate flex items-center gap-1.5 shadow-md pointer-events-none border border-amber-300/40">
            <span class="desk-brass-screw"></span>
            <span class="text-[8px] font-bold uppercase tracking-widest font-mono text-amber-950">GAVETA DE APLICATIVOS</span>
            <span class="desk-brass-screw"></span>
          </div>
        }

        <!-- Start Button & Active Apps (Linux Launcher + Dock) -->
        <div class="flex items-center gap-2 h-full">
          <!-- Linux Distro Launcher Button -->
          <button 
            type="button"
            (click)="toggleStartMenu.emit()"
            [class.bg-[var(--accent-color)]]="isStartMenuOpen() && !themeService.isDeskTheme()"
            [class.text-slate-950]="isStartMenuOpen() && !themeService.isDeskTheme()"
            [class.desk-brass-plate]="themeService.isDeskTheme()"
            [title]="themeService.currentTheme().distro + ' Launcher (Super / Win)'"
            class="h-10 px-3 rounded-xl hover:bg-white/10 flex items-center gap-2 text-[var(--text-primary)] transition-all shadow-md group border border-white/5">
            <div 
              [class]="themeService.isDeskTheme() ? 'bg-amber-950/20 text-amber-950' : 'bg-[var(--accent-color)]/20 text-[var(--accent-color)]'"
              class="w-6 h-6 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <mat-icon class="text-sm">{{ themeService.isDeskTheme() ? 'desk' : 'terminal' }}</mat-icon>
            </div>
            <span 
              [class]="themeService.isDeskTheme() ? 'text-amber-950' : ''"
              class="text-xs font-bold font-mono tracking-tight hidden md:inline">
              {{ themeService.currentTheme().name.split(' ')[0] }}
            </span>
          </button>
          
          <div class="w-px h-6 bg-white/10 mx-1"></div>
          
          <!-- Open Windows list in Linux Taskbar/Dock -->
          <div class="flex items-center gap-1.5 overflow-x-auto max-w-md md:max-w-xl lg:max-w-2xl no-scrollbar py-1">
            @for (win of windows(); track win.id) {
              <button 
                type="button"
                (click)="toggleWindow.emit(win.id)"
                (mouseenter)="onTaskbarItemHover(win.id, $event)"
                (mouseleave)="hoveredTaskbarAppId.set(null)"
                [class]="topWindowId() === win.id && !win.isMinimized 
                  ? (themeService.isDeskTheme() ? 'bg-amber-950/40 border-amber-500/60 shadow-inner text-amber-200' : 'bg-white/15 border-[var(--accent-color)]/60 shadow-inner text-white') 
                  : win.isMinimized 
                    ? 'bg-white/5 border-white/5 text-[var(--text-secondary)] opacity-75 hover:opacity-100 hover:bg-white/10' 
                    : 'bg-white/5 border-white/5 text-[var(--text-primary)] hover:bg-white/10'"
                class="h-10 px-3 rounded-xl flex items-center gap-2 border transition-all duration-200 hover:scale-102 active:scale-95 max-w-[170px] shrink-0 text-left relative group">
                
                <div 
                  [class]="themeService.isDeskTheme() ? 'bg-amber-500/20 text-amber-300' : 'bg-[var(--accent-color)]/20 text-[var(--accent-color)]'"
                  class="w-5 h-5 rounded flex items-center justify-center shrink-0">
                  <mat-icon class="text-xs">{{ win.icon }}</mat-icon>
                </div>
                
                <span class="text-xs font-medium truncate">{{ win.title }}</span>
                
                <!-- Linux Active App Glow Indicator (Dot) -->
                @if (topWindowId() === win.id && !win.isMinimized) {
                  <span 
                    [class]="themeService.isDeskTheme() ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-[var(--accent-color)] shadow-[0_0_8px_var(--accent-color)]'"
                    class="absolute bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-1 rounded-full"></span>
                } @else if (!win.isMinimized) {
                  <span class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1 rounded-full bg-slate-400 opacity-60"></span>
                }
              </button>
            }
          </div>
        </div>
        
        <!-- Live Taskbar Hover Preview Card -->
        @if (hoveredWindow(); as win) {
          <div 
            (mouseenter)="hoveredTaskbarAppId.set(win.id)"
            (mouseleave)="hoveredTaskbarAppId.set(null)"
            [style.left.px]="hoveredPreviewLeft()"
            [class]="themeService.isDeskTheme() ? 'desk-drawer border-amber-600/50 text-[#fef3c7]' : 'linux-glass border-white/10'"
            class="absolute bottom-18 z-50 w-64 rounded-2xl border p-3.5 shadow-2xl backdrop-blur-xl animate-fade-in space-y-3 pointer-events-auto">
            
            <!-- Card Header -->
            <div class="flex items-center gap-2.5">
              <div 
                [class]="themeService.isDeskTheme() ? 'desk-brass-plate text-amber-950' : 'bg-[var(--accent-color)]/20 text-[var(--accent-color)]'"
                class="w-7 h-7 rounded-lg flex items-center justify-center">
                <mat-icon class="text-sm">{{ win.icon }}</mat-icon>
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-xs font-bold text-[var(--text-primary)] truncate">{{ win.title }}</h4>
                <p 
                  [class]="themeService.isDeskTheme() ? 'text-amber-400' : 'text-[var(--accent-color)]'"
                  class="text-[9px] uppercase tracking-wider font-mono">
                  {{ win.isMinimized ? 'Minimizado' : (topWindowId() === win.id ? 'Ativo na Tela' : 'Em Segundo Plano') }}
                </p>
              </div>
            </div>

            <!-- Quick Thumbnail Simulator -->
            <div class="w-full h-24 rounded-lg bg-[var(--bg-surface)]/60 border border-white/5 flex flex-col items-center justify-center p-3 relative overflow-hidden group">
              <mat-icon class="text-3xl text-slate-700 group-hover:scale-110 transition-transform">{{ win.icon }}</mat-icon>
              <span class="text-[9px] text-[var(--text-secondary)] mt-2">Visualização do Documento</span>
              <div class="absolute inset-0 bg-[var(--accent-color)]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>

            <!-- Quick Action Commands directly in preview -->
            <div class="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-white/5">
              <button 
                type="button"
                (click)="toggleWindow.emit(win.id); hoveredTaskbarAppId.set(null)"
                [class]="themeService.isDeskTheme() ? 'bg-amber-600 hover:bg-amber-700 text-amber-950' : 'bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-slate-950'"
                class="font-bold text-[10px] py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm">
                <mat-icon class="text-[12px]">{{ win.isMinimized ? 'unfold_more' : 'unfold_less' }}</mat-icon>
                {{ win.isMinimized ? 'Restaurar' : 'Minimizar' }}
              </button>
              <button 
                type="button"
                (click)="closeWindow.emit(win.id); hoveredTaskbarAppId.set(null)"
                class="bg-rose-950 hover:bg-rose-900 border border-rose-500/30 text-rose-300 font-bold text-[10px] py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1">
                <mat-icon class="text-[12px]">close</mat-icon>
                Fechar
              </button>
            </div>
          </div>
        }

        <!-- Linux System Tray (KDE Plasma & DEsk style) -->
        <div class="flex items-center gap-1.5 text-[var(--text-primary)] shrink-0">
          
          <!-- Operational Mode Switcher Badge (Varejo / Restaurante) -->
          <button 
            type="button"
            (click)="toggleProfile.emit()"
            [title]="'Modo Atual: ' + (activeProfile() === 'retail' ? 'Varejo & Comércio' : 'Restaurantes & Gastronomia') + ' (Clique para alternar)'"
            [class]="themeService.isDeskTheme()
              ? 'px-2.5 py-1 rounded-xl desk-brass-plate text-amber-950 font-bold flex items-center gap-1.5 shadow-md border border-amber-300/40 hover:scale-105 transition-transform'
              : 'px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold flex items-center gap-1.5 transition-colors'">
            <mat-icon class="text-xs">{{ activeProfile() === 'retail' ? 'storefront' : 'restaurant' }}</mat-icon>
            <span class="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
              {{ activeProfile() === 'retail' ? 'Varejo' : 'Restaurante' }}
            </span>
          </button>

          <!-- Distro Theme Badge (Click opens Quick Settings) -->
          <button 
            type="button"
            (click)="toggleTray.emit()"
            [title]="'Tema ativo: ' + themeService.currentTheme().name"
            class="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-mono text-[var(--text-secondary)]">
            <span class="w-2 h-2 rounded-full" [style.backgroundColor]="themeService.currentTheme().accentColor"></span>
            <span>{{ themeService.currentTheme().distro.split(' ')[0] }}</span>
          </button>

          <!-- Keyboard Shortcuts HUD Trigger -->
          <button 
            (click)="toggleShortcutHud.emit()"
            [class.bg-[var(--accent-color)]]="isShortcutHudOpen()"
            title="Atalhos do Teclado (Alt + /)"
            class="w-9 h-9 rounded-xl border border-white/5 bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-white/10 active:bg-white/15 transition-all group relative shrink-0"
            type="button">
            <mat-icon class="text-[16px] group-hover:scale-110 transition-transform">keyboard</mat-icon>
            <span class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--accent-color)] border-2 border-[var(--bg-surface)] animate-pulse"></span>
          </button>
          
          <!-- Company Context button -->
          <button (click)="toggleTray.emit()" class="flex items-center gap-2 px-2.5 py-1 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors border border-white/5 text-left" type="button">
            <div class="flex flex-col text-right hidden lg:flex">
              <span class="text-[10px] font-bold text-[var(--text-primary)]">
                {{ companyName() }}
                @if (branchName()) {
                  <span class="text-[var(--accent-color)] font-normal">({{ branchName() }})</span>
                }
              </span>
              <span class="text-[9px] text-emerald-400 font-medium flex items-center gap-0.5 justify-end">
                <span class="w-1 h-1 bg-emerald-400 rounded-full"></span>
                {{ isOnline() ? 'Online' : 'Offline' }}
              </span>
            </div>
            <div 
              [class]="themeService.isDeskTheme() ? 'desk-brass-plate text-amber-950' : 'bg-[var(--accent-color)] text-slate-950'"
              class="w-7 h-7 rounded-lg flex items-center justify-center font-bold">
              <mat-icon class="text-[15px]">business</mat-icon>
            </div>
          </button>
          
          <!-- Quick Settings Toggles Cluster (Wi-Fi, Spooler) -->
          <button 
            (click)="toggleTray.emit()" 
            [class.bg-white/10]="isTrayOpen()"
            title="Centro de Controle Linux (Alt + S)"
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors border border-white/5 text-[var(--text-secondary)]" 
            type="button">
            <mat-icon class="text-[15px]" [class.text-[var(--accent-color)]]="isOnline()" [class.text-slate-600]="!isOnline()">
              {{ isOnline() ? 'wifi' : 'wifi_off' }}
            </mat-icon>
            <mat-icon class="text-[15px]" [class.text-emerald-400]="hasPaper()" [class.text-rose-400]="!hasPaper()">
              print
            </mat-icon>
            <mat-icon class="text-[15px] text-[var(--accent-color)]">tune</mat-icon>
          </button>

          <!-- DEsk Physical Desk Lamp Quick Switcher -->
          <button 
            type="button"
            (click)="themeService.toggleDeskLamp()"
            [title]="themeService.deskLampEnabled() ? 'Luminária Balcão Acesa (Clique para Apagar)' : 'Luminária Balcão Apagada (Clique para Acender)'"
            [class]="themeService.deskLampEnabled() ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 ring-1 ring-amber-500/30' : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'"
            class="w-9 h-9 rounded-xl border flex items-center justify-center transition-all group shrink-0">
            <mat-icon class="text-[16px] group-hover:scale-110 transition-transform">
              {{ themeService.deskLampEnabled() ? 'light_mode' : 'lightbulb' }}
            </mat-icon>
          </button>

          <!-- Calendar & Clock (KDE Plasma & DEsk Style) -->
          <button 
            (click)="toggleCalendar.emit()" 
            [class.bg-white/10]="isCalendarOpen()"
            title="Calendário e Central de Notificações (Alt + N)"
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors border border-white/5 font-mono text-[var(--text-secondary)] text-left relative group" 
            type="button">
            
            @if (notificationCount() > 0) {
              <span class="w-2 h-2 rounded-full bg-[var(--accent-color)] border border-[var(--bg-surface)] absolute -top-0.5 -right-0.5 animate-pulse"></span>
            }

            <mat-icon class="text-[15px] text-[var(--text-secondary)] group-hover:text-white transition-colors">notifications_none</mat-icon>
            
            <div class="flex flex-col text-center pl-1.5 border-l border-white/5">
              <span class="text-xs font-bold text-[var(--text-primary)] tracking-wider leading-none">{{ currentTime() }}</span>
              <span class="text-[8px] text-[var(--text-secondary)] font-sans tracking-wide mt-0.5">{{ currentDate() }}</span>
            </div>
          </button>

          <!-- Show Desktop button -->
          <button 
            (click)="toggleShowDesktop.emit()"
            [title]="isDesktopShown() ? 'Restaurar todas as janelas' : 'Minimizar todas as janelas (Mostrar Área de Trabalho)'"
            [class.bg-[var(--accent-color)]]="isDesktopShown()"
            class="w-3.5 h-9 hover:bg-white/10 border-l border-white/5 rounded flex items-center justify-center text-slate-600 hover:text-white transition-all ml-1 group shrink-0"
            type="button">
            <div class="w-1 h-5 bg-white/10 group-hover:bg-[var(--accent-color)] rounded transition-colors"></div>
          </button>

        </div>
        
      </footer>
    </div>
  `
})
export class OsTaskbarComponent {
  themeService = inject(LinuxThemeService);

  windows = input.required<WindowState[]>();
  topWindowId = input<string | null>(null);
  isStartMenuOpen = input<boolean>(false);
  isTrayOpen = input<boolean>(false);
  isCalendarOpen = input<boolean>(false);
  isShortcutHudOpen = input<boolean>(false);
  isDesktopShown = input<boolean>(false);
  companyName = input<string>('');
  branchName = input<string | undefined>(undefined);
  isOnline = input<boolean>(true);
  hasPaper = input<boolean>(true);
  notificationCount = input<number>(0);
  currentTime = input<string>('');
  currentDate = input<string>('');
  activeProfile = input<OsProfileType>('retail');

  toggleStartMenu = output<void>();
  toggleTray = output<void>();
  toggleCalendar = output<void>();
  toggleShortcutHud = output<void>();
  toggleShowDesktop = output<void>();
  toggleWindow = output<string>();
  closeWindow = output<string>();
  toggleProfile = output<void>();

  hoveredTaskbarAppId = signal<string | null>(null);
  hoveredPreviewLeft = signal<number>(64);

  hoveredWindow = computed(() => {
    const id = this.hoveredTaskbarAppId();
    if (!id) return null;
    return this.windows().find(w => w.id === id) || null;
  });

  onTaskbarItemHover(winId: string, event: MouseEvent) {
    this.hoveredTaskbarAppId.set(winId);
    const target = event.currentTarget as HTMLElement;
    if (target) {
      const rect = target.getBoundingClientRect();
      const left = rect.left + (rect.width / 2) - 128;
      this.hoveredPreviewLeft.set(Math.max(16, Math.min(left, window.innerWidth - 272)));
    }
  }
}
