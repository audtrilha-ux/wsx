import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { WindowManagerService, WindowState } from '../../core/application/window-manager.service';
import { OsStateService } from '../../os-state.service';
import { SyncService } from '../../core/sync/sync.service';
import { PrinterService } from '../../core/printing/printer.service';
import { HardwareService } from '../../core/hardware/hardware.service';
import { DiagnosticsService } from '../../core/diagnostics/diagnostics.service';
import { DeviceService } from '../../core/device/device.service';
import { IdentityService } from '../../core/identity/identity.service';
import { OperatorLockService } from '../../core/operator-lock/operator-lock.service';
import { DocumentationSearchService } from '../../core/browser-search/documentation-search.service';
import { AppRegistryService } from '../../core/app-runtime/app-registry.service';
import { AppRuntimeService } from '../../core/app-runtime/app-runtime.service';
import { OsDisplayEngineService } from '../../core/application/display-engine.service';
import { LinuxThemeService, LINUX_WALLPAPERS } from '../../core/theme/linux-theme.service';
import { OsProfileService, OsProfileType } from '../../core/os-profile/os-profile.service';

import { OperatorLockComponent } from './operator-lock.component';
import { OsShortcutsHudComponent } from './components/os-shortcuts-hud.component';
import { OsCalendarFlyoutComponent } from './components/os-calendar-flyout.component';
import { OsDesktopContextMenuComponent } from './components/os-desktop-context-menu.component';
import { OsStartMenuComponent, StartMenuAppItem } from './components/os-start-menu.component';
import { OsQuickSettingsComponent } from './components/os-quick-settings.component';
import { OsDesktopShortcutsComponent, AppShortcut } from './components/os-desktop-shortcuts.component';
import { OsWindowCompositorComponent } from './components/os-window-compositor.component';
import { OsTaskbarComponent } from './components/os-taskbar.component';

export interface OsNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'info';
  timestamp: Date;
}

export interface WorkspaceTenant {
  id: string;
  name: string;
  balance: number;
  status: 'active' | 'suspended';
}

@Component({
  selector: 'app-os-shell',
  host: {
    '(window:resize)': 'onWindowResize()',
    '(document:mousemove)': 'onMouseMove($event)',
    '(document:mouseup)': 'onMouseUp()',
    '(document:keydown)': 'handleKeyboard($event)'
  },
  imports: [
    CommonModule, 
    MatIconModule, 
    OperatorLockComponent,
    OsShortcutsHudComponent,
    OsCalendarFlyoutComponent,
    OsDesktopContextMenuComponent,
    OsStartMenuComponent,
    OsQuickSettingsComponent,
    OsDesktopShortcutsComponent,
    OsWindowCompositorComponent,
    OsTaskbarComponent
  ],
  templateUrl: './os-shell.component.html'
})
export class OsShellComponent implements OnInit, OnDestroy {
  // Dependency Injection
  windowManager = inject(WindowManagerService);
  osState = inject(OsStateService);
  identityService = inject(IdentityService);
  syncService = inject(SyncService);
  printerService = inject(PrinterService);
  hardwareService = inject(HardwareService);
  diagnosticsService = inject(DiagnosticsService);
  deviceService = inject(DeviceService);
  operatorLockService = inject(OperatorLockService);
  appRegistry = inject(AppRegistryService);
  appRuntimeService = inject(AppRuntimeService);
  browserSearch = inject(DocumentationSearchService);
  displayEngine = inject(OsDisplayEngineService);
  osProfileService = inject(OsProfileService);
  activeProfile = this.osProfileService.activeProfile;
  private router = inject(Router);
  private http = inject(HttpClient);

  // Shell Controls Signals
  isStartMenuOpen = signal<boolean>(false);
  isTrayOpen = signal<boolean>(false);
  isWorkspaceMenuOpen = signal<boolean>(false);

  // Available Workspaces / Tenants
  tenantsList = computed<WorkspaceTenant[]>(() => {
    const tenant = this.identityService.currentTenant();
    if (tenant) {
      return [{
        id: tenant.tenantId,
        name: tenant.tenantName,
        balance: tenant.balance !== undefined ? tenant.balance : 0,
        status: (tenant.status as 'active' | 'suspended') || 'active'
      }];
    }
    return [];
  });
  
  themeService = inject(LinuxThemeService);

