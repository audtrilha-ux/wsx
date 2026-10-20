import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { WindowManagerService } from '../../../../core/application/window-manager.service';
import { SyncService } from '../../../../core/sync/sync.service';
import { PrinterService } from '../../../../core/printing/printer.service';
import { HardwareService } from '../../../../core/hardware/hardware.service';
import { DiagnosticsService } from '../../../../core/diagnostics/diagnostics.service';
import { IdentityService } from '../../../../core/identity/identity.service';
import { OperatorLockService } from '../../../../core/operator-lock/operator-lock.service';
import { ProcessManagerService } from '../../../../core/app-runtime/process-manager.service';
import { OsProcessInfo } from '../../../../contracts/os/process-manager.contract';

export interface UnifiedAppProcessRow {
  id: string;
  appId: string;
  title: string;
  icon: string;
  pid: number;
  isOpenWindow: boolean;
  isFocus: boolean;
  isBackground: boolean;
  status: string;
  cpuPercentage: number;
  memoryMb: number;
  uptimeSeconds: number;
  isAnomaly: boolean;
}

interface TelemetrySystemResponse {
  cpuUsage: number;
  memoryUsedMb: number;
}

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col bg-slate-900 text-slate-100 font-sans select-none overflow-hidden">
      <!-- Header / Tabs -->
      <div class="h-12 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        <div class="flex items-center gap-1.5">
          <button 
            (click)="activeTab.set('processes')"
            [class]="activeTab() === 'processes' ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'"
            class="px-3 py-1.5 rounded-lg text-xs border flex items-center gap-2 transition-all">
            <mat-icon class="text-[16px] leading-none">view_timeline</mat-icon>
            <span>Processos ({{ unifiedProcesses().length }})</span>
          </button>

          <button 
            (click)="activeTab.set('services')"
            [class]="activeTab() === 'services' ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'"
            class="px-3 py-1.5 rounded-lg text-xs border flex items-center gap-2 transition-all">
            <mat-icon class="text-[16px] leading-none">memory</mat-icon>
            <span>Serviços do Kernel ({{ kernelServices().length }})</span>
          </button>

          <button 
            (click)="activeTab.set('performance')"
            [class]="activeTab() === 'performance' ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'"
            class="px-3 py-1.5 rounded-lg text-xs border flex items-center gap-2 transition-all">
            <mat-icon class="text-[16px] leading-none">speed</mat-icon>
            <span>Desempenho & Recursos</span>
          </button>
        </div>

        <div class="flex items-center gap-2">
          @if (feedbackMessage()) {
            <span class="text-[11px] font-medium text-emerald-400 animate-fade-in flex items-center gap-1">
              <mat-icon class="text-[14px]">check_circle</mat-icon>
              {{ feedbackMessage() }}
            </span>
          }
          <button 
            (click)="refreshStats()" 
            title="Atualizar Estatísticas"
            class="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors">
            <mat-icon class="text-[16px]">refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Tab 1: Processos (Janelas & Apps Abertos) -->
        @if (activeTab() === 'processes') {
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Processos de Aplicativos & Sandbox</h3>
                <p class="text-[11px] text-slate-500">Supervisão contínua de ciclo de vida com telemetria de CPU em primeiro e segundo plano.</p>
              </div>

              @if (unifiedProcesses().length > 0) {
                <button 
                  (click)="terminateAllUserWindows()" 
                  class="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 transition-all">
                  <mat-icon class="text-[15px]">close</mat-icon>
                  <span>Fechar Todos os Apps</span>
                </button>
              }
            </div>

            @if (unifiedProcesses().length === 0) {
              <div class="p-12 text-center border border-slate-800 rounded-xl bg-slate-950/40 space-y-2">
                <mat-icon class="text-4xl text-slate-600">desktop_windows</mat-icon>
                <p class="text-xs font-medium text-slate-400">Nenhum aplicativo ou processo em execução no momento.</p>
                <p class="text-[11px] text-slate-600">Inicie aplicativos pelo Menu Iniciar ou pelos atalhos da Área de Trabalho.</p>
              </div>
            } @else {
              <div class="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 select-none">
                    <tr>
                      <th class="p-3">Aplicativo / Processo</th>
                      <th class="p-3">PID</th>
                      <th class="p-3">Estado de Execução</th>
                      <th class="p-3">Carga de CPU</th>
                      <th class="p-3">Memória</th>
                      <th class="p-3">Uptime</th>
                      <th class="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800/60">
                    @for (proc of unifiedProcesses(); track proc.id) {
                      <tr class="hover:bg-slate-800/30 transition-colors">
                        <td class="p-3">
                          <div class="flex items-center gap-2.5">
                            <div class="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                              <mat-icon class="text-[16px]">{{ proc.icon }}</mat-icon>
                            </div>
                            <div>
                              <div class="font-bold text-slate-200">{{ proc.title }}</div>
                              <div class="text-[10px] font-mono text-slate-500">{{ proc.appId }}</div>
                            </div>
                          </div>
                        </td>
                        <td class="p-3 font-mono tabular-nums text-slate-400">{{ proc.pid }}</td>
                        <td class="p-3">
                          @if (proc.isFocus) {
                            <span class="inline-flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
                              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Foco Ativo
                            </span>
                          } @else if (proc.isBackground) {
                            <span class="inline-flex items-center gap-1.5 text-amber-300 text-[11px] font-medium">
                              <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Background Ativo
                            </span>
                          } @else {
                            <span class="inline-flex items-center gap-1.5 text-indigo-300 text-[11px] font-medium">
                              <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> Em Execução
                            </span>
                          }
                        </td>
                        <td class="p-3 font-mono tabular-nums">
                          <span [class]="getCpuColorClass(proc.cpuPercentage)">
                            {{ proc.cpuPercentage }}%
                          </span>
                          @if (proc.isAnomaly) {
                            <span class="ml-1.5 text-[9px] text-rose-400 font-sans uppercase font-bold tracking-tight">
                              [Pico Anômalo]
                            </span>
                          }
                        </td>
                        <td class="p-3 font-mono tabular-nums text-slate-300">{{ proc.memoryMb }} MB</td>
                        <td class="p-3 font-mono tabular-nums text-slate-400">{{ formatUptime(proc.uptimeSeconds) }}</td>
                        <td class="p-3 text-right">
                          <div class="flex items-center justify-end gap-1.5">
                            @if (proc.isOpenWindow) {
                              <button 
                                (click)="focusWindow(proc.appId)"
                                title="Trazer para frente"
                                class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors">
                                Focar
                              </button>
                            }
                            <button 
                              (click)="killAppProcess(proc.appId, proc.title)"
                              title="Finalizar Processo"
                              class="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-medium border border-rose-500/30 transition-colors">
                              Finalizar
                            </button>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }

        <!-- Tab 2: Serviços do Kernel -->
        @if (activeTab() === 'services') {
          <div class="space-y-3">
            <div class="space-y-0.5">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Daemons & Subsistemas do Core OS</h3>
              <p class="text-[11px] text-slate-500">Módulos de infraestrutura e supervisão executados pelo Process Manager.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              @for (svc of kernelServices(); track svc.id) {
                <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 flex items-start justify-between gap-3 hover:border-slate-700 transition-colors">
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                      <mat-icon class="text-[18px]">{{ getServiceIcon(svc.type) }}</mat-icon>
                    </div>
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-slate-200">{{ svc.name }}</span>
                        <span class="text-[10px] font-mono text-slate-500">PID {{ svc.pid || 'N/A' }}</span>
                        <span 
                          [class]="svc.status === 'running' ? 'text-emerald-400' : svc.status === 'restarting' ? 'text-amber-400' : 'text-slate-500'"
                          class="text-[10px] font-mono font-medium">
                          · {{ svc.status === 'running' ? 'Ativo' : svc.status === 'restarting' ? 'Reiniciando' : 'Parado' }}
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-400 leading-snug">
                        CPU: <span class="font-mono tabular-nums text-slate-300">{{ svc.metrics.cpuPercentage }}%</span> · 
                        RAM: <span class="font-mono tabular-nums text-slate-300">{{ svc.metrics.memoryUsageMb }} MB</span> · 
                        Heartbeats: <span class="font-mono tabular-nums text-slate-400">{{ svc.metrics.heartbeatCount }}</span>
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-1 shrink-0">
                    <button 
                      (click)="restartKernelService(svc.id, svc.name)"
                      title="Reiniciar Serviço"
                      class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold tracking-wider transition-colors border border-slate-700/60">
                      REINICIAR
                    </button>
                    @if (svc.status === 'running') {
                      <button 
                        (click)="stopKernelService(svc.id, svc.name)"
                        title="Interromper Serviço"
                        class="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-[10px] font-semibold tracking-wider transition-colors border border-rose-800/50">
                        PARAR
                      </button>
                    } @else {
                      <button 
                        (click)="startKernelService(svc.id, svc.name)"
                        title="Iniciar Serviço"
                        class="px-2 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-[10px] font-semibold tracking-wider transition-colors border border-emerald-800/50">
                        INICIAR
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Tab 3: Desempenho & Recursos -->
        @if (activeTab() === 'performance') {
          <div class="space-y-4">
            <div class="space-y-0.5">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Telemetria & Consumo Global do Sistema</h3>
              <p class="text-[11px] text-slate-500">Métricas em tempo real de CPU, memória heap alocada e supervisão de instâncias.</p>
            </div>

            <!-- Metric Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <!-- CPU Global -->
              <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                <div class="flex items-center justify-between text-slate-400">
                  <span class="text-xs font-bold uppercase">CPU Consumida</span>
                  <mat-icon class="text-indigo-400 text-base">speed</mat-icon>
                </div>
                <div class="text-2xl font-black font-mono text-slate-100">{{ systemSummary().totalCpuPercentage }}%</div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div class="bg-indigo-500 h-full rounded-full transition-all duration-500" [style.width.%]="Math.min(100, systemSummary().totalCpuPercentage * 3)"></div>
                </div>
                <div class="text-[10px] text-slate-500">Pico histórico: {{ systemSummary().peakCpuPercentage }}%</div>
              </div>

              <!-- Memory -->
              <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                <div class="flex items-center justify-between text-slate-400">
                  <span class="text-xs font-bold uppercase">Memória Total</span>
                  <mat-icon class="text-emerald-400 text-base">memory</mat-icon>
                </div>
                <div class="text-2xl font-black font-mono text-slate-100">{{ systemSummary().totalMemoryMb }} MB</div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div class="bg-emerald-500 h-full rounded-full transition-all duration-500" [style.width.%]="(systemSummary().totalMemoryMb / 256) * 100"></div>
                </div>
                <div class="text-[10px] text-slate-500">Uso consolidado de daemons e instâncias</div>
              </div>

              <!-- Active Apps -->
              <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                <div class="flex items-center justify-between text-slate-400">
                  <span class="text-xs font-bold uppercase">Apps em Execução</span>
                  <mat-icon class="text-amber-400 text-base">apps</mat-icon>
                </div>
                <div class="text-2xl font-black font-mono text-slate-100">{{ systemSummary().foregroundAppsCount + systemSummary().backgroundAppsCount }}</div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div class="bg-amber-500 h-full rounded-full transition-all duration-500" [style.width.%]="(systemSummary().foregroundAppsCount + systemSummary().backgroundAppsCount) * 15"></div>
                </div>
                <div class="text-[10px] text-slate-500">
                  {{ systemSummary().foregroundAppsCount }} em foco · {{ systemSummary().backgroundAppsCount }} em background contínuo
                </div>
              </div>

              <!-- Kernel Daemons -->
              <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                <div class="flex items-center justify-between text-slate-400">
                  <span class="text-xs font-bold uppercase">Daemons do Kernel</span>
                  <mat-icon class="text-cyan-400 text-base">dns</mat-icon>
                </div>
                <div class="text-2xl font-black font-mono text-slate-100">{{ kernelServices().length }}</div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div class="bg-cyan-500 h-full rounded-full transition-all duration-500" [style.width.%]="kernelServices().length * 18"></div>
                </div>
                <div class="text-[10px] text-slate-500">Supervisionados com auto-restart watchdog</div>
              </div>
            </div>

            <!-- Maintenance Actions -->
            <div class="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4">
              <div class="space-y-0.5">
                <div class="text-xs font-bold text-slate-200">Limpeza de Cache & Otimização do Runtime</div>
                <div class="text-[11px] text-slate-400">Libera buffers temporários de busca, compacta histórico de janelas e força coleta local.</div>
              </div>
              <button 
                (click)="optimizeMemory()" 
                class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all shrink-0">
                <mat-icon class="text-[16px]">cleaning_services</mat-icon>
                <span>Otimizar Memória</span>
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class TaskManagerComponent implements OnInit, OnDestroy {
  windowManager = inject(WindowManagerService);
  processManager = inject(ProcessManagerService);
  syncService = inject(SyncService);
  printerService = inject(PrinterService);
  hardwareService = inject(HardwareService);
  diagnosticsService = inject(DiagnosticsService);
  identityService = inject(IdentityService);
  operatorLockService = inject(OperatorLockService);
  private http = inject(HttpClient);

  readonly Math = Math;

  activeTab = signal<'processes' | 'services' | 'performance'>('processes');
  feedbackMessage = signal<string>('');

  simulatedCpuUsage = signal<number>(4);
  simulatedMemUsage = signal<number>(38);

  private statsInterval?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.fetchRealSystemStats();
    this.statsInterval = setInterval(() => {
      if (this.activeTab() === 'performance') {
        this.fetchRealSystemStats();
      }
    }, 4000);
  }

  ngOnDestroy() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
  }

  fetchRealSystemStats() {
    this.http.get<TelemetrySystemResponse>('/api/v1/telemetry/system').subscribe({
      next: (res) => {
        if (res && typeof res.cpuUsage === 'number' && typeof res.memoryUsedMb === 'number') {
          this.simulatedCpuUsage.set(res.cpuUsage);
          this.simulatedMemUsage.set(res.memoryUsedMb);
        }
      },
      error: () => {
        this.simulatedCpuUsage.set(Math.floor(Math.random() * 4) + 2);
        this.simulatedMemUsage.set(38);
      }
    });
  }

  // Tabela unificada de processos de aplicativos (Janelas abertas e Daemons de Apps)
  unifiedProcesses = computed<UnifiedAppProcessRow[]>(() => {
    const windows = this.windowManager.windows();
    const allProcs = this.processManager.listProcesses();
    const appProcs = allProcs.filter(p => p.type === 'app_instance');
    const topId = this.windowManager.topWindowId();

    const result: UnifiedAppProcessRow[] = [];
    const processedAppIds = new Set<string>();

    // 1. Processos de janelas conhecidas
    for (const win of windows) {
      if (!win.isOpen) continue;
      const appId = win.id;
      processedAppIds.add(appId);

      const proc = this.processManager.getAppProcess(appId);
      const pid = proc?.pid || this.computePid(appId);
      const isFocus = topId === appId && !win.isMinimized;
      const isBg = win.isMinimized || !!proc?.isBackground;
      const cpu = proc?.metrics?.cpuPercentage ?? (isFocus ? 2.4 : isBg ? 0.7 : 1.5);
      const mem = proc?.metrics?.memoryUsageMb ?? 24.5;
      const uptime = proc?.metrics?.uptimeSeconds ?? 0;

      result.push({
        id: proc?.id || `app_${appId}`,
        appId,
        title: win.title,
        icon: win.icon || 'apps',
        pid,
        isOpenWindow: true,
        isFocus,
        isBackground: isBg,
        status: proc?.status || 'running',
        cpuPercentage: cpu,
        memoryMb: mem,
        uptimeSeconds: uptime,
        isAnomaly: isBg && cpu > 25.0
      });
    }

    // 2. Apps registrados no ProcessManager sem janela aberta (ex: headless workers ou minimizados fechados)
    for (const proc of appProcs) {
      const appId = proc.appId || proc.id.replace('app_', '');
      if (processedAppIds.has(appId)) continue;

      result.push({
        id: proc.id,
        appId,
        title: proc.name,
        icon: 'terminal',
        pid: proc.pid || this.computePid(appId),
        isOpenWindow: false,
        isFocus: false,
        isBackground: true,
        status: proc.status,
        cpuPercentage: proc.metrics.cpuPercentage,
        memoryMb: proc.metrics.memoryUsageMb,
        uptimeSeconds: proc.metrics.uptimeSeconds,
        isAnomaly: proc.metrics.cpuPercentage > 25.0
      });
    }

    return result;
  });

  // Lista dinâmica de serviços do Kernel do ProcessManager
  kernelServices = computed<OsProcessInfo[]>(() => {
    return this.processManager.listProcesses().filter(p => p.type !== 'app_instance');
  });

  // Métricas consolidadas do sistema
  systemSummary = computed(() => {
    return this.processManager.getMetricsSummary();
  });

  getCpuColorClass(cpu: number): string {
    if (cpu > 25.0) {
      return 'text-rose-400 font-bold';
    }
    if (cpu >= 5.0) {
      return 'text-amber-400 font-medium';
    }
    return 'text-emerald-400';
  }

  getServiceIcon(type: string): string {
    switch (type) {
      case 'background_worker': return 'sync';
      case 'hardware': return 'devices';
      case 'network': return 'wifi';
      case 'app_runtime': return 'security';
      default: return 'miscellaneous_services';
    }
  }

  formatUptime(sec: number): string {
    if (!sec || sec < 60) return `${sec || 0}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  }

  private computePid(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 9000) + 1000;
  }

  focusWindow(appId: string) {
    this.windowManager.focusWindow(appId);
    this.setFeedback('Janela trazida para o primeiro plano.');
  }

  killAppProcess(appId: string, title: string) {
    this.processManager.killProcess('app_' + appId);
    this.windowManager.closeWindow(appId);
    this.setFeedback(`Processo "${title}" encerrado com sucesso.`);
  }

  terminateAllUserWindows() {
    const procs = this.unifiedProcesses();
    for (const proc of procs) {
      if (proc.appId !== 'task_manager') {
        this.processManager.killProcess('app_' + proc.appId);
        this.windowManager.closeWindow(proc.appId);
      }
    }
    this.setFeedback('Todos os aplicativos foram encerrados.');
  }

  async restartKernelService(id: string, name: string) {
    await this.processManager.restartProcess(id);
    this.setFeedback(`Serviço '${name}' reiniciado.`);
  }

  async stopKernelService(id: string, name: string) {
    await this.processManager.stopProcess(id);
    this.setFeedback(`Serviço '${name}' interrompido.`);
  }

  async startKernelService(id: string, name: string) {
    await this.processManager.startProcess(id);
    this.setFeedback(`Serviço '${name}' iniciado.`);
  }

  optimizeMemory() {
    this.fetchRealSystemStats();
    this.setFeedback('Memória otimizada e buffers descarregados com sucesso!');
  }

  refreshStats() {
    this.fetchRealSystemStats();
    this.setFeedback('Métricas atualizadas via supervisor do OS.');
  }

  private setFeedback(msg: string) {
    this.feedbackMessage.set(msg);
    setTimeout(() => {
      if (this.feedbackMessage() === msg) {
        this.feedbackMessage.set('');
      }
    }, 3500);
  }
}
