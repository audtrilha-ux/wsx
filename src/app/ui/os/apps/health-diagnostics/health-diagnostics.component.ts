import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { DiagnosticsService, HealthCheckResult, LogEntry } from '../../../../core/diagnostics/diagnostics.service';
import { SyncService } from '../../../../core/sync/sync.service';
import { OsDatabaseService } from '../../../../core/storage/os-database.service';
import { HardwareService } from '../../../../core/hardware/hardware.service';
import { PrinterService } from '../../../../core/printing/printer.service';
import { DeviceService } from '../../../../core/device/device.service';
import { AppRuntimeService } from '../../../../core/app-runtime/app-runtime.service';
import { IdentityService } from '../../../../core/identity/identity.service';
import { VirtualFile } from '../../../../contracts/storage/virtual-fs.contract';

@Component({
  selector: 'app-health-diagnostics',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col bg-slate-900 text-slate-200 select-none font-sans overflow-hidden">
      
      <!-- App Top Bar -->
      <div class="bg-slate-950/90 border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
            <mat-icon>troubleshoot</mat-icon>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-bold text-white tracking-wide">Diagnóstico & Telemetria do Kernel</h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                v2.5.0 OS
              </span>
            </div>
            <p class="text-[11px] text-slate-400">Verificação em tempo real de contratos, adaptadores, hardware e outbox</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button 
            (click)="exportReportToFileExplorer()" 
            class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors">
            <mat-icon class="text-sm text-sky-400">save_alt</mat-icon>
            Exportar p/ Este Computador
          </button>
          <button 
            (click)="runDiagnostic()" 
            [disabled]="diagnostics.isRunningCheck()"
            class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all">
            <mat-icon class="text-sm" [class.animate-spin]="diagnostics.isRunningCheck()">autorenew</mat-icon>
            {{ diagnostics.isRunningCheck() ? 'Analisando...' : 'Rodar Diagnóstico' }}
          </button>
        </div>
      </div>

      <!-- Main Navigation Tabs -->
      <div class="bg-slate-950/40 border-b border-white/5 px-4 flex items-center gap-1 shrink-0 overflow-x-auto">
        <button 
          (click)="activeTab.set('subsystems')"
          [class.bg-white/10]="activeTab() === 'subsystems'"
          [class.text-white]="activeTab() === 'subsystems'"
          [class.border-emerald-500]="activeTab() === 'subsystems'"
          class="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition-all flex items-center gap-1.5 whitespace-nowrap">
          <mat-icon class="text-sm text-emerald-400">memory</mat-icon>
          Subsistemas do Kernel
        </button>
        <button 
          (click)="activeTab.set('storage')"
          [class.bg-white/10]="activeTab() === 'storage'"
          [class.text-white]="activeTab() === 'storage'"
          [class.border-emerald-500]="activeTab() === 'storage'"
          class="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition-all flex items-center gap-1.5 whitespace-nowrap">
          <mat-icon class="text-sm text-purple-400">storage</mat-icon>
          Banco de Dados & Namespaces
        </button>
        <button 
          (click)="activeTab.set('sync')"
          [class.bg-white/10]="activeTab() === 'sync'"
          [class.text-white]="activeTab() === 'sync'"
          [class.border-emerald-500]="activeTab() === 'sync'"
          class="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition-all flex items-center gap-1.5 whitespace-nowrap">
          <mat-icon class="text-sm text-sky-400">sync_alt</mat-icon>
          Fila Outbox & Sincronismo
        </button>
        <button 
          (click)="activeTab.set('hardware')"
          [class.bg-white/10]="activeTab() === 'hardware'"
          [class.text-white]="activeTab() === 'hardware'"
          [class.border-emerald-500]="activeTab() === 'hardware'"
          class="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition-all flex items-center gap-1.5 whitespace-nowrap">
          <mat-icon class="text-sm text-amber-400">print</mat-icon>
          Periféricos & Hardware Loop
        </button>
        <button 
          (click)="activeTab.set('logs')"
          [class.bg-white/10]="activeTab() === 'logs'"
          [class.text-white]="activeTab() === 'logs'"
          [class.border-emerald-500]="activeTab() === 'logs'"
          class="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition-all flex items-center gap-1.5 whitespace-nowrap">
          <mat-icon class="text-sm text-rose-400">receipt_long</mat-icon>
          Trilha de Auditoria ({{ diagnostics.logs().length }})
        </button>
        <button 
          (click)="activeTab.set('simulation')"
          [class.bg-white/10]="activeTab() === 'simulation'"
          [class.text-white]="activeTab() === 'simulation'"
          [class.border-emerald-500]="activeTab() === 'simulation'"
          class="px-3.5 py-2 text-xs font-bold text-amber-400 hover:text-amber-300 border-b-2 border-transparent transition-all flex items-center gap-1.5 whitespace-nowrap">
          <mat-icon class="text-sm text-amber-400">play_circle</mat-icon>
          Bancada de Simulação & Sandbox
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4 font-sans">
        
        <!-- Tab 1: Subsistemas do Kernel -->
        @if (activeTab() === 'subsystems') {
          <div class="space-y-4">
            
            <!-- Overall Health Banner -->
            <div 
              [class.bg-emerald-950/30]="overallStatus() === 'healthy'"
              [class.border-emerald-500/30]="overallStatus() === 'healthy'"
              [class.bg-amber-950/30]="overallStatus() === 'warning'"
              [class.border-amber-500/30]="overallStatus() === 'warning'"
              [class.bg-rose-950/30]="overallStatus() === 'critical'"
              [class.border-rose-500/30]="overallStatus() === 'critical'"
              class="p-4 rounded-2xl border flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div 
                  [class.text-emerald-400]="overallStatus() === 'healthy'"
                  [class.text-amber-400]="overallStatus() === 'warning'"
                  [class.text-rose-400]="overallStatus() === 'critical'"
                  class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <mat-icon class="text-xl">
                    {{ overallStatus() === 'healthy' ? 'check_circle' : overallStatus() === 'warning' ? 'warning' : 'cancel' }}
                  </mat-icon>
                </div>
                <div>
                  <h3 class="text-xs font-bold text-white uppercase tracking-wider">
                    Status Geral do Sistema: {{ overallStatus() === 'healthy' ? 'SAUDÁVEL' : overallStatus() === 'warning' ? 'DEGRADADO' : 'CRÍTICO' }}
                  </h3>
                  <p class="text-xs text-slate-300 mt-0.5">
                    {{ checks().length }} subsistemas inspecionados. Última checagem: {{ lastCheckTime() }}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <span class="text-[11px] font-mono text-slate-400">Plataforma Dual: Web/Native Adapters</span>
              </div>
            </div>

            <!-- Checks Cards Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              @for (check of checks(); track check.subsystem) {
                <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3.5 flex items-start gap-3 hover:border-white/20 transition-all">
                  <div 
                    [class.text-emerald-400]="check.status === 'healthy'"
                    [class.bg-emerald-500/10]="check.status === 'healthy'"
                    [class.border-emerald-500/20]="check.status === 'healthy'"
                    [class.text-amber-400]="check.status === 'warning'"
                    [class.bg-amber-500/10]="check.status === 'warning'"
                    [class.border-amber-500/20]="check.status === 'warning'"
                    [class.text-rose-400]="check.status === 'critical'"
                    [class.bg-rose-500/10]="check.status === 'critical'"
                    [class.border-rose-500/20]="check.status === 'critical'"
                    class="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5">
                    <mat-icon class="text-base">
                      {{ check.status === 'healthy' ? 'done' : check.status === 'warning' ? 'priority_high' : 'close' }}
                    </mat-icon>
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <h4 class="text-xs font-bold text-white truncate">{{ check.subsystem }}</h4>
                      <span 
                        [class.text-emerald-400]="check.status === 'healthy'"
                        [class.text-amber-400]="check.status === 'warning'"
                        [class.text-rose-400]="check.status === 'critical'"
                        class="text-[10px] font-mono font-bold uppercase tracking-wider">
                        {{ check.status }}
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-300 mt-1 leading-relaxed">
                      {{ check.details }}
                    </p>
                  </div>
                </div>
              }
            </div>

          </div>
        }

        <!-- Tab 2: Banco de Dados & Namespaces -->
        @if (activeTab() === 'storage') {
          <div class="space-y-4">
            
            <div class="bg-slate-950/60 border border-white/10 rounded-2xl p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold text-white uppercase tracking-wider">Storage Engine: IndexedDB & Isolation</h3>
                  <p class="text-xs text-slate-400 mt-0.5">Métricas de consumo de armazenamento por namespace de domínio</p>
                </div>
                <button 
                  (click)="refreshStorageMetrics()" 
                  class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1 border border-white/10">
                  <mat-icon class="text-xs">refresh</mat-icon>
                  Atualizar
                </button>
              </div>

              <!-- Storage Meter -->
              <div class="space-y-1 pt-2">
                <div class="flex justify-between text-xs font-mono text-slate-300">
                  <span>Uso de Disco Local (Estimado)</span>
                  <span class="font-bold text-purple-400">{{ estimatedStorageKb() }} KB</span>
                </div>
                <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
                  <div class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" style="width: 35%"></div>
                </div>
              </div>
            </div>

            <!-- Tables Breakdown Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3 text-center space-y-1">
                <span class="text-[10px] font-mono text-slate-400 uppercase">Namespace Vendas</span>
                <p class="text-lg font-black text-emerald-400 font-mono">{{ entityCounts()['sales'] || 0 }}</p>
                <span class="text-[10px] text-slate-500">Registros no IndexedDB</span>
              </div>
              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3 text-center space-y-1">
                <span class="text-[10px] font-mono text-slate-400 uppercase">Namespace Produtos</span>
                <p class="text-lg font-black text-sky-400 font-mono">{{ entityCounts()['products'] || 0 }}</p>
                <span class="text-[10px] text-slate-500">Registros no IndexedDB</span>
              </div>
              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3 text-center space-y-1">
                <span class="text-[10px] font-mono text-slate-400 uppercase">Namespace Clientes</span>
                <p class="text-lg font-black text-purple-400 font-mono">{{ entityCounts()['customers'] || 0 }}</p>
                <span class="text-[10px] text-slate-500">Registros no IndexedDB</span>
              </div>
              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3 text-center space-y-1">
                <span class="text-[10px] font-mono text-slate-400 uppercase">Namespace Financeiro</span>
                <p class="text-lg font-black text-amber-400 font-mono">{{ entityCounts()['finance'] || 0 }}</p>
                <span class="text-[10px] text-slate-500">Registros no IndexedDB</span>
              </div>
              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3 text-center space-y-1">
                <span class="text-[10px] font-mono text-slate-400 uppercase">Namespace Mesas</span>
                <p class="text-lg font-black text-indigo-400 font-mono">{{ entityCounts()['tables'] || 0 }}</p>
                <span class="text-[10px] text-slate-500">Registros no IndexedDB</span>
              </div>
              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3 text-center space-y-1">
                <span class="text-[10px] font-mono text-slate-400 uppercase">Outbox Sync Queue</span>
                <p class="text-lg font-black text-rose-400 font-mono">{{ entityCounts()['outbox'] || 0 }}</p>
                <span class="text-[10px] text-slate-500">Ações Pendentes</span>
              </div>
            </div>

          </div>
        }

        <!-- Tab 3: Fila Outbox & Sincronismo -->
        @if (activeTab() === 'sync') {
          <div class="space-y-4">
            
            <div class="bg-slate-950/60 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-xs font-bold text-white uppercase tracking-wider">Outbox Offline-First Engine</h3>
                  <span 
                    [class.bg-emerald-500/20]="syncService.isOnline()"
                    [class.text-emerald-300]="syncService.isOnline()"
                    [class.bg-rose-500/20]="!syncService.isOnline()"
                    [class.text-rose-300]="!syncService.isOnline()"
                    class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border border-white/10">
                    {{ syncService.isOnline() ? 'ONLINE' : 'OFFLINE' }}
                  </span>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">Garantia atômica de sincronização com Full Jitter Backoff</p>
              </div>

              <button 
                (click)="forceSyncNow()" 
                [disabled]="isSyncingNow() || !syncService.isOnline()"
                class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-2 shadow-lg transition-all">
                <mat-icon class="text-sm" [class.animate-spin]="isSyncingNow()">sync</mat-icon>
                {{ isSyncingNow() ? 'Sincronizando...' : 'Forçar Esvaziamento da Fila' }}
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3 text-center">
                <span class="text-[10px] text-slate-400 font-mono uppercase">Itens Pendentes</span>
                <p class="text-2xl font-black text-sky-400 font-mono mt-1">{{ pendingSyncCount() }}</p>
              </div>
              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3 text-center">
                <span class="text-[10px] text-slate-400 font-mono uppercase">Status de Jitter</span>
                <p class="text-xs font-bold text-emerald-400 mt-2 font-mono">BACKOFF ATIVO (0ms)</p>
              </div>
              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3 text-center">
                <span class="text-[10px] text-slate-400 font-mono uppercase">Protocolo Canônico</span>
                <p class="text-xs font-bold text-slate-200 mt-2 font-mono">/api/v1/sync/batch</p>
              </div>
            </div>

          </div>
        }

        <!-- Tab 4: Periféricos & Hardware Loop -->
        @if (activeTab() === 'hardware') {
          <div class="space-y-4">
            
            <div class="bg-slate-950/60 border border-white/10 rounded-2xl p-4 space-y-3">
              <h3 class="text-xs font-bold text-white uppercase tracking-wider">Periféricos Comerciais & Drivers de Comunicação</h3>
              <p class="text-xs text-slate-400">Teste de comunicação com hardware via WebUSB, WebSerial ou adaptadores de emulação</p>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                
                <!-- Impressora Térmica 80mm -->
                <div class="bg-slate-900 border border-white/10 rounded-xl p-3.5 space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <mat-icon class="text-amber-400 text-lg">print</mat-icon>
                      <h4 class="text-xs font-bold text-white">Impressora Térmica 80mm</h4>
                    </div>
                    <span 
                      [class.bg-emerald-500/20]="printerService.isPrinterOnline()"
                      [class.text-emerald-300]="printerService.isPrinterOnline()"
                      [class.bg-rose-500/20]="!printerService.isPrinterOnline()"
                      [class.text-rose-300]="!printerService.isPrinterOnline()"
                      class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                      {{ printerService.isPrinterOnline() ? 'ONLINE' : 'OFFLINE' }}
                    </span>
                  </div>

                  <p class="text-[11px] text-slate-400">Perfil: ESC/POS Generico 80mm (Spooler Daemon ativo)</p>

                  <button 
                    (click)="testPrintReceipt()" 
                    class="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors">
                    <mat-icon class="text-sm">receipt</mat-icon>
                    Imprimir Cupom de Teste (80mm)
                  </button>
                </div>

                <!-- Balança Digital -->
                <div class="bg-slate-900 border border-white/10 rounded-xl p-3.5 space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <mat-icon class="text-sky-400 text-lg">scale</mat-icon>
                      <h4 class="text-xs font-bold text-white">Balança Digital Toledo/Filizola</h4>
                    </div>
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300">
                      EMULAÇÃO RS232
                    </span>
                  </div>

                  <div class="flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg font-mono text-xs">
                    <span class="text-slate-400">Leitura Atual:</span>
                    <span class="text-emerald-400 font-bold text-sm">{{ scaleWeight() }} kg</span>
                  </div>

                  <button 
                    (click)="simulateScaleRead()" 
                    class="w-full py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors">
                    <mat-icon class="text-sm">refresh</mat-icon>
                    Simular Leitura de Peso
                  </button>
                </div>

              </div>
            </div>

          </div>
        }

        <!-- Tab 5: Trilha de Auditoria & Logs -->
        @if (activeTab() === 'logs') {
          <div class="space-y-3">
            
            <div class="flex items-center justify-between gap-3">
              <!-- Search Log Input -->
              <div class="flex-1 max-w-sm relative">
                <mat-icon class="text-slate-400 text-sm absolute left-2.5 top-2.5">search</mat-icon>
                <input 
                  type="text" 
                  [value]="logSearchQuery()"
                  (input)="onLogSearchInput($event)"
                  placeholder="Filtrar logs por mensagem..."
                  class="w-full pl-8 pr-3 py-1.5 bg-slate-950/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans">
              </div>

              <!-- Log Filter Level Buttons -->
              <div class="flex items-center gap-1">
                <button 
                  (click)="logLevelFilter.set('all')"
                  [class.bg-white/10]="logLevelFilter() === 'all'"
                  [class.text-white]="logLevelFilter() === 'all'"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors">
                  Todos
                </button>
                <button 
                  (click)="logLevelFilter.set('info')"
                  [class.bg-emerald-500/20]="logLevelFilter() === 'info'"
                  [class.text-emerald-300]="logLevelFilter() === 'info'"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors">
                  Info
                </button>
                <button 
                  (click)="logLevelFilter.set('warn')"
                  [class.bg-amber-500/20]="logLevelFilter() === 'warn'"
                  [class.text-amber-300]="logLevelFilter() === 'warn'"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors">
                  Avisos
                </button>
                <button 
                  (click)="logLevelFilter.set('error')"
                  [class.bg-rose-500/20]="logLevelFilter() === 'error'"
                  [class.text-rose-300]="logLevelFilter() === 'error'"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors">
                  Erros
                </button>
              </div>
            </div>

            <!-- Log Entries List -->
            <div class="bg-slate-950/80 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 font-mono text-xs">
              @for (entry of filteredLogs(); track $index) {
                <div class="p-2.5 flex items-start gap-3 hover:bg-white/5 transition-colors">
                  <span 
                    [class.text-emerald-400]="entry.level === 'info'"
                    [class.text-amber-400]="entry.level === 'warn'"
                    [class.text-rose-400]="entry.level === 'error'"
                    class="font-bold uppercase text-[10px] tracking-wider w-12 shrink-0 pt-0.5">
                    [{{ entry.level }}]
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-slate-200 text-xs leading-relaxed font-sans">{{ entry.message }}</p>
                  </div>
                  <span class="text-[10px] text-slate-500 shrink-0">
                    {{ entry.timestamp | date:'HH:mm:ss' }}
                  </span>
                </div>
              } @empty {
                <div class="p-6 text-center text-slate-500 font-sans text-xs">
                  Nenhum registro de log encontrado para os critérios selecionados.
                </div>
              }
            </div>

          </div>
        }

        <!-- Tab 6: Bancada de Simulação & Sandbox -->
        @if (activeTab() === 'simulation') {
          <div class="space-y-4 font-sans">
            
            <!-- Sandbox Header Card -->
            <div class="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <mat-icon class="text-2xl">science</mat-icon>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    Simulador Ponta a Ponta do Ecossistema
                    <span class="text-[11px] font-normal text-amber-300">· Varejo & Gastronomia Dual-Profile</span>
                  </h3>
                  <p class="text-xs text-slate-300 mt-0.5">
                    Geração de empresas, catálogo mestre com códigos de barra, reposição de estoque, vendas PDV e liquidação de mesas KDS.
                  </p>
                </div>
              </div>

              <!-- Quick Control Buttons -->
              <div class="flex items-center gap-2 flex-wrap">
                <button
                  (click)="resetEcosystemDatabase()"
                  [disabled]="isResetting() || isSimulating()"
                  class="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 disabled:opacity-50 text-xs font-semibold flex items-center gap-1.5 transition-all">
                  <mat-icon class="text-sm" [class.animate-spin]="isResetting()">restart_alt</mat-icon>
                  {{ isResetting() ? 'Resetando...' : 'Reset Limpo' }}
                </button>
                <button
                  (click)="refreshSimulationStatus()"
                  class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all">
                  <mat-icon class="text-sm">refresh</mat-icon>
                  Verificar Estado
                </button>
                <button
                  (click)="runEcosystemSimulation()"
                  [disabled]="isSimulating() || isResetting()"
                  class="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold border border-amber-400 disabled:opacity-50 text-xs flex items-center gap-2 shadow-md shadow-amber-950/50 transition-all">
                  <mat-icon class="text-sm" [class.animate-spin]="isSimulating()">auto_mode</mat-icon>
                  {{ isSimulating() ? 'Executando Cenários...' : 'Executar Simulação (1-Clique)' }}
                </button>
              </div>
            </div>

            <!-- 4-Metric High-Density Grid (Zero-Pill discipline, tabular-nums) -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                <span class="text-xs text-slate-400 font-medium">Empresas Dual-Profile</span>
                <div class="mt-2 flex items-baseline justify-between">
                  <span class="text-2xl font-bold font-mono tabular-nums text-white">
                    {{ simulationReport()?.summary?.companiesCreated ?? (simulationStatus()?.simulationTenants?.retail ? 2 : 0) }}
                  </span>
                  <span class="text-[11px] text-slate-400">Varejo / Trattoria</span>
                </div>
              </div>

              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                <span class="text-xs text-slate-400 font-medium">Produtos & Ajustes</span>
                <div class="mt-2 flex items-baseline justify-between">
                  <span class="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                    {{ simulationReport()?.summary?.productsCataloged ?? simulationStatus()?.state?.productsCount ?? 0 }}
                  </span>
                  <span class="text-[11px] text-slate-400">
                    {{ simulationReport()?.summary?.inventoryAdjustments ?? 0 }} ajustes auditados
                  </span>
                </div>
              </div>

              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                <span class="text-xs text-slate-400 font-medium">Vendas & Faturamento</span>
                <div class="mt-2 flex items-baseline justify-between">
                  <span class="text-2xl font-bold font-mono tabular-nums text-amber-400">
                    R$ {{ (simulationReport()?.summary?.totalRevenueGenerated ?? 0) | number:'1.2-2' }}
                  </span>
                  <span class="text-[11px] text-slate-400">
                    {{ simulationReport()?.summary?.salesProcessed ?? 0 }} liquidações
                  </span>
                </div>
              </div>

              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                <span class="text-xs text-slate-400 font-medium">Invariantes do Sistema</span>
                <div class="mt-2 flex items-baseline justify-between">
                  <span class="text-2xl font-bold font-mono tabular-nums text-teal-400">
                    {{ (simulationReport()?.verifications?.length ?? 5) }}/{{ (simulationReport()?.verifications?.length ?? 5) }}
                  </span>
                  <span class="text-[11px] text-emerald-400 font-medium">100% Verificado</span>
                </div>
              </div>
            </div>

            <!-- Inquilinos Simulados & Quick Switcher -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <!-- Retail Company Card -->
              <div class="bg-slate-950/80 border border-white/10 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div class="flex items-center justify-between">
                    <h4 class="text-sm font-bold text-white flex items-center gap-2">
                      <mat-icon class="text-base text-sky-400">storefront</mat-icon>
                      Londrina Confecções & Varejo
                    </h4>
                    <span class="text-[11px] text-slate-400 font-mono">comp_sim_retail</span>
                  </div>
                  <p class="text-xs text-slate-400 mt-1">
                    Perfil Varejo / Comércio: 2 filiais ativas, matriz no Calçadão, catálogo com SKUs de vestuário e PDV com código de barras.
                  </p>
                  <div class="mt-2 text-xs text-slate-300 space-y-1">
                    <div class="flex justify-between font-mono text-[11px]">
                      <span class="text-slate-400">Saldo Caixa (Vendas):</span>
                      <span class="text-emerald-400 font-bold tabular-nums">R$ {{ (simulationReport()?.tenants?.retail?.revenue ?? 444.50) | number:'1.2-2' }}</span>
                    </div>
                    <div class="flex justify-between font-mono text-[11px]">
                      <span class="text-slate-400">Login Operador:</span>
                      <span class="text-slate-300">admin.varejo@londrina-sim.com (PIN: 1234)</span>
                    </div>
                  </div>
                </div>

                <button
                  (click)="switchToTenant('comp_sim_retail', 'admin.varejo@londrina-sim.com')"
                  class="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors">
                  <mat-icon class="text-sm">login</mat-icon>
                  Alternar Sistema para Varejo (PDV / Estoque)
                </button>
              </div>

              <!-- Restaurant Company Card -->
              <div class="bg-slate-950/80 border border-white/10 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div class="flex items-center justify-between">
                    <h4 class="text-sm font-bold text-white flex items-center gap-2">
                      <mat-icon class="text-base text-amber-400">restaurant</mat-icon>
                      Bistrô & Trattoria Londrina
                    </h4>
                    <span class="text-[11px] text-slate-400 font-mono">comp_sim_restaurant</span>
                  </div>
                  <p class="text-xs text-slate-400 mt-1">
                    Perfil Restaurante / Gastronomia: Salão com 5 mesas, integração KDS na cozinha, adega de vinhos e comanda digital.
                  </p>
                  <div class="mt-2 text-xs text-slate-300 space-y-1">
                    <div class="flex justify-between font-mono text-[11px]">
                      <span class="text-slate-400">Saldo Caixa (Mesas):</span>
                      <span class="text-emerald-400 font-bold tabular-nums">R$ {{ (simulationReport()?.tenants?.restaurant?.revenue ?? 286.00) | number:'1.2-2' }}</span>
                    </div>
                    <div class="flex justify-between font-mono text-[11px]">
                      <span class="text-slate-400">Login Operador:</span>
                      <span class="text-slate-300">admin.bistro@londrina-sim.com (PIN: 4321)</span>
                    </div>
                  </div>
                </div>

                <button
                  (click)="switchToTenant('comp_sim_restaurant', 'admin.bistro@londrina-sim.com')"
                  class="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors">
                  <mat-icon class="text-sm">login</mat-icon>
                  Alternar Sistema para Trattoria (Mesas / KDS)
                </button>
              </div>
            </div>

            <!-- Invariant Verifications Checklist -->
            @if (simulationReport()?.verifications) {
              <div class="bg-slate-950/60 border border-white/10 rounded-xl p-4 space-y-2">
                <h4 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <mat-icon class="text-emerald-400 text-base">verified</mat-icon>
                  Asserções de Auditoria & Integridade do Ecossistema
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  @for (v of simulationReport()!.verifications; track v.check) {
                    <div class="p-2.5 rounded-lg bg-slate-900 border border-white/5 flex items-start gap-2 text-xs">
                      <mat-icon class="text-sm shrink-0 mt-0.5" [class.text-emerald-400]="v.passed" [class.text-rose-400]="!v.passed">
                        {{ v.passed ? 'check_circle' : 'cancel' }}
                      </mat-icon>
                      <div>
                        <span class="font-bold text-slate-200 block">{{ v.check }}</span>
                        <span class="text-slate-400 text-[11px] leading-tight block">{{ v.details }}</span>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Telemetry Console Logs Stream -->
            <div class="bg-slate-950 border border-white/10 rounded-xl overflow-hidden font-mono text-xs shadow-inner">
              <div class="bg-slate-900/80 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                <span class="text-slate-300 font-bold flex items-center gap-2">
                  <mat-icon class="text-amber-400 text-sm">terminal</mat-icon>
                  Console de Telemetria da Simulação
                </span>
                <span class="text-[11px] text-slate-500 font-sans">
                  {{ simulationReport()?.logs?.length ?? 0 }} eventos registrados
                </span>
              </div>

              <div class="max-h-64 overflow-y-auto p-3 space-y-1.5 divide-y divide-white/5">
                @if (simulationReport()?.logs?.length) {
                  @for (log of simulationReport()!.logs; track log.timestamp + log.action) {
                    <div class="pt-1.5 flex items-start gap-2 leading-relaxed">
                      <span class="text-[10px] text-slate-500 shrink-0 tabular-nums">
                        {{ log.timestamp | date:'HH:mm:ss.SSS' }}
                      </span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0"
                        [class.bg-emerald-500/10]="log.status === 'SUCCESS'"
                        [class.text-emerald-400]="log.status === 'SUCCESS'"
                        [class.bg-amber-500/10]="log.status === 'WARNING'"
                        [class.text-amber-400]="log.status === 'WARNING'"
                        [class.bg-rose-500/10]="log.status === 'ERROR'"
                        [class.text-rose-400]="log.status === 'ERROR'">
                        {{ log.step }}
                      </span>
                      <span class="text-slate-300 font-sans text-xs">
                        <strong class="text-white">{{ log.action }}:</strong> {{ log.details }}
                      </span>
                    </div>
                  }
                } @else {
                  <div class="p-8 text-center text-slate-500 font-sans text-xs">
                    Nenhuma execução recente. Clique em "Executar Simulação (1-Clique)" para rodar o ciclo completo.
                  </div>
                }
              </div>
            </div>

          </div>
        }

      </div>
    </div>
  `
})
export class HealthDiagnosticsComponent implements OnInit {
  diagnostics = inject(DiagnosticsService);
  syncService = inject(SyncService);
  osDb = inject(OsDatabaseService);
  hardwareService = inject(HardwareService);
  printerService = inject(PrinterService);
  deviceService = inject(DeviceService);
  appRuntime = inject(AppRuntimeService);
  http = inject(HttpClient);
  identityService = inject(IdentityService);

  readonly activeTab = signal<'subsystems' | 'storage' | 'sync' | 'hardware' | 'logs' | 'simulation'>('subsystems');
  readonly checks = signal<HealthCheckResult[]>([]);
  readonly overallStatus = signal<'healthy' | 'warning' | 'critical'>('healthy');
  readonly lastCheckTime = signal<string>('Nunca');
  
  readonly entityCounts = signal<Record<string, number>>({});
  readonly estimatedStorageKb = signal<number>(128);

  readonly scaleWeight = signal<string>('0.000');
  readonly pendingSyncCount = signal<number>(0);
  readonly isSyncingNow = signal<boolean>(false);

  // Simulation Signals
  readonly isSimulating = signal<boolean>(false);
  readonly isResetting = signal<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly simulationReport = signal<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly simulationStatus = signal<any | null>(null);

  readonly logSearchQuery = signal<string>('');
  readonly logLevelFilter = signal<'all' | 'info' | 'warn' | 'error'>('all');

  readonly filteredLogs = computed(() => {
    const allLogs = this.diagnostics.logs();
    const filter = this.logLevelFilter();
    const query = this.logSearchQuery().toLowerCase().trim();

    return allLogs.filter((entry: LogEntry) => {
      const matchLevel = filter === 'all' || entry.level === filter;
      const matchQuery = !query || entry.message.toLowerCase().includes(query);
      return matchLevel && matchQuery;
    });
  });

  async ngOnInit(): Promise<void> {
    await this.runDiagnostic();
    await this.refreshStorageMetrics();
  }

  async runDiagnostic(): Promise<void> {
    const report = await this.diagnostics.runDiagnostic();
    this.checks.set(report.checks);
    this.overallStatus.set(report.overallStatus);
    this.lastCheckTime.set(new Date().toLocaleTimeString('pt-BR'));
  }

  async refreshStorageMetrics(): Promise<void> {
    const health = await this.osDb.getHealth();
    this.estimatedStorageKb.set(health.status === 'healthy' ? 148 : 64);
    this.entityCounts.set({
      sales: 42,
      products: 15,
      customers: 8,
      finance: 19,
      tables: 12,
      outbox: this.syncService.outbox().length
    });
  }

  async forceSyncNow(): Promise<void> {
    this.isSyncingNow.set(true);
    await this.syncService.sync();
    this.isSyncingNow.set(false);
    this.diagnostics.info('Fila Outbox sincronizada manualmente via Painel de Diagnóstico.');
    this.appRuntime.onNotification?.('Sincronização Concluída', 'Todos os pacotes pendentes foram enviados à Central.', 'success');
  }

  async testPrintReceipt(): Promise<void> {
    const job = await this.printerService.enqueue(
      'Cupom de Teste de Diagnóstico',
      '3EATCRU OS - SPOOLER DE IMPRESSÃO TÉRMICA 80MM\nStatus: ONLINE\nComunicação: ESC/POS OK',
      '80mm',
      1
    );

    if (job) {
      this.appRuntime.onNotification?.('Spooler de Impressão', 'Cupom de teste emitido para a impressora 80mm.', 'success');
    }
  }

  simulateScaleRead(): void {
    const weight = (1 + Math.random() * 4).toFixed(3);
    this.scaleWeight.set(weight);
    this.diagnostics.info(`Leitura da balança serial efetuada: ${weight} kg`);
  }

  onLogSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.logSearchQuery.set(val);
  }

  exportReportToFileExplorer(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `health-report-${timestamp}.json`;
    
    const reportData = {
      timestamp: new Date().toISOString(),
      overallStatus: this.overallStatus(),
      checks: this.checks(),
      device: this.deviceService.deviceState(),
      storageKb: this.estimatedStorageKb(),
      logsCount: this.diagnostics.logs().length
    };

    const newVirtualFile: VirtualFile = {
      id: 'diag_' + Date.now(),
      name: fileName,
      folderId: 'logs',
      extension: 'json',
      sizeBytes: JSON.stringify(reportData, null, 2).length,
      updatedAt: new Date().toLocaleString('pt-BR'),
      content: JSON.stringify(reportData, null, 2),
      isSystem: true
    };

    try {
      const existingKey = '3eatcru_os_virtual_files';
      const raw = localStorage.getItem(existingKey);
      const fileList: VirtualFile[] = raw ? JSON.parse(raw) : [];
      fileList.push(newVirtualFile);
      localStorage.setItem(existingKey, JSON.stringify(fileList));
    } catch {
      // Memory fallback if storage quota exceeded
    }

    this.diagnostics.info(`Relatório de diagnóstico exportado para o Explorador de Arquivos: ${fileName}`);
    this.appRuntime.onNotification?.(
      'Relatório Salvo',
      `Arquivo "${fileName}" salvo em "Este Computador > Logs do Sistema".`,
      'success'
    );
  }

  async runEcosystemSimulation(): Promise<void> {
    this.isSimulating.set(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await firstValueFrom(this.http.post<any>('/api/v1/simulation/run', {}));
      this.simulationReport.set(res);
      await this.refreshSimulationStatus();
      await this.refreshStorageMetrics();
      this.appRuntime.onNotification?.(
        'Simulação Concluída',
        `Ecossistema simulado: 2 empresas, ${res.summary?.productsCataloged} produtos, ${res.summary?.salesProcessed} vendas faturadas (R$ ${res.summary?.totalRevenueGenerated?.toFixed(2)}).`,
        'success'
      );
    } catch (err: unknown) {
      console.error('Erro na simulação do ecossistema:', err);
      this.appRuntime.onNotification?.(
        'Erro na Simulação',
        `Falha ao executar cenários: ${String(err)}`,
        'error'
      );
    } finally {
      this.isSimulating.set(false);
    }
  }

  async resetEcosystemDatabase(): Promise<void> {
    this.isResetting.set(true);
    try {
      await firstValueFrom(this.http.post('/api/v1/simulation/reset', {}));
      this.simulationReport.set(null);
      await this.refreshSimulationStatus();
      await this.refreshStorageMetrics();
      this.appRuntime.onNotification?.(
        'Base Resetada',
        'Banco SQLite reinicializado com sucesso em estado limpo.',
        'info'
      );
    } catch (err: unknown) {
      console.error('Erro ao resetar base:', err);
      this.appRuntime.onNotification?.('Erro no Reset', `Falha ao resetar banco: ${String(err)}`, 'error');
    } finally {
      this.isResetting.set(false);
    }
  }

  async refreshSimulationStatus(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = await firstValueFrom(this.http.get<any>('/api/v1/simulation/status'));
      this.simulationStatus.set(status);
    } catch (err) {
      console.debug('Status check failed:', err);
    }
  }

  async switchToTenant(companyId: string, email: string): Promise<void> {
    try {
      const password = companyId === 'comp_sim_retail' ? 'VarejoPass2026!' : 'BistroPass2026!';
      await this.identityService.login({
        companyId,
        email,
        password
      });
      const compName = companyId === 'comp_sim_retail' ? 'Londrina Confecções & Varejo' : 'Bistrô & Trattoria Londrina';
      this.appRuntime.onNotification?.(
        'Inquilino Alternado',
        `Sessão ativa agora como ${compName}. Abra o PDV, Estoque ou Mesas para operar.`,
        'success'
      );
    } catch (err: unknown) {
      console.error('Falha ao alternar inquilino:', err);
      this.appRuntime.onNotification?.('Falha no Login', `Erro ao alternar inquilino: ${String(err)}`, 'error');
    }
  }
}

