import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { HqStateService } from './hq-state.service';
import { IdentityService } from '../../core/identity/identity.service';
import { OsDisplayEngineService } from '../../core/application/display-engine.service';
import { HqDisplaySettingsModalComponent } from './components/hq-display-settings-modal.component';

@Component({
  selector: 'app-hq-os-shell',
  host: {
    '(window:keydown)': 'handleKeyboardEvent($event)'
  },
  imports: [CommonModule, MatIconModule, RouterOutlet, RouterLink, RouterLinkActive, HqDisplaySettingsModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-screen w-screen desk-wood-bg text-[#fef3c7] flex overflow-hidden font-sans selection:bg-amber-500/30 relative select-none">
      
      <!-- Ambient Banker's Lamp Warm Raytraced Glow -->
      <div class="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_75%_55%_at_75%_12%,rgba(245,158,11,0.22),transparent_75%)] mix-blend-screen desk-lamp-raytrace"></div>

      <!-- HQ OS Kernel Sidebar (Walnut Wooden Cabinet) -->
      <aside class="w-64 desk-wood-panel border-r border-amber-900/60 flex flex-col shrink-0 shadow-2xl z-20 relative">
        <!-- Brass corner screws on cabinet -->
        <div class="absolute top-2 left-2 desk-brass-screw"></div>
        <div class="absolute top-2 right-2 desk-brass-screw"></div>

        <div class="p-6 border-b border-amber-900/50 flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg desk-brass-plate flex items-center justify-center shadow-md text-amber-950 font-bold border border-amber-300/40">
            <mat-icon class="text-xl w-6 h-6 flex items-center justify-center">shield</mat-icon>
          </div>
          <div>
            <h1 class="text-sm font-bold text-amber-100 tracking-tight font-serif">3EATCRU HQ OS</h1>
            <p class="text-[10px] text-amber-300/70 font-mono uppercase tracking-widest">Gabinete de Governo</p>
          </div>
        </div>

        <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div class="px-3 mb-2 mt-2 text-[10px] font-bold text-amber-300/60 uppercase tracking-wider font-mono">Governança SaaS</div>
          
          <a routerLink="/hq/dashboard" routerLinkActive="desk-brass-plate !text-amber-950 font-bold shadow-md" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-amber-950/40 text-amber-200 transition-colors text-xs font-medium">
            <mat-icon class="text-base text-amber-400">dashboard</mat-icon>
            Dashboard BI
          </a>
          
          <a routerLink="/hq/tenants" routerLinkActive="desk-brass-plate !text-amber-950 font-bold shadow-md" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-amber-950/40 text-amber-200 transition-colors text-xs font-medium">
            <mat-icon class="text-base text-amber-400">business</mat-icon>
            Gestão de Tenants
          </a>

          <a routerLink="/hq/billing" routerLinkActive="desk-brass-plate !text-amber-950 font-bold shadow-md" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-amber-950/40 text-amber-200 transition-colors text-xs font-medium">
            <mat-icon class="text-base text-amber-400">receipt_long</mat-icon>
            Billing & Ledger
          </a>

          <div class="px-3 mb-2 mt-5 text-[10px] font-bold text-amber-300/60 uppercase tracking-wider font-mono">Ecossistema & Apps</div>

          <a routerLink="/hq/catalog" routerLinkActive="desk-brass-plate !text-amber-950 font-bold shadow-md" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-amber-950/40 text-amber-200 transition-colors text-xs font-medium">
            <mat-icon class="text-base text-amber-400">apps</mat-icon>
            Catálogo de Módulos
          </a>

          <a routerLink="/hq/marketplace" routerLinkActive="desk-brass-plate !text-amber-950 font-bold shadow-md" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-amber-950/40 text-amber-200 transition-colors text-xs font-medium">
            <mat-icon class="text-base text-amber-400">storefront</mat-icon>
            Governança Marketplace
          </a>

          <a routerLink="/hq/dev-hub" routerLinkActive="desk-brass-plate !text-amber-950 font-bold shadow-md" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-amber-950/40 text-amber-200 transition-colors text-xs font-medium">
            <mat-icon class="text-base text-amber-400">api</mat-icon>
            Developer Hub & OTA
          </a>
          
          <div class="px-3 mb-2 mt-5 text-[10px] font-bold text-amber-300/60 uppercase tracking-wider font-mono">Infra & Diagnósticos</div>

          <a routerLink="/hq/telemetry" routerLinkActive="desk-brass-plate !text-amber-950 font-bold shadow-md" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-amber-950/40 text-amber-200 transition-colors text-xs font-medium">
            <mat-icon class="text-base text-amber-400">monitor_heart</mat-icon>
            Telemetria & Logs
          </a>

          <div class="px-3 mb-2 mt-5 text-[10px] font-bold text-amber-300/60 uppercase tracking-wider font-mono">Outros Ambientes</div>
          
          <a routerLink="/os" class="flex items-center justify-between px-3 py-2 rounded-lg border border-amber-900/60 bg-[#160e09] text-amber-200 hover:text-white hover:bg-amber-950/60 transition-colors text-xs font-medium">
            <span class="flex items-center gap-2">
              <mat-icon class="text-sm text-amber-400">desktop_windows</mat-icon>
              Client OS (Bancada)
            </span>
            <mat-icon class="text-xs text-amber-500">open_in_new</mat-icon>
          </a>

          <a routerLink="/marketplace" class="flex items-center justify-between px-3 py-2 rounded-lg border border-amber-900/60 bg-[#160e09] text-amber-200 hover:text-white hover:bg-amber-950/60 transition-colors text-xs font-medium mt-1">
            <span class="flex items-center gap-2">
              <mat-icon class="text-sm text-amber-400">storefront</mat-icon>
              Catálogo Público
            </span>
            <mat-icon class="text-xs text-amber-500">open_in_new</mat-icon>
          </a>
        </nav>

        <div class="p-4 border-t border-amber-900/50">
          <div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#140c08] border border-amber-900/40">
            <div class="w-8 h-8 rounded-full desk-brass-plate text-amber-950 flex items-center justify-center font-bold">
              <mat-icon class="text-sm">person</mat-icon>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold text-amber-100 truncate font-serif">Superadmin HQ</div>
              <div class="text-[10px] text-emerald-400 font-mono">Gabinete Ativo</div>
            </div>
            <button (click)="logout()" class="text-amber-400 hover:text-white transition-colors" title="Encerrar Sessão">
              <mat-icon class="text-sm">logout</mat-icon>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Workspace (Desktop with Virtual Display Engine) -->
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <!-- Header / Taskbar equivalent -->
        <header class="h-14 border-b border-amber-900/50 bg-[#19110a]/90 backdrop-blur flex items-center justify-between px-6 shrink-0 z-10">
          <div class="flex items-center gap-3 text-amber-200 text-sm">
            <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded desk-brass-plate text-amber-950 font-mono text-xs font-bold">
              <mat-icon class="text-xs">shield</mat-icon>
              <span>3EATCRU HQ OS</span>
            </div>
            <span class="text-amber-800">|</span>
            <span class="text-xs text-amber-300/80 font-mono hidden sm:inline">Gabinete de Controle Central · DEsk Protocol</span>
          </div>
          
          <div class="flex items-center gap-3">
            <!-- Global Command Palette Search Bar Trigger -->
            <button (click)="isCommandPaletteOpen.set(true)" 
                    class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#20150d] border border-amber-700/40 hover:border-amber-500 text-amber-200 hover:text-white transition-all text-xs font-medium shadow-sm">
              <mat-icon class="text-sm text-amber-400">search</mat-icon>
                <span class="hidden md:inline">Buscar ou executar comando...</span>
                <span class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-400">Alt + K</span>
              </button>

              <!-- Virtual Display Resolution & Scaling Trigger Badge -->
              <button (click)="isDisplaySettingsOpen.set(true)" 
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-white transition-all text-xs font-mono shrink-0 cursor-pointer"
                      title="Configurar Resolução do Workspace e Escala Visual">
                <mat-icon class="text-xs text-indigo-400">aspect_ratio</mat-icon>
                <span class="hidden sm:inline">{{ displayEngine.displayBadgeLabel() }}</span>
                <span class="sm:hidden font-bold">{{ displayEngine.scaleFactor() }}%</span>
              </button>

              <!-- Support Mode Indicator Badge -->
              @if (identityService.isSupportImpersonating()) {
                <div class="flex items-center gap-2 px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
                  <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  <span class="font-mono">Suporte: {{ identityService.impersonatedCompany()?.name }}</span>
                  <button (click)="identityService.exitSupportImpersonation()" class="hover:text-white text-xs underline font-bold ml-1">
                    Sair
                  </button>
                </div>
              }

              <!-- Live Clock -->
              <div class="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <mat-icon class="text-xs text-slate-500">schedule</mat-icon>
                <span>{{ currentTime() | date:'HH:mm:ss' }}</span>
              </div>

              <!-- Global Status -->
              <div class="flex items-center gap-2 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Central Online
              </div>

              <!-- Activity Drawer Toggle -->
              <button (click)="toggleLogs()" class="relative p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors" title="Logs da Central">
                <mat-icon class="text-sm">notifications</mat-icon>
                @if (hqState.logs().length > 0) {
                  <span class="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full text-[9px] flex items-center justify-center font-bold font-mono">
                    {{ hqState.logs().length > 9 ? '9+' : hqState.logs().length }}
                  </span>
                }
              </button>
            </div>
          </header>

          <!-- Router Outlet for HQ Apps inside Virtual Display Stage Canvas -->
          @if (displayEngine.selectedPresetId() === 'auto') {
            <div class="flex-1 overflow-auto p-6 relative" [style.transform]="'scale(' + displayEngine.effectiveScale() + ')'" [style.transformOrigin]="'top left'">
              <div class="max-w-6xl mx-auto">
                <router-outlet></router-outlet>
              </div>
            </div>
          } @else {
            <div class="flex-1 overflow-auto bg-slate-950 p-4 flex items-start justify-center relative">
              <div class="bg-slate-900/90 border border-slate-800 shadow-2xl rounded-2xl overflow-auto relative p-6 transition-all duration-200"
                   [style.width.px]="displayEngine.targetWidth()"
                   [style.minHeight.px]="displayEngine.targetHeight()"
                   [style.transform]="'scale(' + displayEngine.effectiveScale() + ')'"
                   [style.transformOrigin]="'top center'">
                
                <!-- Virtual Resolution Header Bar indicator -->
                <div class="mb-4 pb-2 border-b border-slate-800 flex justify-between items-center text-[10px] font-mono text-slate-500">
                  <span class="flex items-center gap-1.5">
                    <mat-icon class="text-xs text-indigo-400">monitor</mat-icon>
                    HQ Virtual Desktop Canvas: {{ displayEngine.targetWidth() }} × {{ displayEngine.targetHeight() }} px
                  </span>
                  <span>Escala: {{ displayEngine.scaleFactor() }}%</span>
                </div>

                <div class="max-w-6xl mx-auto">
                  <router-outlet></router-outlet>
                </div>
              </div>
            </div>
          }

          <!-- Command Palette Modal (Alt + K) -->
          @if (isCommandPaletteOpen()) {
            <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4">
              <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
                <div class="p-3 border-b border-slate-800 flex items-center gap-3 bg-slate-950/60">
                  <mat-icon class="text-indigo-400">search</mat-icon>
                  <input #commandInput type="text" [value]="commandQuery()" (input)="onCommandQueryInput($event)"
                         placeholder="Digite um comando, aplicativo ou nome de tenant..."
                         class="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-500">
                  <span class="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">ESC</span>
                </div>

                <div class="p-3 max-h-80 overflow-y-auto space-y-2">
                  <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">Navegação do Control Plane</div>
                  <div class="grid grid-cols-2 gap-1.5">
                    <button (click)="navigateAndClose('/hq/dashboard')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">dashboard</mat-icon>
                      <span>Dashboard BI</span>
                    </button>
                    <button (click)="navigateAndClose('/hq/tenants')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">business</mat-icon>
                      <span>Gestão de Tenants</span>
                    </button>
                    <button (click)="navigateAndClose('/hq/billing')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">receipt_long</mat-icon>
                      <span>Billing & Ledger</span>
                    </button>
                    <button (click)="navigateAndClose('/hq/catalog')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">apps</mat-icon>
                      <span>Catálogo de Módulos</span>
                    </button>
                    <button (click)="navigateAndClose('/hq/dev-hub')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">api</mat-icon>
                      <span>Developer Hub & OTA</span>
                    </button>
                    <button (click)="navigateAndClose('/hq/telemetry')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">monitor_heart</mat-icon>
                      <span>Telemetria & Logs</span>
                    </button>
                  </div>

                  <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 pt-2 border-t border-slate-800/80">Atalhos Globais</div>
                  <button (click)="navigateAndClose('/os')" class="w-full flex items-center justify-between p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                    <span class="flex items-center gap-2">
                      <mat-icon class="text-sm text-cyan-400">desktop_windows</mat-icon>
                      Acessar Client OS Workspace
                    </span>
                    <mat-icon class="text-xs text-slate-500">chevron_right</mat-icon>
                  </button>
                </div>

                <div class="p-2 border-t border-slate-800 bg-slate-950/50 flex justify-between text-[11px] text-slate-500">
                  <span>Pressione <strong class="text-slate-400">ESC</strong> para fechar</span>
                  <span>3EATCRU HQ OS</span>
                </div>
              </div>
            </div>
          }

          <!-- Virtual Display Settings Modal -->
          @if (isDisplaySettingsOpen()) {
            <app-hq-display-settings-modal (closeModal)="isDisplaySettingsOpen.set(false)" />
          }

          <!-- Activity / Logs Slide-over Panel -->
          @if (isLogsOpen()) {
            <div class="fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-800 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200">
              <div class="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                <div class="flex items-center gap-2">
                  <mat-icon class="text-indigo-400 text-sm">history</mat-icon>
                  <span class="text-xs font-bold text-white uppercase tracking-wider">Log de Auditoria</span>
                </div>
                <button (click)="isLogsOpen.set(false)" class="text-slate-500 hover:text-white transition-colors">
                  <mat-icon class="text-sm">close</mat-icon>
                </button>
              </div>

              <div class="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
                @for (log of hqState.logs(); track log.time) {
                  <div class="p-2.5 rounded border border-slate-800 bg-slate-950/40 text-[11px] leading-relaxed">
                    <div class="flex justify-between text-[9px] text-slate-500 mb-1">
                      <span class="uppercase font-bold" [ngClass]="{
                        'text-emerald-400': log.type === 'success',
                        'text-indigo-400': log.type === 'info',
                        'text-amber-400': log.type === 'warn'
                      }">{{ log.type }}</span>
                      <span>{{ log.time | date:'HH:mm:ss' }}</span>
                    </div>
                    <div class="text-slate-300">{{ log.text }}</div>
                  </div>
                }
                @if (hqState.logs().length === 0) {
                  <div class="text-center py-12 text-slate-500">Nenhum log gravado nesta sessão.</div>
                }
              </div>

              <div class="p-3 border-t border-slate-800 bg-slate-950/40 flex justify-between">
                <button (click)="hqState.logs.set([])" class="text-xs text-rose-400 hover:text-rose-300 font-medium">Limpar Logs</button>
                <button (click)="isLogsOpen.set(false)" class="text-xs text-slate-400 hover:text-white font-medium">Fechar</button>
              </div>
            </div>
          }
        </main>
      </div>
  `
})
export class HqOsShellComponent implements OnInit, OnDestroy {
  hqState = inject(HqStateService);
  identityService = inject(IdentityService);
  displayEngine = inject(OsDisplayEngineService);
  router = inject(Router);
  
  adminEmail = signal('');
  adminPassword = signal('');
  isLogsOpen = signal(false);
  isCommandPaletteOpen = signal(false);
  isDisplaySettingsOpen = signal(false);
  commandQuery = signal('');
  currentTime = signal(new Date());
  private clockInterval?: ReturnType<typeof setInterval>;

  handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.altKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.isCommandPaletteOpen.update(v => !v);
    }
    if (event.key === 'Escape') {
      if (this.isCommandPaletteOpen()) this.isCommandPaletteOpen.set(false);
      if (this.isDisplaySettingsOpen()) this.isDisplaySettingsOpen.set(false);
    }
  }

  ngOnInit() {
    this.clockInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  ngOnDestroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  onEmailInput(event: Event) {
    this.adminEmail.set((event.target as HTMLInputElement).value);
  }

  onPasswordInput(event: Event) {
    this.adminPassword.set((event.target as HTMLInputElement).value);
  }

  onCommandQueryInput(event: Event) {
    this.commandQuery.set((event.target as HTMLInputElement).value);
  }

  navigateAndClose(route: string) {
    this.router.navigateByUrl(route);
    this.isCommandPaletteOpen.set(false);
  }

  toggleLogs() {
    this.isLogsOpen.update(v => !v);
  }

  async onLoginSubmit(event: Event) {
    event.preventDefault();
    await this.hqState.login(this.adminEmail(), this.adminPassword());
  }

  logout() {
    this.hqState.logout();
  }
}

