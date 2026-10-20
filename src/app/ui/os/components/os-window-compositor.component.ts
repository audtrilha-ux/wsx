import { Component, ChangeDetectionStrategy, input, output, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WindowState } from '../../../core/application/window-manager.service';
import { AppRegistryService } from '../../../core/app-runtime/app-registry.service';
import { AppRuntimeHostComponent } from '../../../core/app-runtime/app-runtime-host.component';
import { LinuxThemeService } from '../../../core/theme/linux-theme.service';
import { OsWindowComponent } from './os-window.component';

@Component({
  selector: 'app-os-window-compositor',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule,
    AppRuntimeHostComponent,
    OsWindowComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Intelligent Snap Preview Zones -->
    @if (snapPreviewZone() === 'left') {
      <div [class]="themeService.isDeskTheme() 
        ? 'fixed left-0 top-0 w-1/2 h-[calc(100vh-3.5rem)] bg-amber-500/15 border-r-4 border-amber-500/70 backdrop-blur-xs z-[9999] pointer-events-none animate-pulse shadow-[inset_0_0_30px_rgba(245,158,11,0.2)]'
        : 'fixed left-0 top-0 w-1/2 h-[calc(100vh-3.5rem)] bg-[var(--accent-color)]/10 border-r-2 border-[var(--accent-color)]/50 backdrop-blur-[2px] z-[9999] pointer-events-none animate-pulse'"></div>
    } @else if (snapPreviewZone() === 'right') {
      <div [class]="themeService.isDeskTheme()
        ? 'fixed right-0 top-0 w-1/2 h-[calc(100vh-3.5rem)] bg-amber-500/15 border-l-4 border-amber-500/70 backdrop-blur-xs z-[9999] pointer-events-none animate-pulse shadow-[inset_0_0_30px_rgba(245,158,11,0.2)]'
        : 'fixed right-0 top-0 w-1/2 h-[calc(100vh-3.5rem)] bg-[var(--accent-color)]/10 border-l-2 border-[var(--accent-color)]/50 backdrop-blur-[2px] z-[9999] pointer-events-none animate-pulse'"></div>
    }

    <!-- Window Manager Container -->
    <div class="absolute inset-0 pointer-events-none z-10">
      @for (win of windows(); track win.id) {
        @if (!win.isMinimized) {
          <app-os-window [win]="win"
            [style.zIndex]="activeDraggingId() === win.id ? 9999 : win.zIndex"
            [style.left]="win.isMaximized ? '0px' : (win.isSnapped === 'left' ? '0px' : (win.isSnapped === 'right' ? '50%' : getWindowX(win) + 'px'))"
            [style.top]="win.isMaximized ? '0px' : (win.isSnapped ? '0px' : getWindowY(win) + 'px')"
            [style.width]="win.isMaximized ? '100vw' : (win.isSnapped ? '50%' : getWindowWidth(win) + 'px')"
            [style.height]="win.isMaximized ? 'calc(100vh - 3.5rem)' : (win.isSnapped ? 'calc(100vh - 3.5rem)' : getWindowHeight(win) + 'px')"
            (mousedown)="focusWindow.emit(win.id)"
            [ngClass]="[
              topWindowId() === win.id 
                ? (themeService.isDeskTheme() ? 'shadow-[0_28px_65px_-10px_rgba(20,13,8,0.85)] ring-1 ring-amber-500/40' : 'shadow-2xl ring-2 ring-[var(--accent-color)]/50 border-[var(--accent-color)]/40 linux-accent-glow') 
                : (themeService.isDeskTheme() ? 'shadow-[0_12px_28px_-6px_rgba(20,13,8,0.55)] opacity-[0.99]' : 'shadow-lg border-slate-700/30 opacity-[0.98]'),
              (win.isMaximized || win.isSnapped) ? 'rounded-none' : (themeService.isDeskTheme() ? 'desk-paper-sheet' : 'rounded-2xl border linux-window-frame'),
              activeDraggingId() === win.id 
                ? (themeService.isDeskTheme() 
                    ? 'scale-[1.015] -rotate-[0.6deg] shadow-[0_40px_90px_rgba(15,10,6,0.92)] ring-2 ring-amber-400/80 cursor-grabbing !transition-none' 
                    : 'scale-[1.015] rotate-[0.4deg] shadow-2xl ring-2 ring-[var(--accent-color)] cursor-grabbing !transition-none') 
                : '',
              activeResizingId() === win.id ? 'ring-2 ring-emerald-500/50 shadow-xl' : ''
            ]"
            [class.transition-all]="activeDraggingId() !== win.id && activeResizingId() !== win.id"
            [class.duration-200]="activeDraggingId() !== win.id && activeResizingId() !== win.id"
            class="absolute bg-white flex flex-col overflow-hidden pointer-events-auto transform">
            
            <!-- Window Title Bar (DEsk Walnut/Brass or KWin/Plasma Glass) -->
            <div 
              (mousedown)="onStartDrag($event, win)"
              (dblclick)="toggleMaximize.emit(win.id)"
              [class]="themeService.isDeskTheme() 
                ? 'h-10 bg-gradient-to-r from-[#2c1e15] via-[#38261b] to-[#2c1e15] text-[#fef3c7] flex items-center justify-between px-3.5 border-b border-amber-600/30 select-none shrink-0 cursor-move shadow-inner'
                : 'h-10 bg-slate-900/95 text-white flex items-center justify-between px-3.5 border-b border-white/10 select-none shrink-0 cursor-move'">
              <div class="flex items-center gap-2.5 pointer-events-none">
                @if (themeService.isDeskTheme()) {
                  <div class="desk-brass-screw mr-0.5 hidden sm:block"></div>
                  <mat-icon class="text-amber-400 text-xs opacity-75">attach_file</mat-icon>
                }
                <div 
                  [class]="themeService.isDeskTheme() 
                    ? 'w-6 h-6 rounded desk-brass-plate flex items-center justify-center text-amber-950 shadow-sm' 
                    : 'w-6 h-6 rounded-lg bg-[var(--accent-color)]/20 border border-[var(--accent-color)]/30 flex items-center justify-center text-[var(--accent-color)]'">
                  <mat-icon class="text-[14px]">{{ win.icon }}</mat-icon>
                </div>
                <span 
                  [class]="themeService.isDeskTheme() ? 'text-xs font-bold text-amber-100 tracking-wide font-sans' : 'text-xs font-bold text-slate-200 tracking-wide font-mono'">
                  {{ win.title }}
                </span>
                @if (win.isSnapped) {
                  <span class="text-[8px] uppercase font-mono px-1.5 py-0.2 rounded bg-[var(--accent-color)]/20 text-[var(--accent-color)] font-bold tracking-wider">Ajustado</span>
                }
                @if (themeService.isDeskTheme() && !win.isSnapped) {
                  <span class="text-[8px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold tracking-wider border border-amber-500/30">Documento</span>
                }
              </div>
              
              <!-- Window Controls (Minimize, Maximize, Close) -->
              <div class="flex items-center gap-1">
                @if (themeService.isDeskTheme()) {
                  <div class="desk-brass-screw ml-1 mr-1 hidden sm:block"></div>
                }
                <!-- Align Left Button -->
                <button 
                  type="button"
                  (click)="onTriggerSnap(win.id, win.isSnapped === 'left' ? null : 'left', $event)" 
                  title="Ajustar à Esquerda"
                  class="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                  <mat-icon class="text-[14px]">chevron_left</mat-icon>
                </button>
                <!-- Align Right Button -->
                <button 
                  type="button"
                  (click)="onTriggerSnap(win.id, win.isSnapped === 'right' ? null : 'right', $event)" 
                  title="Ajustar à Direita"
                  class="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                  <mat-icon class="text-[14px]">chevron_right</mat-icon>
                </button>
                <!-- Minimize Button -->
                <button 
                  type="button"
                  (click)="minimizeWindow.emit(win.id); $event.stopPropagation()" 
                  title="Minimizar"
                  class="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                  <mat-icon class="text-[14px]">remove</mat-icon>
                </button>
                <!-- Maximize / Restore Button -->
                <button 
                  type="button"
                  (click)="toggleMaximize.emit(win.id); $event.stopPropagation()" 
                  [title]="win.isMaximized ? 'Restaurar' : 'Maximizar'"
                  class="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                  <mat-icon class="text-[13px]">{{ win.isMaximized ? 'filter_none' : 'crop_square' }}</mat-icon>
                </button>
                <!-- Close Button -->
                <button 
                  type="button"
                  (click)="closeWindow.emit(win.id); $event.stopPropagation()" 
                  title="Fechar"
                  class="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-rose-600 hover:text-white text-slate-400 transition-colors">
                  <mat-icon class="text-[14px]">close</mat-icon>
                </button>
              </div>
            </div>
            
            <!-- Window Content (Paper look in DEsk mode) -->
            <div [class]="themeService.isDeskTheme() ? 'flex-1 overflow-auto bg-[#faf8f2] relative' : 'flex-1 overflow-auto bg-slate-50 relative'">
              @let appId = win.componentId || win.id;
              @let status = appRegistry.loadingStates()[appId] || 'unloaded';

              @if (appRegistry.getComponent(appId); as dynamicComponent) {
                <app-runtime-host [appId]="appId" [component]="dynamicComponent"></app-runtime-host>
              } @else if (status === 'loading') {
                <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm z-50 gap-3 animate-fade-in">
                  <div class="w-10 h-10 border-4 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
                  <div class="text-xs font-semibold text-white tracking-wide font-mono">Iniciando aplicativo no OS...</div>
                </div>
              } @else if (status === 'failed') {
                <div class="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-slate-50 gap-2">
                  <mat-icon class="text-5xl text-rose-500">error_outline</mat-icon>
                  <p class="text-xs font-medium text-slate-700">Falha ao inicializar o aplicativo.</p>
                  <p class="text-[11px] text-slate-400">Ocorreu um erro ao carregar os recursos na rede.</p>
                </div>
              } @else {
                <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/20 backdrop-blur-[1px] z-50 gap-3 animate-fade-in">
                  <div class="w-8 h-8 border-3 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
                  <div class="text-[11px] font-semibold text-[var(--accent-color)] tracking-wide font-mono">Processando núcleo...</div>
                </div>
              }
            </div>

            <!-- Window Resize Handle (Bottom-Right) -->
            @if (!win.isMaximized && !win.isSnapped) {
              <div 
                (mousedown)="onStartResize($event, win)"
                class="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 z-50 text-slate-400 hover:text-[var(--accent-color)] transition-colors pointer-events-auto">
                <svg class="w-3.5 h-3.5 opacity-60 hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="6" y1="21" x2="21" y2="6"></line>
                  <line x1="12" y1="21" x2="21" y2="12"></line>
                  <line x1="18" y1="21" x2="21" y2="18"></line>
                </svg>
              </div>
            }

          </app-os-window>
        }
      }
    </div>
  `
})
export class OsWindowCompositorComponent {
  appRegistry = inject(AppRegistryService);
  themeService = inject(LinuxThemeService);

  windows = input.required<WindowState[]>();
  topWindowId = input<string | null>(null);
  activeDraggingId = input<string | null>(null);
  activeResizingId = input<string | null>(null);
  snapPreviewZone = input<'left' | 'right' | null>(null);

  focusWindow = output<string>();
  minimizeWindow = output<string>();
  toggleMaximize = output<string>();
  closeWindow = output<string>();
  triggerSnap = output<{ id: string; zone: 'left' | 'right' | null }>();
  startDrag = output<{ event: MouseEvent; window: WindowState }>();
  startResize = output<{ event: MouseEvent; window: WindowState }>();

  constructor() {
    effect(() => {
      const activeWindows = this.windows();
      for (const win of activeWindows) {
        const appId = win.componentId || win.id;
        if (appId && !this.appRegistry.getComponent(appId) && this.appRegistry.loadingStates()[appId] !== 'loading') {
          void this.appRegistry.loadComponent(appId);
        }
      }
    });
  }

  getWindowX(win: WindowState): number {
    return win.x ?? 80;
  }

  getWindowY(win: WindowState): number {
    return win.y ?? 60;
  }

  getWindowWidth(win: WindowState): number {
    return win.width ?? 900;
  }

  getWindowHeight(win: WindowState): number {
    return win.height ?? 600;
  }

  onStartDrag(event: MouseEvent, win: WindowState) {
    if (win.isMaximized) return;
    this.startDrag.emit({ event, window: win });
  }

  onStartResize(event: MouseEvent, win: WindowState) {
    this.startResize.emit({ event, window: win });
  }

  onTriggerSnap(winId: string, zone: 'left' | 'right' | null, event: MouseEvent) {
    event.stopPropagation();
    this.triggerSnap.emit({ id: winId, zone });
  }
}
