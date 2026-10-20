import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { OsProcessInfo, ProcessMetrics, ProcessMetricsSummary, ServiceType, IProcessSupervisor } from '../../contracts/os/process-manager.contract';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { OsEventBusService } from '../events/event-bus.service';

@Injectable({
  providedIn: 'root'
})
export class ProcessManagerService implements IProcessSupervisor, OnDestroy {
  private diagnostics = inject(DiagnosticsService);
  private eventBus = inject(OsEventBusService);

  private readonly processes = signal<Map<string, OsProcessInfo>>(new Map());
  readonly processesSignal = this.processes.asReadonly();

  private nextPid = 1001;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private metricsTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.registerDefaultSystemServices();
    this.startWatchdogLoop();
    this.startMetricsCollector();
  }

  ngOnDestroy(): void {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
  }

  private registerDefaultSystemServices(): void {
    const now = new Date();
    const defaults: OsProcessInfo[] = [
      {
        id: 'srv_outbox_sync',
        name: 'Outbox Sync Worker',
        type: 'background_worker',
        status: 'running',
        autoRestart: true,
        maxRestarts: 5,
        restartCount: 0,
        pid: 101,
        isBackground: true,
        startedAt: now,
        metrics: { cpuPercentage: 0.8, memoryUsageMb: 14.2, uptimeSeconds: 0, heartbeatCount: 1, lastHeartbeat: now, peakCpuPercentage: 0.8 }
      },
      {
        id: 'srv_print_spooler',
        name: 'ESC/POS Print Spooler',
        type: 'hardware',
        status: 'running',
        autoRestart: true,
        maxRestarts: 5,
        restartCount: 0,
        pid: 102,
        isBackground: true,
        startedAt: now,
        metrics: { cpuPercentage: 0.2, memoryUsageMb: 8.5, uptimeSeconds: 0, heartbeatCount: 1, lastHeartbeat: now, peakCpuPercentage: 0.2 }
      },
      {
        id: 'srv_p2p_discovery',
        name: 'P2P LAN Peer Discovery',
        type: 'network',
        status: 'running',
        autoRestart: true,
        maxRestarts: 5,
        restartCount: 0,
        pid: 103,
        isBackground: true,
        startedAt: now,
        metrics: { cpuPercentage: 1.1, memoryUsageMb: 11.0, uptimeSeconds: 0, heartbeatCount: 1, lastHeartbeat: now, peakCpuPercentage: 1.1 }
      },
      {
        id: 'srv_app_supervisor',
        name: 'App Instance Runtime Supervisor',
        type: 'app_runtime',
        status: 'running',
        autoRestart: true,
        maxRestarts: 10,
        restartCount: 0,
        pid: 104,
        isBackground: true,
        startedAt: now,
        metrics: { cpuPercentage: 0.5, memoryUsageMb: 18.4, uptimeSeconds: 0, heartbeatCount: 1, lastHeartbeat: now, peakCpuPercentage: 0.5 }
      },
      {
        id: 'srv_hardware_monitor',
        name: 'Hardware & Peripherals Monitor',
        type: 'hardware',
        status: 'running',
        autoRestart: true,
        maxRestarts: 5,
        restartCount: 0,
        pid: 105,
        isBackground: true,
        startedAt: now,
        metrics: { cpuPercentage: 0.3, memoryUsageMb: 9.1, uptimeSeconds: 0, heartbeatCount: 1, lastHeartbeat: now, peakCpuPercentage: 0.3 }
      }
    ];

    const map = new Map<string, OsProcessInfo>();
    defaults.forEach(p => map.set(p.id, p));
    this.processes.set(map);
  }

  listProcesses(): OsProcessInfo[] {
    return Array.from(this.processes().values());
  }

  registerService(id: string, name: string, type: ServiceType, autoRestart = true): void {
    const now = new Date();
    const info: OsProcessInfo = {
      id,
      name,
      type,
      status: 'running',
      autoRestart,
      maxRestarts: 5,
      restartCount: 0,
      startedAt: now,
      metrics: { cpuPercentage: 0.1, memoryUsageMb: 5.0, uptimeSeconds: 0, heartbeatCount: 1, lastHeartbeat: now }
    };

    this.processes.update(map => {
      const updated = new Map(map);
      updated.set(id, info);
      return updated;
    });

    this.diagnostics.info(`[ProcessManager] Serviço '${name}' registrado com sucesso.`);
  }

  registerAppProcess(appId: string, name: string, isBackground = false): OsProcessInfo {
    const existing = this.getAppProcess(appId);
    if (existing) {
      if (existing.isBackground !== isBackground) {
        this.setAppBackgroundState(appId, isBackground);
      }
      return existing;
    }

    const now = new Date();
    const pid = this.nextPid++;
    const processId = `app_${appId}`;
    const initialCpu = isBackground ? 0.6 : 1.8;

    const info: OsProcessInfo = {
      id: processId,
      name,
      type: 'app_instance',
      status: 'running',
      autoRestart: false,
      maxRestarts: 3,
      restartCount: 0,
      startedAt: now,
      pid,
      appId,
      isBackground,
      metrics: {
        cpuPercentage: initialCpu,
        memoryUsageMb: Number((22.4 + (pid % 10) * 1.5).toFixed(1)),
        uptimeSeconds: 0,
        heartbeatCount: 1,
        lastHeartbeat: now,
        peakCpuPercentage: initialCpu
      }
    };

    this.processes.update(map => {
      const updated = new Map(map);
      updated.set(processId, info);
      return updated;
    });

    this.diagnostics.info(`[ProcessManager] Aplicativo '${name}' (PID ${pid}) registrado em execução ${isBackground ? 'em background' : 'em primeiro plano'}.`);
    this.eventBus.publish('os.process.started', { processId, appId, pid, name, isBackground });
    return info;
  }

  unregisterAppProcess(appId: string): void {
    const processId = `app_${appId}`;
    const proc = this.processes().get(processId) || Array.from(this.processes().values()).find(p => p.appId === appId);
    if (!proc) return;

    this.processes.update(map => {
      const updated = new Map(map);
      updated.delete(proc.id);
      return updated;
    });

    this.diagnostics.info(`[ProcessManager] Processo '${proc.name}' (PID ${proc.pid || 'N/A'}) desregistrado.`);
    this.eventBus.publish('os.process.terminated', { processId: proc.id, appId: proc.appId, pid: proc.pid });
  }

  setAppBackgroundState(appId: string, isBackground: boolean): void {
    const proc = this.getAppProcess(appId);
    if (!proc) return;

    const currentMetrics = proc.metrics;
    const newCpu = isBackground 
      ? Math.max(0.2, Number((currentMetrics.cpuPercentage * 0.45).toFixed(1)))
      : Math.max(1.2, Number((currentMetrics.cpuPercentage * 1.8).toFixed(1)));

    this.updateProcessState(proc.id, {
      isBackground,
      status: 'running', // Conforme especificação: execução contínua em background
      metrics: {
        ...currentMetrics,
        cpuPercentage: newCpu,
        peakCpuPercentage: Math.max(currentMetrics.peakCpuPercentage || newCpu, newCpu)
      }
    });

    this.diagnostics.info(`[ProcessManager] Processo '${proc.name}' alternado para ${isBackground ? 'background contínuo' : 'primeiro plano'} (CPU: ${newCpu}%).`);
    this.eventBus.publish('os.process.state_changed', { processId: proc.id, appId, isBackground, cpuPercentage: newCpu });
  }

  getAppProcess(appId: string): OsProcessInfo | undefined {
    const direct = this.processes().get(`app_${appId}`);
    if (direct) return direct;
    return Array.from(this.processes().values()).find(p => p.appId === appId);
  }

  async killProcess(id: string): Promise<boolean> {
    const proc = this.processes().get(id);
    if (!proc) return false;

    this.diagnostics.warn(`[ProcessManager] Forçando encerramento de '${proc.name}' (PID ${proc.pid || 'N/A'})...`);
    this.updateProcessState(id, { status: 'stopped' });
    this.eventBus.publish('os.process.killed', { processId: id, appId: proc.appId, pid: proc.pid });

    if (proc.type === 'app_instance') {
      this.unregisterAppProcess(proc.appId || id);
    }
    return true;
  }

  async startProcess(id: string): Promise<boolean> {
    const proc = this.processes().get(id);
    if (!proc) return false;

    this.updateProcessState(id, {
      status: 'running',
      startedAt: new Date(),
      metrics: {
        ...proc.metrics,
        lastHeartbeat: new Date()
      }
    });

    this.diagnostics.info(`[ProcessManager] Processo '${proc.name}' iniciado.`);
    return true;
  }

  async stopProcess(id: string): Promise<boolean> {
    const proc = this.processes().get(id);
    if (!proc) return false;

    this.updateProcessState(id, { status: 'stopped' });
    this.diagnostics.info(`[ProcessManager] Processo '${proc.name}' interrompido.`);
    return true;
  }

  async restartProcess(id: string): Promise<boolean> {
    const proc = this.processes().get(id);
    if (!proc) return false;

    this.updateProcessState(id, { status: 'restarting' });

    setTimeout(() => {
      this.updateProcessState(id, {
        status: 'running',
        startedAt: new Date(),
        restartCount: proc.restartCount + 1,
        metrics: {
          ...proc.metrics,
          lastHeartbeat: new Date()
        }
      });
      this.diagnostics.info(`[ProcessManager] Processo '${proc.name}' reiniciado com sucesso.`);
    }, 500);

    return true;
  }

  recordHeartbeat(id: string): void {
    const proc = this.processes().get(id);
    if (proc && proc.status === 'running') {
      const now = new Date();
      this.updateProcessState(id, {
        metrics: {
          ...proc.metrics,
          heartbeatCount: proc.metrics.heartbeatCount + 1,
          lastHeartbeat: now,
          uptimeSeconds: Math.floor((now.getTime() - proc.startedAt.getTime()) / 1000)
        }
      });
    }
  }

  handleProcessCrash(id: string, error: unknown): void {
    const proc = this.processes().get(id);
    if (!proc) return;

    const errorMsg = (error as Error)?.message || String(error);
    const newCount = proc.restartCount + 1;

    this.diagnostics.error(`[ProcessManager] Crash no serviço '${proc.name}': ${errorMsg}`);

    if (proc.autoRestart && newCount <= proc.maxRestarts) {
      this.updateProcessState(id, {
        status: 'restarting',
        restartCount: newCount,
        lastError: errorMsg
      });

      setTimeout(() => {
        this.startProcess(id);
      }, 1000);
    } else {
      this.updateProcessState(id, {
        status: 'failed',
        lastError: `Excedeu limite de ${proc.maxRestarts} reinicializações: ${errorMsg}`
      });
    }
  }

  getProcessMetrics(id: string): ProcessMetrics | null {
    return this.processes().get(id)?.metrics || null;
  }

  getMetricsSummary(): ProcessMetricsSummary {
    const list = this.listProcesses();
    let totalCpu = 0;
    let totalMemory = 0;
    let activeCount = 0;
    let backgroundCount = 0;
    let foregroundCount = 0;
    let peakCpu = 0;

    for (const proc of list) {
      if (proc.status === 'running') {
        activeCount++;
        totalCpu += proc.metrics.cpuPercentage || 0;
        totalMemory += proc.metrics.memoryUsageMb || 0;
        if (proc.type === 'app_instance') {
          if (proc.isBackground) {
            backgroundCount++;
          } else {
            foregroundCount++;
          }
        }
      }
      if (proc.metrics.peakCpuPercentage && proc.metrics.peakCpuPercentage > peakCpu) {
        peakCpu = proc.metrics.peakCpuPercentage;
      }
    }

    return {
      totalCpuPercentage: Number(totalCpu.toFixed(1)),
      totalMemoryMb: Number(totalMemory.toFixed(1)),
      activeProcessesCount: activeCount,
      backgroundAppsCount: backgroundCount,
      foregroundAppsCount: foregroundCount,
      peakCpuPercentage: Number(peakCpu.toFixed(1))
    };
  }

  private updateProcessState(id: string, patch: Partial<OsProcessInfo>): void {
    this.processes.update(map => {
      const updated = new Map(map);
      const existing = updated.get(id);
      if (existing) {
        updated.set(id, { ...existing, ...patch });
      }
      return updated;
    });
  }

  private startWatchdogLoop(): void {
    if (typeof window !== 'undefined') {
      this.watchdogTimer = setInterval(() => {
        const now = Date.now();
        this.processes().forEach((proc, id) => {
          if (proc.status === 'running') {
            const timeSinceHeartbeat = now - proc.metrics.lastHeartbeat.getTime();
            // Se sem heartbeat há mais de 45s, dispara restart automático
            if (timeSinceHeartbeat > 45000 && proc.autoRestart) {
              this.diagnostics.warn(`[Watchdog] Serviço '${proc.name}' travado (sem heartbeat há ${Math.round(timeSinceHeartbeat / 1000)}s). Reiniciando...`);
              this.restartProcess(id);
            }
          }
        });
      }, 15000);
    }
  }

  private startMetricsCollector(): void {
    if (typeof window !== 'undefined') {
      this.metricsTimer = setInterval(() => {
        this.processes().forEach((proc, id) => {
          if (proc.status === 'running') {
            const now = new Date();
            const uptime = Math.floor((now.getTime() - proc.startedAt.getTime()) / 1000);
            
            // Simulação matemática realista de carga de CPU
            let baseCpu = 0.4;
            if (proc.type === 'app_instance') {
              baseCpu = proc.isBackground ? 0.7 : 2.4;
            } else if (proc.type === 'background_worker') {
              baseCpu = 0.9;
            } else if (proc.type === 'hardware') {
              baseCpu = 0.3;
            }

            const jitter = (Math.sin(uptime) * 0.3);
            const cpu = Number(Math.max(0.1, baseCpu + jitter).toFixed(1));
            const peak = Math.max(proc.metrics.peakCpuPercentage || cpu, cpu);

            // Alerta contra consumo anômalo em background (> 25% de CPU)
            if (proc.isBackground && cpu > 25.0) {
              this.diagnostics.warn(`[ProcessManager Alert] Processo em background '${proc.name}' consumindo CPU anormal (${cpu}%).`);
            }

            this.updateProcessState(id, {
              metrics: {
                ...proc.metrics,
                cpuPercentage: cpu,
                peakCpuPercentage: peak,
                heartbeatCount: proc.metrics.heartbeatCount + 1,
                lastHeartbeat: now,
                uptimeSeconds: uptime
              }
            });
          }
        });
      }, 5000);
    }
  }
}
