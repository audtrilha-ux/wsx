import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OsContext, OsPrintOptions } from '../../contracts/os/os-context.contract';
import { OsDatabaseTransaction } from '../../contracts/os/os-database.contract';
import { OsDatabaseService } from '../storage/os-database.service';
import { PrinterService } from '../printing/printer.service';
import { SyncService } from '../sync/sync.service';
import { OsEventBusService } from '../events/event-bus.service';
import { IEventSubscription, OsEventHandler } from '../../contracts/events/events.contract';
import { HardwareService } from '../hardware/hardware.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { DeviceService } from '../device/device.service';
import { AppRegistryService } from './app-registry.service';
import { AppAccessService } from './app-access.service';
import { ProcessManagerService } from './process-manager.service';
import { IdentityService } from '../identity/identity.service';
import { OsStateService } from '../../os-state.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { OperatorLockService } from '../operator-lock/operator-lock.service';
import { AppLifecycleState } from '../../contracts/apps/app-instance.contract';
import { ClientApiClient, RequestOptions } from '../api/api-client';
import { HttpRequestOptions, NetworkStatus } from '../../contracts/network/network.contract';

export type RestartPolicy = 'never' | 'always' | 'on_failure';

export interface BackgroundTask {
  id: string;
  appId: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'canceled';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface RunningAppInstance {
  appId: string;
  state: AppLifecycleState;
  startedAt: Date;
  lastActiveAt: Date;
  restartPolicy?: RestartPolicy;
  maxRetries?: number;
  retryCount?: number;
  lastError?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppRuntimeService {
  private osDb = inject(OsDatabaseService);
  private printerService = inject(PrinterService);
  private syncService = inject(SyncService);
  private eventBus = inject(OsEventBusService);
  private hardwareService = inject(HardwareService);
  private diagnosticsService = inject(DiagnosticsService);
  private deviceService = inject(DeviceService);
  private appRegistry = inject(AppRegistryService);
  private appAccess = inject(AppAccessService);
  private processManager = inject(ProcessManagerService);
  private identityService = inject(IdentityService);
  private osState = inject(OsStateService);
  private configService = inject(ConfigurationService);
  private operatorLockService = inject(OperatorLockService);
  private apiClient = inject(ClientApiClient);

  // Monitoramento de instâncias e ciclos de vida em execução no OS
  private runningInstances = signal<Map<string, RunningAppInstance>>(new Map());

  // Subscrições ativas por aplicativo (para liberação automática)
  private appSubscriptions = new Map<string, (() => void)[]>();

  // Tarefas em segundo plano por aplicativo
  private backgroundTasks = signal<Map<string, BackgroundTask>>(new Map());

  // Hook para emissão de notificações globais do Shell
  onNotification?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  // Hook para abertura de janelas
  onOpenAppRequest?: (targetAppId: string, title?: string) => void;

  constructor() {
    this.initWatchdog();
  }

  registerSubscription(appId: string, unsubscribeFn: () => void): void {
    if (!this.appSubscriptions.has(appId)) {
      this.appSubscriptions.set(appId, []);
    }
    this.appSubscriptions.get(appId)!.push(unsubscribeFn);
  }

  cleanupAppSubscriptions(appId: string): void {
    const subs = this.appSubscriptions.get(appId);
    if (subs && subs.length > 0) {
      this.diagnosticsService.info(`[AppRuntime] Encerrando ${subs.length} subscrições ativas do app '${appId}'.`);
      subs.forEach(unsub => {
        try {
          unsub();
        } catch (err) {
          console.warn(`[AppRuntime] Erro ao liberar subscrição do app '${appId}':`, err);
        }
      });
      this.appSubscriptions.delete(appId);
    }
  }

  registerBackgroundTask(appId: string, name: string, taskFn: () => Promise<void>): string {
    const taskId = `bg_${appId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();

    const task: BackgroundTask = {
      id: taskId,
      appId,
      name,
      status: 'running',
      startedAt: now
    };

    this.backgroundTasks.update(map => {
      const updated = new Map(map);
      updated.set(taskId, task);
      return updated;
    });

    taskFn()
      .then(() => {
        this.updateTaskStatus(taskId, 'completed');
      })
      .catch(err => {
        const errorMsg = (err as Error)?.message || 'Erro desconhecido em background task';
        this.updateTaskStatus(taskId, 'failed', errorMsg);
        this.diagnosticsService.error(`[AppRuntime] Background task '${name}' do app '${appId}' falhou: ${errorMsg}`);
      });

    return taskId;
  }

  cancelBackgroundTask(taskId: string): void {
    this.updateTaskStatus(taskId, 'canceled');
  }

  private updateTaskStatus(taskId: string, status: BackgroundTask['status'], error?: string): void {
    this.backgroundTasks.update(map => {
      const updated = new Map(map);
      const existing = updated.get(taskId);
      if (existing) {
        updated.set(taskId, {
          ...existing,
          status,
          completedAt: new Date(),
          error
        });
      }
      return updated;
    });
  }

  getAppBackgroundTasks(appId: string): BackgroundTask[] {
    return Array.from(this.backgroundTasks().values()).filter(t => t.appId === appId);
  }

  setRestartPolicy(appId: string, policy: RestartPolicy, maxRetries = 3): void {
    this.runningInstances.update(map => {
      const updated = new Map(map);
      const existing = updated.get(appId);
      if (existing) {
        updated.set(appId, {
          ...existing,
          restartPolicy: policy,
          maxRetries,
          retryCount: existing.retryCount || 0
        });
      }
      return updated;
    });
  }

  async handleAppCrash(appId: string, error: unknown): Promise<void> {
    const errorMsg = (error as Error)?.message || String(error);
    this.diagnosticsService.error(`[AppRuntime] Crash detectado no aplicativo '${appId}': ${errorMsg}`);

    const instance = this.runningInstances().get(appId);
    this.cleanupAppSubscriptions(appId);

    // Cancelar tarefas de background do app com falha
    const appTasks = this.getAppBackgroundTasks(appId);
    appTasks.forEach(task => {
      if (task.status === 'running') {
        this.cancelBackgroundTask(task.id);
      }
    });

    if (!instance) {
      return;
    }

    const policy = instance.restartPolicy || 'on_failure';
    const retryCount = (instance.retryCount || 0) + 1;
    const maxRetries = instance.maxRetries || 3;

    if ((policy === 'always' || policy === 'on_failure') && retryCount <= maxRetries) {
      this.diagnosticsService.warn(`[AppRuntime] Reiniciando aplicativo '${appId}' (tentativa ${retryCount}/${maxRetries})...`);

      this.runningInstances.update(map => {
        const updated = new Map(map);
        updated.set(appId, {
          ...instance,
          state: 'initializing',
          retryCount,
          lastError: errorMsg
        });
        return updated;
      });

      // Tenta re-executar após breve delay
      setTimeout(() => {
        try {
          this.updateInstanceState(appId, 'active');
          if (this.onNotification) {
            this.onNotification('Aplicativo Recuperado', `O aplicativo '${appId}' foi reiniciado após uma falha.`, 'info');
          }
        } catch (reboundErr) {
          this.diagnosticsService.error(`[AppRuntime] Falha na tentativa de reinicialização de '${appId}':`, reboundErr);
        }
      }, 1000);
    } else {
      this.updateInstanceState(appId, 'destroyed');
      if (this.onNotification) {
        this.onNotification('Erro Crítico no App', `O aplicativo '${appId}' foi encerrado após exceder o limite de tentativas.`, 'error');
      }
    }
  }

  async terminateApp(appId: string, reason = 'Fechado pelo usuário'): Promise<void> {
    this.diagnosticsService.info(`[AppRuntime] Encerrando aplicativo '${appId}': ${reason}`);

    // 1. Liberação de Subscrições
    this.cleanupAppSubscriptions(appId);

    // 2. Encerrar Tarefas em Segundo Plano
    const tasks = this.getAppBackgroundTasks(appId);
    tasks.forEach(task => {
      if (task.status === 'running') {
        this.cancelBackgroundTask(task.id);
      }
    });

    // 3. Liberação de Hardware / Periféricos
    try {
      // Notifica o serviço de hardware se houver periféricos travados
      await this.hardwareService.sendCustomerDisplay('3EATCRU OS', 'Terminal Livre');
    } catch (hwErr) {
      console.warn(`[AppRuntime] Erro ao liberar periféricos para '${appId}':`, hwErr);
    }

    // 4. Desregistrar Processo Formal no ProcessManager
    this.processManager.unregisterAppProcess(appId);

    // 5. Atualizar Estado do Ciclo de Vida
    this.updateInstanceState(appId, 'destroyed');
  }

  private initWatchdog(): void {
    // Watchdog checa ativas a cada 30 segundos em segundo plano
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.watchdogCheck();
      }, 30000);
    }
  }

  watchdogCheck(): void {
    const now = Date.now();
    this.runningInstances().forEach((instance, appId) => {
      if (instance.state === 'active') {
        const inactiveMs = now - instance.lastActiveAt.getTime();
        // Se inativo por mais de 30 minutos sem batimento, marca warn
        if (inactiveMs > 30 * 60 * 1000) {
          this.diagnosticsService.warn(`[Watchdog] Aplicativo '${appId}' inativo há mais de 30 minutos.`);
        }
      }
    });
  }

  private checkPermission(appId: string, requiredPermission: string): boolean {
    const hasPerm = this.appAccess.isPermissionGranted(appId, requiredPermission);
    if (!hasPerm) {
      this.diagnosticsService.warn(`[Permission Engine] App '${appId}' negado ao acessar recurso '${requiredPermission}'.`);
    }
    return hasPerm;
  }

  validateAppCompatibility(appId: string): { compatible: boolean; reason?: string } {
    return this.appAccess.validateCompatibility(appId);
  }

  checkEntitlement(appId: string): boolean {
    const result = this.appAccess.canLaunchApp(appId);
    return result.allowed;
  }

  createContext(appId: string, companyId: string, companyName: string, branchId?: string, branchName?: string): OsContext {
    const access = this.appAccess.canLaunchApp(appId);
    if (!access.allowed) {
      this.diagnosticsService.error(`[AppRuntime] Bloqueio de segurança ao inicializar '${appId}': ${access.reason}`);
      throw new Error(`[Security] Execução de '${appId}' negada: ${access.reason}`);
    }

    const storageNamespace = this.osDb.getNamespace(`tenant.${companyId}.app.${appId}`);
    const syncService = this.syncService;
    const operatorLockService = this.operatorLockService;

    // Registra processo formal no supervisor de processos do OS
    const manifest = this.appRegistry.getManifest(appId);
    const appName = manifest?.name || appId;
    this.processManager.registerAppProcess(appId, appName, false);

    // Registra início do ciclo de vida
    this.updateInstanceState(appId, 'active');

    return {
      appId,
      companyId,
      companyName,
      branchId,
      branchName,
      get operatorName(): string {
        return operatorLockService.activeOperator()?.name || 'Operador';
      },
      get isOnline(): boolean {
        return syncService.isOnline();
      },
      storage: storageNamespace,
      events: {
        publish: <T = unknown>(topic: string, payload: T, originAppId?: string): void => {
          this.eventBus.publish(topic, payload, originAppId || appId);
        },
        subscribe: <T = unknown>(topic: string, handler: OsEventHandler<T>): IEventSubscription => {
          const sub = this.eventBus.subscribe<T>(topic, handler);
          const unsubFn = () => sub.unsubscribe();
          this.registerSubscription(appId, unsubFn);
          return {
            unsubscribe: () => {
              unsubFn();
              const subs = this.appSubscriptions.get(appId);
              if (subs) {
                const idx = subs.indexOf(unsubFn);
                if (idx !== -1) subs.splice(idx, 1);
              }
            }
          };
        },
        clearSubscriptions: (topic?: string): void => {
          this.eventBus.clearSubscriptions(topic);
        }
      },

      hardware: {
        readScale: async (scaleId?: string) => {
          if (!this.checkPermission(appId, 'hardware')) {
            throw new Error(`[Security] App '${appId}' não tem permissão 'hardware' para ler balança.`);
          }
          return this.hardwareService.readScale(scaleId);
        },
        triggerCashDrawer: async (drawerId?: string) => {
          if (!this.checkPermission(appId, 'hardware')) {
            throw new Error(`[Security] App '${appId}' não tem permissão 'hardware' para abrir gaveta.`);
          }
          return this.hardwareService.triggerCashDrawer(drawerId);
        },
        sendCustomerDisplay: async (line1: string, line2?: string, displayId?: string) => {
          if (!this.checkPermission(appId, 'hardware')) {
            throw new Error(`[Security] App '${appId}' não tem permissão 'hardware' para acionar display.`);
          }
          return this.hardwareService.sendCustomerDisplay(line1, line2, displayId);
        },
        listPeripherals: async () => {
          if (!this.checkPermission(appId, 'hardware')) {
            return [];
          }
          return this.hardwareService.listPeripherals();
        }
      },

      sync: {
        get isOnline(): boolean {
          return syncService.isOnline();
        },
        queueOperation: async (action: string, payload: unknown) => {
          await this.syncService.queueOperation(action, payload, appId);
        },
        queueOperationTransacted: async (tx: OsDatabaseTransaction, action: string, payload: unknown) => {
          await this.syncService.queueOperationTransacted(tx, action, payload, appId);
        }
      },

      network: {
        connectivity: {
          get status(): NetworkStatus {
            return {
              isOnline: syncService.isOnline(),
              type: typeof navigator !== 'undefined' && 'connection' in navigator ? (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType as unknown as NetworkStatus['type'] || 'unknown' : 'unknown',
              lastCheckedAt: syncService.lastSyncedAt() || new Date()
            };
          },
          isOnline: () => syncService.isOnline(),
          onStatusChange: (callback: (status: NetworkStatus) => void) => {
            const handleOnline = () => callback({ isOnline: true, lastCheckedAt: new Date() });
            const handleOffline = () => callback({ isOnline: false, lastCheckedAt: new Date() });
            if (typeof window !== 'undefined') {
              window.addEventListener('online', handleOnline);
              window.addEventListener('offline', handleOffline);
              return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
              };
            }
            return () => undefined;
          },
          checkConnection: async () => {
            await syncService.sync();
            return syncService.isOnline();
          }
        },
        http: {
          get: async <T = unknown>(url: string, options?: HttpRequestOptions) => 
            firstValueFrom(this.apiClient.get<T>(url, options as unknown as RequestOptions)),
          post: async <T = unknown>(url: string, body: unknown, options?: HttpRequestOptions) => 
            firstValueFrom(this.apiClient.post<T>(url, body, options as unknown as RequestOptions)),
          put: async <T = unknown>(url: string, body: unknown, options?: HttpRequestOptions) => 
            firstValueFrom(this.apiClient.put<T>(url, body, options as unknown as RequestOptions)),
          patch: async <T = unknown>(url: string, body: unknown, options?: HttpRequestOptions) => 
            firstValueFrom(this.apiClient.patch<T>(url, body, options as unknown as RequestOptions)),
          delete: async <T = unknown>(url: string, options?: HttpRequestOptions) => 
            firstValueFrom(this.apiClient.delete<T>(url, options as unknown as RequestOptions))
        }
      },

      logger: {
        info: (message: string, context?: Record<string, unknown>) =>
          this.diagnosticsService.info(`[${appId}] ${message}`, context),
        warn: (message: string, context?: Record<string, unknown>) =>
          this.diagnosticsService.warn(`[${appId}] ${message}`, context),
        error: (message: string, error?: unknown, context?: Record<string, unknown>) =>
          this.diagnosticsService.error(`[${appId}] ${message}`, error, context)
      },

      config: {
        get: (key: string) => this.configService.get(key, 'COMPANY')
      },

      print: async (title: string, content: string, options?: OsPrintOptions): Promise<boolean> => {
        if (!this.checkPermission(appId, 'printer')) {
          if (this.onNotification) {
            this.onNotification('Permissão Negada', `O aplicativo '${appId}' não possui permissão para emitir impressões.`, 'error');
          }
          return false;
        }
        return this.printerService.print(title, content, options?.profile, options?.copies);
      },

      notify: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        if (!this.checkPermission(appId, 'notifications')) {
          console.warn(`[Permission Engine] App '${appId}' tentou emitir notificação sem permissão.`);
          return;
        }
        if (this.onNotification) {
          this.onNotification(title, message, type);
        } else {
          console.log(`[OS Notification] [${type.toUpperCase()}] ${title}: ${message}`);
        }
      },

      openApp: (targetAppId: string, title?: string) => {
        if (this.onOpenAppRequest) {
          this.onOpenAppRequest(targetAppId, title);
        }
      }
    };
  }

  updateInstanceState(appId: string, state: AppLifecycleState): void {
    this.runningInstances.update(map => {
      const updated = new Map(map);
      const existing = updated.get(appId);
      const now = new Date();
      if (state === 'destroyed') {
        updated.delete(appId);
      } else {
        updated.set(appId, {
          appId,
          state,
          startedAt: existing ? existing.startedAt : now,
          lastActiveAt: now
        });
      }
      return updated;
    });

    if (state === 'destroyed') {
      this.processManager.unregisterAppProcess(appId);
    } else if (state === 'paused') {
      // Execução contínua em background com monitoramento de taxa de CPU
      this.processManager.setAppBackgroundState(appId, true);
    } else if (state === 'active') {
      this.processManager.setAppBackgroundState(appId, false);
    }

    this.eventBus.publish('os.app.lifecycle', { appId, state });
  }

  getRunningApps(): RunningAppInstance[] {
    return Array.from(this.runningInstances().values());
  }

  getAppState(appId: string): AppLifecycleState {
    return this.runningInstances().get(appId)?.state || 'unmounted';
  }
}