  // Linux Curated Wallpapers List
  wallpapers = [
    ...LINUX_WALLPAPERS,
    { id: 'sunset', name: 'Aura Sunset', css: "bg-[url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070&auto=format&fit=crop')]" },
    { id: 'aurora', name: 'Neon Aurora', css: "bg-[url('https://images.unsplash.com/photo-1531315630201-bb15abeb1653?q=80&w=2070&auto=format&fit=crop')]" },
    { id: 'cozy', name: 'Starry Mountains', css: "bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2070&auto=format&fit=crop')]" },
    { id: 'slate', name: 'Slate Minimalist', css: 'bg-slate-900' },
    { id: 'grid', name: 'Cyberpunk Grid', css: "bg-indigo-950 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px]" }
  ];
  activeWallpaper = signal<string>(this.themeService.effectiveWallpaper());

  // Dynamic Adaptive Scale & Auto Screen Adjust
  desktopIconSize = signal<'small' | 'normal' | 'large'>('normal');
  autoFitActive = signal<boolean>(true);

  // Desktop Right-Click Context Menu
  isContextMenuOpen = signal<boolean>(false);
  contextMenuX = signal<number>(0);
  contextMenuY = signal<number>(0);

  // Notifications & History
  notifications = signal<OsNotification[]>([]);
  notificationHistory = signal<OsNotification[]>([]);
  isCalendarOpen = signal<boolean>(false);

  // Time and Date Signals
  currentTime = signal<string>('');
  currentTimeWithSeconds = signal<string>('');
  currentDate = signal<string>('');
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  // Window Drag & Resize State
  draggingWindowId: string | null = null;
  dragStartX = 0;
  dragStartY = 0;
  windowStartX = 0;
  windowStartY = 0;

  resizingWindowId: string | null = null;
  resizeStartX = 0;
  resizeStartY = 0;
  windowStartWidth = 0;
  windowStartHeight = 0;

  activeDraggingId = signal<string | null>(null);
  activeResizingId = signal<string | null>(null);
  snapPreviewZone = signal<'left' | 'right' | null>(null);
  isDesktopShown = signal<boolean>(false);
  isShortcutHudOpen = signal<boolean>(false);

  private dragFrameId: number | null = null;

  installedAppShortcuts = computed<AppShortcut[]>(() => {
    const installed = this.osState.installedAppsList();
    
    return installed
      .filter(app => !app.isSystemApp && !app.id.startsWith('sys_') && 
                     app.id !== 'browser' && app.id !== 'file_explorer' && 
                     app.id !== 'calculator' && app.id !== 'task_manager' && 
                     app.id !== 'app_settings' && app.id !== 'app_health_diagnostics')
      .map(app => {
        let color = 'bg-indigo-600';
        if (app.id === 'app_pos') color = 'bg-emerald-600';
        else if (app.id === 'app_tables') color = 'bg-amber-600';
        else if (app.id === 'app_inventory') color = 'bg-teal-600';
        else if (app.id === 'app_finance') color = 'bg-amber-700';
        else if (app.id === 'app_crm') color = 'bg-purple-600';
        else if (app.id === 'app_telegram') color = 'bg-sky-600';
        else if (app.id === 'app_ifood') color = 'bg-rose-600';
        else if (app.id === 'app_whatsapp') color = 'bg-green-600';

        return {
          id: app.id,
          name: app.name,
          icon: app.icon || 'apps',
          color
        };
      });
  });

  switchProfile(profile: OsProfileType) {
    this.osProfileService.setProfile(profile);
    const label = profile === 'retail' ? 'Varejo & Comércio' : 'Restaurantes & Gastronomia';
    const suiteDesc = profile === 'retail' ? 'PDV, Estoque, CRM e Telegram' : 'Mesas/KDS, Finanças, PDV e Estoque';
    this.addNotification('Modo OS Alternado', `Ambiente alternado para ${label}. Suíte pré-instalada ativa: ${suiteDesc}.`, 'success');
  }

  toggleOperationalProfile() {
    const next = this.activeProfile() === 'retail' ? 'restaurant' : 'retail';
    this.switchProfile(next);
  }

  activeOperator = computed(() => {
    const identity = this.identityService.currentIdentity();
    return identity ? { name: identity.displayName || identity.username, role: identity.role } : null;
  });

