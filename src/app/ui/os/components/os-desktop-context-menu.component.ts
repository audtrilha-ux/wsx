import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LinuxThemeService } from '../../../core/theme/linux-theme.service';
import { OsProfileService } from '../../../core/os-profile/os-profile.service';

@Component({
  selector: 'app-os-desktop-context-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (isOpen()) {
      <div 
        [style.left.px]="x()"
        [style.top.px]="y()"
        [class]="themeService.isDeskTheme() 
          ? 'fixed z-50 w-64 rounded-2xl desk-drawer border border-amber-600/40 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.95)] text-[#fef3c7] select-none animate-fade-in text-xs space-y-1' 
          : 'fixed z-50 w-60 rounded-2xl bg-slate-900/95 border border-white/10 p-1.5 shadow-2xl backdrop-blur-xl text-white select-none animate-fade-in text-xs space-y-1'">
        
        <!-- Visualização -->
        <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Exibir Ícones</div>
        <div class="grid grid-cols-3 gap-1 px-1">
          <button 
            (click)="setIconSize.emit('small'); closeMenu.emit()" 
            [class.bg-indigo-600]="desktopIconSize() === 'small' && !themeService.isDeskTheme()"
            [class.desk-brass-plate]="desktopIconSize() === 'small' && themeService.isDeskTheme()"
            [class.text-amber-950]="desktopIconSize() === 'small' && themeService.isDeskTheme()"
            [class.text-white]="desktopIconSize() === 'small' && !themeService.isDeskTheme()"
            class="py-1 px-1.5 rounded-lg text-center text-[10px] bg-white/5 hover:bg-white/10 transition-colors font-medium">
            Pequeno
          </button>
          <button 
            (click)="setIconSize.emit('normal'); closeMenu.emit()" 
            [class.bg-indigo-600]="desktopIconSize() === 'normal' && !themeService.isDeskTheme()"
            [class.desk-brass-plate]="desktopIconSize() === 'normal' && themeService.isDeskTheme()"
            [class.text-amber-950]="desktopIconSize() === 'normal' && themeService.isDeskTheme()"
            [class.text-white]="desktopIconSize() === 'normal' && !themeService.isDeskTheme()"
            class="py-1 px-1.5 rounded-lg text-center text-[10px] bg-white/5 hover:bg-white/10 transition-colors font-medium">
            Normal
          </button>
          <button 
            (click)="setIconSize.emit('large'); closeMenu.emit()" 
            [class.bg-indigo-600]="desktopIconSize() === 'large' && !themeService.isDeskTheme()"
            [class.desk-brass-plate]="desktopIconSize() === 'large' && themeService.isDeskTheme()"
            [class.text-amber-950]="desktopIconSize() === 'large' && themeService.isDeskTheme()"
            [class.text-white]="desktopIconSize() === 'large' && !themeService.isDeskTheme()"
            class="py-1 px-1.5 rounded-lg text-center text-[10px] bg-white/5 hover:bg-white/10 transition-colors font-medium">
            Grande
          </button>
        </div>

        <div class="h-px bg-white/10 my-1"></div>

        <!-- Modo Operacional do Sistema (Varejo / Restaurante) -->
        <button 
          (click)="toggleProfile.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-left">
          <div class="flex items-center gap-2">
            <mat-icon [class.text-emerald-400]="profileService.activeProfile() === 'retail'" [class.text-amber-400]="profileService.activeProfile() === 'restaurant'" class="text-[16px]">
              {{ profileService.activeProfile() === 'retail' ? 'storefront' : 'restaurant' }}
            </mat-icon>
            <span class="font-bold">
              {{ profileService.activeProfile() === 'retail' ? 'Modo: Varejo (Alternar)' : 'Modo: Restaurante (Alternar)' }}
            </span>
          </div>
          <span 
            [class]="profileService.activeProfile() === 'retail' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'"
            class="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase">
            {{ profileService.activeProfile() === 'retail' ? 'Varejo' : 'Mesas' }}
          </span>
        </button>

        <!-- Luminária de Balcão (Ligar / Desligar) -->
        <button 
          (click)="toggleDeskLamp.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-left">
          <div class="flex items-center gap-2">
            <mat-icon class="text-amber-300 text-[16px]">
              {{ themeService.deskLampEnabled() ? 'light_mode' : 'lightbulb' }}
            </mat-icon>
            <span class="font-medium">
              {{ themeService.deskLampEnabled() ? 'Apagar Luminária' : 'Acender Luminária' }}
            </span>
          </div>
          <span class="text-[9px] font-mono text-slate-400">Balcão</span>
        </button>

        <div class="h-px bg-white/10 my-1"></div>

        <!-- Organização de Janelas -->
        <button 
          (click)="tileWindows.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-left">
          <div class="flex items-center gap-2">
            <mat-icon class="text-indigo-400 text-[16px]">grid_view</mat-icon>
            <span>Organizar em Grade</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400">Alt+G</span>
        </button>

        <button 
          (click)="cascadeWindows.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-left">
          <div class="flex items-center gap-2">
            <mat-icon class="text-indigo-400 text-[16px]">view_agenda</mat-icon>
            <span>Organizar em Cascata</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400">Alt+C</span>
        </button>

        <button 
          (click)="autoFit.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-left">
          <div class="flex items-center gap-2">
            <mat-icon class="text-indigo-400 text-[16px]">fit_screen</mat-icon>
            <span>Auto-Ajustar à Tela</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400">Alt+A</span>
        </button>

        <button 
          (click)="toggleDesktop.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-left">
          <div class="flex items-center gap-2">
            <mat-icon class="text-indigo-400 text-[16px]">desktop_windows</mat-icon>
            <span>Mostrar Área de Trabalho</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400">Alt+D</span>
        </button>

        <div class="h-px bg-white/10 my-1"></div>

        <!-- Atalhos de Sistema -->
        <button 
          (click)="openFileExplorer.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-left">
          <div class="flex items-center gap-2">
            <mat-icon class="text-amber-400 text-[16px]">folder_open</mat-icon>
            <span class="font-medium text-amber-200">Explorador de Arquivos</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400">Alt+E</span>
        </button>

        <button 
          (click)="openTaskManager.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-left">
          <div class="flex items-center gap-2">
            <mat-icon class="text-rose-400 text-[16px]">view_timeline</mat-icon>
            <span class="font-medium text-rose-200">Gerenciador de Tarefas</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400">Alt+T</span>
        </button>

        <button 
          (click)="openDiagnostics.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-left">
          <div class="flex items-center gap-2">
            <mat-icon class="text-emerald-400 text-[16px]">troubleshoot</mat-icon>
            <span class="font-medium text-emerald-200">Diagnóstico do OS</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400">Alt+H</span>
        </button>

        <button 
          (click)="openBrowser.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-left">
          <div class="flex items-center gap-2">
            <mat-icon class="text-sky-400 text-[16px]">explore</mat-icon>
            <span>Navegador Web OS</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400">Alt+S</span>
        </button>

        <button 
          (click)="openSettings.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-left">
          <div class="flex items-center gap-2">
            <mat-icon class="text-slate-400 text-[16px]">settings</mat-icon>
            <span>Painel de Controle</span>
          </div>
        </button>

        <div class="h-px bg-white/10 my-1"></div>

        <!-- Atualizar Desktop -->
        <button 
          (click)="refreshDesktop.emit(); closeMenu.emit()"
          class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors text-slate-300 hover:text-white text-left">
          <div class="flex items-center gap-2">
            <mat-icon class="text-emerald-400 text-[16px]">refresh</mat-icon>
            <span>Atualizar Área de Trabalho</span>
          </div>
        </button>
      </div>
    }
  `
})
export class OsDesktopContextMenuComponent {
  themeService = inject(LinuxThemeService);
  profileService = inject(OsProfileService);

  isOpen = input<boolean>(false);
  x = input<number>(0);
  y = input<number>(0);
  desktopIconSize = input<'small' | 'normal' | 'large'>('normal');

  closeMenu = output<void>();
  setIconSize = output<'small' | 'normal' | 'large'>();
  tileWindows = output<void>();
  cascadeWindows = output<void>();
  autoFit = output<void>();
  toggleDesktop = output<void>();
  openFileExplorer = output<void>();
  openTaskManager = output<void>();
  openDiagnostics = output<void>();
  openBrowser = output<void>();
  openSettings = output<void>();
  refreshDesktop = output<void>();
  toggleProfile = output<void>();
  toggleDeskLamp = output<void>();
}