  startMenuInstalledApps = computed(() => {
    return this.osState.installedAppsList()
      .map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: 'GENERAL'
      }));
  });

  openAppFromStartMenu(appId: string) {
    const manifest = this.osState.availableApps().find(a => a.id === appId);
    const title = manifest ? manifest.name : appId.replace('app_', '').toUpperCase();
    const icon = manifest ? manifest.icon : 'extension';
    this.windowManager.openWindow(appId, title, icon);
  }

  launchAppFromStartMenu(item: StartMenuAppItem) {
    this.windowManager.openWindow(item.id, item.name, item.icon);
  }

  ngOnInit() {
    // Carregar preferência salva de escala e auto-fit
    const savedScale = localStorage.getItem('3eatcru_desktop_scale_v1') as 'small' | 'normal' | 'large' | null;
    if (savedScale && ['small', 'normal', 'large'].includes(savedScale)) {
      this.desktopIconSize.set(savedScale);
    }
    const savedAutoFit = localStorage.getItem('3eatcru_autofit_active_v1');
    if (savedAutoFit !== null) {
      this.autoFitActive.set(savedAutoFit === 'true');
    }

    // Inicializar Relógio do Sistema com atualização a cada segundo
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);

    // Carregar histórico de notificações do armazenamento local
    try {
      const savedNotifs = localStorage.getItem('3eatcru_notification_history_v1');
      if (savedNotifs) {
        const parsed = JSON.parse(savedNotifs);
        this.notificationHistory.set(parsed.map((n: OsNotification) => ({ ...n, timestamp: new Date(n.timestamp) })));
      }
    } catch (e) {
      console.warn('Falha ao carregar histórico de notificações:', e);
    }

    // Auto-ajustar janelas no carregamento se ativado
    if (this.autoFitActive()) {
      setTimeout(() => this.autoFitWindows(), 200);
    }

    this.addNotification('Sistema Inicializado', '3eatcru OS pronto para operação.', 'success');
  }

  ngOnDestroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  private updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    this.currentTime.set(`${hours}:${minutes}`);
    this.currentTimeWithSeconds.set(`${hours}:${minutes}:${seconds}`);

    const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short' };
    this.currentDate.set(now.toLocaleDateString('pt-BR', options));
  }

  addNotification(title: string, message: string, type: 'success' | 'warning' | 'info' = 'info') {
    const id = 'notif_' + Math.random().toString(36).substring(2, 9);
    const newNotif: OsNotification = { id, title, message, type, timestamp: new Date() };

    this.notifications.update(curr => [...curr, newNotif]);
    this.notificationHistory.update(curr => [newNotif, ...curr.slice(0, 29)]);

    try {
      localStorage.setItem('3eatcru_notification_history_v1', JSON.stringify(this.notificationHistory()));
    } catch {
      // Ignorar quota cheia
    }

    setTimeout(() => {
      this.removeNotification(id);
    }, 4500);
  }

  removeNotification(id: string) {
    this.notifications.update(curr => curr.filter(n => n.id !== id));
  }

  clearAllNotifications() {
    this.notifications.set([]);
    this.notificationHistory.set([]);
    localStorage.removeItem('3eatcru_notification_history_v1');
  }

  dismissHistoricalNotification(id: string) {
    this.notificationHistory.update(curr => curr.filter(n => n.id !== id));
    localStorage.setItem('3eatcru_notification_history_v1', JSON.stringify(this.notificationHistory()));
  }

  toggleCalendar() {
    this.isCalendarOpen.update(v => !v);
    if (this.isCalendarOpen()) {
      this.isStartMenuOpen.set(false);
      this.isTrayOpen.set(false);
    }
  }

  onDesktopContextMenu(event: MouseEvent) {
    event.preventDefault();
    this.contextMenuX.set(Math.min(event.clientX, window.innerWidth - 240));
    this.contextMenuY.set(Math.min(event.clientY, window.innerHeight - 340));
    this.isContextMenuOpen.set(true);
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.isCalendarOpen.set(false);
  }

  closeContextMenu() {
    this.isContextMenuOpen.set(false);
  }

  refreshDesktop() {
    this.closeContextMenu();
    this.addNotification('Área de Trabalho', 'Ambiente de trabalho atualizado com sucesso.', 'info');
  }


  openInstalledApps() {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.windowManager.openWindow('installed', 'Meus Aplicativos', 'apps');
  }

  openSettings() {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.windowManager.openWindow('app_settings', 'Painel de Controle', 'settings');
  }

  openBrowser() {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.windowManager.openWindow('browser', 'Docs & Especificações', 'menu_book');
  }

  openTaskManager() {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.windowManager.openWindow('task_manager', 'Gerenciador de Tarefas', 'view_timeline');
  }

  openCalculator() {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.windowManager.openWindow('calculator', 'Calculadora', 'calculate');
  }

  openFileExplorer() {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.windowManager.openWindow('file_explorer', 'Este Computador', 'folder_open');
  }

  openHealthDiagnostics() {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.windowManager.openWindow('app_health_diagnostics', 'Diagnóstico & Telemetria OS', 'monitor_heart');
  }

  openCartWindow() {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.windowManager.openWindow('cart_drawer', 'Comanda & Sacola de Pedidos', 'receipt_long');
  }

  openMarketplaceWindow() {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.windowManager.openWindow('marketplace_catalog', 'Catálogo & Fichário Comercial', 'storefront');
  }

  openDynamicApp(app: AppShortcut) {
    this.windowManager.openWindow(app.id, app.name, app.icon);
  }

  switchWorkspace(tenant: WorkspaceTenant) {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.isWorkspaceMenuOpen.set(false);
    
    // In the new architecture, the Client OS is strictly bound to the authenticated tenant.
    // Switching tenants requires logging out and logging back in, unless impersonated by HQ.
    if (tenant.id !== this.identityService.currentTenant()?.tenantId) {
       this.addNotification('Acesso Negado', 'Para trocar de empresa, realize logout e acesse com as credenciais do outro ambiente.', 'warning');
       return;
    }

    this.addNotification('Workspace Ativo', `Você já está conectado à empresa ${tenant.name}.`, 'success');
  }

  onStartMenuSearchWeb(query: string) {
    this.isStartMenuOpen.set(false);
    this.openBrowser();
    this.browserSearch.performSearch(query);
    this.addNotification('Busca Local', `Pesquisando especificações locais para "${query}"`, 'info');
  }

  triggerManualSync() {
    if (!this.syncService.isOnline()) {
      this.addNotification('Erro de Sincronismo', 'O terminal está offline. Ative a rede para sincronizar.', 'warning');
      return;
    }
    
    this.syncService.sync()
      .then(() => {
        this.addNotification('Sucesso', 'Consolidação realizada. Outbox sincronizado com a Central.', 'success');
      })
      .catch(err => {
        this.addNotification('Falha de Rede', err.message, 'warning');
      });
  }

  toggleNetwork() {
    this.syncService.toggleOnlineStatus();
    const online = this.syncService.isOnline();
    if (online) {
      this.addNotification('Modo Online', 'Terminal conectado à Central do 3eatcru.', 'success');
      this.syncService.sync().catch(err => console.warn('Background sync failed:', err));
    } else {
      this.addNotification('Modo Offline', 'Trabalhando localmente. Transações serão salvas na fila Outbox.', 'warning');
    }
  }

  reprintLastReceipt() {
    const jobs = this.printerService.jobs();
    if (jobs.length > 0) {
      const lastJob = jobs[0];
      this.printerService.print(`[2ª VIA] ${lastJob.title}`, lastJob.content)
        .then(() => {
          this.addNotification('Bobina Térmica', `Segunda via impressa: ${lastJob.title}`, 'success');
        })
        .catch(err => {
          this.addNotification('Bobina Falhou', err.message, 'warning');
        });
    } else {
      this.addNotification('Histórico Vazio', 'Nenhum cupom foi emitido no terminal hoje.', 'info');
    }
  }

  togglePrinterPaper() {
    const current = this.printerService.activePrinter()?.status;
    const nextStatus = current === 'no_paper' ? 'online' : 'no_paper';
    this.hardwareService.updateStatus('prn_01', nextStatus);

    if (nextStatus === 'no_paper') {
      this.addNotification('Bobina Crítica', 'Impressora de cupom está sem papel térmico!', 'warning');
    } else {
      this.addNotification('Bobina Carregada', 'Impressora de cupom restabelecida e pronta.', 'success');
    }
  }

  triggerCashDrawer() {
    this.hardwareService.triggerCashDrawer();
    this.addNotification('Gaveta de Dinheiro', 'Pulso elétrico enviado. Gaveteiro comercial acionado.', 'success');
  }

  triggerDiagnostics() {
    this.diagnosticsService.runDiagnostic();
    this.addNotification('Checagem do Core OS', 'Executando auditoria e diagnósticos de integridade...', 'info');
    
    setTimeout(() => {
      const report = this.diagnosticsService.report();
      if (report && report.overallStatus === 'healthy') {
        this.addNotification('Integridade OK', 'Todos os subsistemas do Core OS estão saudáveis.', 'success');
      } else {
        this.addNotification('Inconformidade', 'Diagnóstico detectou advertências nos periféricos locais.', 'warning');
      }
    }, 1500);
  }

  setWallpaper(cssClass: string) {
    this.activeWallpaper.set(cssClass);
    const match = this.wallpapers.find(w => w.css === cssClass);
    if (match) {
      this.themeService.setWallpaper(match.id);
    }
    this.addNotification('Tema Linux', 'Papel de parede da área de trabalho atualizado.', 'info');
  }

  lockSystem() {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.operatorLockService.lock();
  }

  toggleShortcutHud() {
    this.isShortcutHudOpen.update(v => !v);
  }

  logoutSession() {
    this.isStartMenuOpen.set(false);
    this.isTrayOpen.set(false);
    this.identityService.logout();
    this.router.navigate(['/access']);
  }

  setDesktopIconSize(size: 'small' | 'normal' | 'large') {
    this.desktopIconSize.set(size);
    localStorage.setItem('3eatcru_desktop_scale_v1', size);
    this.addNotification(
      'Ajuste de Tela', 
      `Ícones da Área de Trabalho ajustados para o tamanho ${size === 'small' ? 'Compacto' : size === 'normal' ? 'Padrão' : 'Expandido'}.`, 
      'success'
    );
  }

  toggleAutoFit() {
    this.autoFitActive.update(val => {
      const next = !val;
      localStorage.setItem('3eatcru_autofit_active_v1', String(next));
      if (next) {
        this.autoFitWindows();
        this.addNotification('Ajuste Automático', 'Ajuste de tela inteligente reativado.', 'success');
      } else {
        this.addNotification('Ajuste Automático', 'Ajuste de tela inteligente desativado.', 'warning');
      }
      return next;
    });
  }

  autoFitWindows() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight - 56;
    const isSmall = screenWidth < 1024;

    this.windowManager.windows().forEach(win => {
      if (!win.isOpen || win.isMinimized) return;

      if (isSmall && !win.isMaximized) {
        this.windowManager.toggleMaximize(win.id);
        return;
      }

      if (!win.isMaximized && !win.isSnapped) {
        const preferredW = win.width || 1000;
        const preferredH = win.height || 650;
        
        const nextW = Math.max(320, Math.min(preferredW, screenWidth - 16));
        const nextH = Math.max(240, Math.min(preferredH, screenHeight - 20));

        const currentX = win.x !== undefined ? win.x : (screenWidth - nextW) / 2;
        const currentY = win.y !== undefined ? win.y : (screenHeight - nextH) / 2;

        const nextX = Math.max(8, Math.min(currentX, screenWidth - nextW - 8));
        const nextY = Math.max(16, Math.min(currentY, screenHeight - nextH - 8));

        this.windowManager.updateWindowSize(win.id, nextW, nextH);
        this.windowManager.updateWindowPosition(win.id, nextX, nextY);
      }
    });
  }

  onWindowResize() {
    if (this.autoFitActive()) {
      this.autoFitWindows();
    }
  }

  startDrag(event: MouseEvent, win: WindowState) {
    this.windowManager.focusWindow(win.id);
    if (event.button !== 0) return;

    let initX = win.x ?? Math.max(8, (window.innerWidth - (win.width || 1000)) / 2);
    let initY = win.y ?? Math.max(16, (window.innerHeight - 56 - (win.height || 650)) / 2);
    const initW = win.width || 1000;

    if (win.isMaximized || win.isSnapped) {
      const clickRatioX = (event.clientX - initX) / initW;
      const restoredW = win.preSnapWidth || 1000;
      const restoredH = win.preSnapHeight || 650;
      
      initX = event.clientX - clickRatioX * restoredW;
      initY = event.clientY - 15;

      this.windowManager.unsnapAndRestore(win.id);
      this.windowManager.updateWindowPosition(win.id, initX, initY);
      this.windowManager.updateWindowSize(win.id, restoredW, restoredH);
    } else {
      this.windowManager.saveFloatingState(win.id, initX, initY, initW, win.height || 650);
    }

    this.draggingWindowId = win.id;
    this.activeDraggingId.set(win.id);
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.windowStartX = initX;
    this.windowStartY = initY;
    
    event.preventDefault();
  }

  startResize(event: MouseEvent, win: WindowState) {
    if (win.isMaximized || win.isSnapped) return;
    
    this.windowManager.focusWindow(win.id);
    if (event.button !== 0) return;

    this.resizingWindowId = win.id;
    this.activeResizingId.set(win.id);
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.windowStartWidth = win.width || 1000;
    this.windowStartHeight = win.height || 650;
    
    event.preventDefault();
    event.stopPropagation();
  }

  onMouseMove(event: MouseEvent) {
    if (this.draggingWindowId) {
      if (this.dragFrameId !== null) {
        cancelAnimationFrame(this.dragFrameId);
      }
      this.dragFrameId = requestAnimationFrame(() => {
        const deltaX = event.clientX - this.dragStartX;
        const deltaY = event.clientY - this.dragStartY;
        const nextX = this.windowStartX + deltaX;
        const nextY = this.windowStartY + deltaY;

        this.windowManager.updateWindowPosition(this.draggingWindowId!, nextX, nextY);

        if (event.clientX < 40) {
          this.snapPreviewZone.set('left');
        } else if (event.clientX > window.innerWidth - 40) {
          this.snapPreviewZone.set('right');
        } else {
          this.snapPreviewZone.set(null);
        }
        this.dragFrameId = null;
      });
    } else if (this.resizingWindowId) {
      if (this.dragFrameId !== null) {
        cancelAnimationFrame(this.dragFrameId);
      }
      this.dragFrameId = requestAnimationFrame(() => {
        const deltaX = event.clientX - this.resizeStartX;
        const deltaY = event.clientY - this.resizeStartY;
        
        const nextWidth = Math.max(480, this.windowStartWidth + deltaX);
        const nextHeight = Math.max(360, this.windowStartHeight + deltaY);

        this.windowManager.updateWindowSize(this.resizingWindowId!, nextWidth, nextHeight);
        this.dragFrameId = null;
      });
    }
  }

  onMouseUp() {
    if (this.dragFrameId !== null) {
      cancelAnimationFrame(this.dragFrameId);
      this.dragFrameId = null;
    }
    if (this.draggingWindowId) {
      if (this.snapPreviewZone() === 'left') {
        this.windowManager.snapWindow(this.draggingWindowId, 'left');
      } else if (this.snapPreviewZone() === 'right') {
        this.windowManager.snapWindow(this.draggingWindowId, 'right');
      }
      this.draggingWindowId = null;
      this.activeDraggingId.set(null);
      this.snapPreviewZone.set(null);
    }
    if (this.resizingWindowId) {
      this.resizingWindowId = null;
      this.activeResizingId.set(null);
    }
  }

  triggerSnap(winId: string, side: 'left' | 'right' | null) {
    this.windowManager.snapWindow(winId, side);
    this.addNotification('Organização Inteligente', side ? `Janela alinhada à ${side === 'left' ? 'esquerda' : 'direita'}.` : 'Janela restaurada ao modo livre.', 'info');
  }

  toggleShowDesktop() {
    const wins = this.windowManager.windows();
    const allMinimizedOrClosed = wins.every(w => w.isMinimized || !w.isOpen);

    if (allMinimizedOrClosed) {
      wins.forEach(w => {
        if (w.isOpen) {
          this.windowManager.focusWindow(w.id);
        }
      });
      this.isDesktopShown.set(false);
      this.addNotification('Área de Trabalho', 'Restaurando aplicativos ativos.', 'info');
    } else {
      wins.forEach(w => {
        if (w.isOpen && !w.isMinimized) {
          this.windowManager.minimizeWindow(w.id);
        }
      });
      this.isDesktopShown.set(true);
      this.addNotification('Área de Trabalho', 'Todas as janelas minimizadas.', 'info');
    }
  }

  handleKeyboard(event: KeyboardEvent) {
    const activeId = this.windowManager.topWindowId();
    
    if (event.altKey && event.key === 'ArrowLeft' && activeId) {
      event.preventDefault();
      this.windowManager.snapWindow(activeId, 'left');
      this.addNotification('Atalho OS', 'Janela encaixada à esquerda.', 'info');
    } else if (event.altKey && event.key === 'ArrowRight' && activeId) {
      event.preventDefault();
      this.windowManager.snapWindow(activeId, 'right');
      this.addNotification('Atalho OS', 'Janela encaixada à direita.', 'info');
    } else if (event.altKey && event.key === 'ArrowUp' && activeId) {
      event.preventDefault();
      const win = this.windowManager.windows().find(w => w.id === activeId);
      if (win && !win.isMaximized) {
        this.windowManager.toggleMaximize(activeId);
        this.addNotification('Atalho OS', 'Janela maximizada.', 'info');
      }
    } else if (event.altKey && event.key === 'ArrowDown' && activeId) {
      event.preventDefault();
      const win = this.windowManager.windows().find(w => w.id === activeId);
      if (win) {
        if (win.isMaximized) {
          this.windowManager.toggleMaximize(activeId);
          this.addNotification('Atalho OS', 'Janela restaurada.', 'info');
        } else {
          this.windowManager.minimizeWindow(activeId);
          this.addNotification('Atalho OS', 'Janela minimizada.', 'info');
        }
      }
    } else if ((event.altKey && event.key === ' ') || (event.altKey && event.key === 'q')) {
      event.preventDefault();
      this.isStartMenuOpen.update(val => !val);
      if (this.isStartMenuOpen()) {
        setTimeout(() => {
          const el = document.getElementById('start-menu-search');
          if (el) el.focus();
        }, 80);
      }
    } else if (event.altKey && (event.key === 'd' || event.key === 'D')) {
      event.preventDefault();
      this.toggleShowDesktop();
    } else if (event.altKey && (event.key === 'g' || event.key === 'G')) {
      event.preventDefault();
      this.windowManager.tileWindows();
      this.addNotification('Arrumação OS', 'Janelas organizadas em grade.', 'info');
    } else if (event.altKey && (event.key === 'c' || event.key === 'C')) {
      event.preventDefault();
      this.windowManager.cascadeWindows();
      this.addNotification('Arrumação OS', 'Janelas organizadas em cascata.', 'info');
    } else if (event.altKey && (event.key === 'a' || event.key === 'A')) {
      event.preventDefault();
      this.autoFitWindows();
      this.addNotification('Ajuste de Tela', 'Janelas recalibradas e ajustadas ao viewport.', 'success');
    } else if (event.altKey && (event.key === 's' || event.key === 'S')) {
      event.preventDefault();
      this.openBrowser();
      this.addNotification('Atalho OS', 'Docs & Especificações iniciado.', 'info');
    } else if (event.altKey && (event.key === 't' || event.key === 'T')) {
      event.preventDefault();
      this.openTaskManager();
      this.addNotification('Atalho OS', 'Gerenciador de Tarefas iniciado.', 'info');
    } else if (event.altKey && (event.key === 'e' || event.key === 'E')) {
      event.preventDefault();
      this.openFileExplorer();
      this.addNotification('Atalho OS', 'Explorador de Arquivos iniciado.', 'info');
    } else if (event.altKey && (event.key === 'h' || event.key === 'H')) {
      event.preventDefault();
      this.openHealthDiagnostics();
      this.addNotification('Atalho OS', 'Diagnóstico & Telemetria iniciado.', 'info');
    } else if (event.altKey && (event.key === 'n' || event.key === 'N')) {
      event.preventDefault();
      this.toggleCalendar();
    } else if (event.altKey && (event.key === '/' || event.key === '?' || event.key === ';')) {
      event.preventDefault();
      this.isShortcutHudOpen.update(val => !val);
    } else if (event.key === 'Escape') {
      if (this.isStartMenuOpen() || this.isTrayOpen() || this.isShortcutHudOpen() || this.isCalendarOpen() || this.isContextMenuOpen()) {
        event.preventDefault();
        this.isStartMenuOpen.set(false);
        this.isTrayOpen.set(false);
        this.isShortcutHudOpen.set(false);
        this.isCalendarOpen.set(false);
        this.isContextMenuOpen.set(false);
      }
    }
  }
}
