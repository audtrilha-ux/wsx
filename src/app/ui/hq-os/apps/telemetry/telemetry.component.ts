import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HqApiClient } from '../../../../core/api/api-client';
import { firstValueFrom } from 'rxjs';
import { HqStateService } from '../../hq-state.service';

interface TelemetryReport {
  companyId: string;
  companyName: string;
  platform: string;
  version: string;
  timestamp: string;
  overallStatus: 'healthy' | 'warning' | 'critical';
  checks: { subsystem: string; status: 'healthy' | 'warning' | 'critical'; details: string }[];
}

export interface HqAuditLogEntry {
  id: string;
  timestamp: string;
  hqAdminId: string;
  hqAdminEmail: string;
  action: string;
  targetCompanyId?: string;
  details: string;
  previousValue?: unknown;
  newValue?: unknown;
  ip?: string;
}

export interface CentralStoreDiagnostics {
  status: 'HEALTHY' | 'DEGRADED' | 'RECOVERED_FROM_BACKUP';
  filePath: string;
  backupExists: boolean;
  fileSizeBytes: number;
  lastLoadedAt: string | null;
  lastSavedAt: string | null;
  writeCount: number;
  entities: {
    tenantsCount: number;
    usersCount: number;
    branchesCount: number;
    devicesCount: number;
    invoicesCount: number;
    auditLogsCount: number;
    plansCount: number;
    appsCount: number;
    osReleasesCount: number;
    productsCount: number;
    salesCount: number;
    ordersCount: number;
    customersCount: number;
    financeTransactionsCount: number;
  };
  memoryUsageMb: number;
}

@Component({
  selector: 'app-hq-telemetry',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <mat-icon class="text-sm">monitor_heart</mat-icon>
            </div>
            <h3 class="text-lg font-bold text-white uppercase tracking-wider">Telemetria & Governança HQ</h3>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            Diagnóstico de terminais em tempo real, console de eventos e trilha de auditoria administrativa imutável.
          </p>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button (click)="activeTab.set('TERMINALS')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  [ngClass]="activeTab() === 'TERMINALS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
            <mat-icon class="text-xs">devices</mat-icon>
            Terminais ({{ telemetryList().length }})
          </button>
          <button (click)="activeTab.set('AUDIT')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  [ngClass]="activeTab() === 'AUDIT' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
            <mat-icon class="text-xs">shield</mat-icon>
            Audit Trail ({{ auditLogs().length }})
          </button>
          <button (click)="activeTab.set('EVENTS')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  [ngClass]="activeTab() === 'EVENTS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
            <mat-icon class="text-xs">terminal</mat-icon>
            Console Central
          </button>
          <button (click)="activeTab.set('STORE')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  [ngClass]="activeTab() === 'STORE' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
            <mat-icon class="text-xs">storage</mat-icon>
            Central Store
          </button>
        </div>
      </div>

      <!-- Tab 1: Terminal Subsystems Diagnostics -->
      @if (activeTab() === 'TERMINALS') {
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <mat-icon class="text-indigo-400">monitor_heart</mat-icon>
              Integridade dos Terminais e PDVs Conectados
            </h4>
            <button (click)="loadTelemetry()" class="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-500/20 flex items-center gap-1.5 transition-colors cursor-pointer">
              <mat-icon class="text-xs">refresh</mat-icon>
              Atualizar
            </button>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            @for (item of telemetryList(); track item.companyId) {
              <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
                <div class="flex justify-between items-start">
                  <div>
                    <h5 class="text-sm font-bold text-white flex items-center gap-1.5">
                      {{ item.companyName }}
                      <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-850 text-slate-400 border border-slate-800 uppercase font-mono font-bold">{{ item.platform }}</span>
                    </h5>
                    <span class="text-[10px] text-slate-500 font-mono">ID: {{ item.companyId }} | Core: {{ item.version }}</span>
                  </div>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono"
                        [ngClass]="{
                          'bg-green-500/10 text-green-400 border border-green-500/15': item.overallStatus === 'healthy',
                          'bg-amber-500/10 text-amber-400 border border-amber-500/15': item.overallStatus === 'warning',
                          'bg-red-500/10 text-red-400 border border-red-500/15': item.overallStatus === 'critical'
                        }">
                    {{ item.overallStatus }}
                  </span>
                </div>
                <div class="space-y-2 pt-2 border-t border-slate-800/60">
                  <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subsistemas</span>
                  <div class="grid grid-cols-1 gap-2 mt-1">
                    @for (check of item.checks; track check.subsystem) {
                      <div class="flex items-center justify-between text-[11px] bg-slate-950/40 border border-slate-800/40 rounded px-2.5 py-1.5">
                        <div class="flex items-center gap-2">
                          <span class="w-1.5 h-1.5 rounded-full"
                                [ngClass]="{
                                  'bg-green-500': check.status === 'healthy',
                                  'bg-amber-500': check.status === 'warning',
                                  'bg-red-500': check.status === 'critical'
                                }"></span>
                          <span class="font-bold text-slate-300">{{ check.subsystem }}</span>
                        </div>
                        <span class="text-slate-500 text-right">{{ check.details }}</span>
                      </div>
                    }
                  </div>
                </div>
                <div class="text-[10px] text-slate-500 text-right italic font-mono pt-1">
                  Último Report: {{ item.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}
                </div>
              </div>
            }
            @if (telemetryList().length === 0) {
              <div class="col-span-2 text-center py-12 bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
                <mat-icon class="text-3xl text-slate-600 mb-2 block">devices</mat-icon>
                Nenhum terminal reportou telemetria ainda.
              </div>
            }
          </div>
        </div>
      }

      <!-- Tab 2: Immutable HQ Audit Trail -->
      @if (activeTab() === 'AUDIT') {
        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            <div class="flex items-center gap-2">
              <mat-icon class="text-indigo-400">shield</mat-icon>
              <h4 class="text-xs font-bold text-white uppercase tracking-wider">
                Trilha de Auditoria Administrativa (Control Plane Audit Trail)
              </h4>
            </div>

            <div class="flex items-center gap-2">
              <input type="text" [value]="auditFilter()" (input)="onAuditFilterInput($event)" placeholder="Filtrar por ação, empresa ou e-mail..."
                     class="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none w-64">
              <button (click)="loadAuditLogs()" class="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-500/20 flex items-center gap-1 transition-colors cursor-pointer">
                <mat-icon class="text-xs">refresh</mat-icon>
                Atualizar
              </button>
            </div>
          </div>

          <div class="space-y-3">
            @for (log of filteredAuditLogs(); track log.id) {
              <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-700 transition-colors">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
                          [ngClass]="{
                            'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30': log.action.includes('TENANT') || log.action.includes('CREATE'),
                            'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30': log.action.includes('CREDIT') || log.action.includes('ACTIVATE'),
                            'bg-rose-500/20 text-rose-300 border border-rose-500/30': log.action.includes('SUSPEND') || log.action.includes('BLOCK') || log.action.includes('DELETE'),
                            'bg-amber-500/20 text-amber-300 border border-amber-500/30': log.action.includes('PLAN') || log.action.includes('OTA') || log.action.includes('RELEASE')
                          }">
                      {{ log.action }}
                    </span>
                    <span class="text-xs text-slate-300 font-bold">{{ log.details }}</span>
                  </div>
                  <span class="text-[11px] text-slate-500 font-mono">{{ log.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}</span>
                </div>

                <div class="flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-800/60">
                  <div class="flex items-center gap-4">
                    <span>Admin: <strong class="text-slate-300">{{ log.hqAdminEmail }}</strong></span>
                    @if (log.targetCompanyId) {
                      <span>Tenant ID: <strong class="text-indigo-400">{{ log.targetCompanyId }}</strong></span>
                    }
                  </div>
                  <span class="text-slate-500 text-[10px]">ID: {{ log.id }}</span>
                </div>
              </div>
            }

            @if (filteredAuditLogs().length === 0) {
              <div class="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
                <mat-icon class="text-3xl text-slate-600 mb-2 block">history_edu</mat-icon>
                Nenhum registro de auditoria encontrado.
              </div>
            }
          </div>
        </div>
      }

      <!-- Tab 3: Cloud Events Console -->
      @if (activeTab() === 'EVENTS') {
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-2xl">
          <div class="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <span class="text-xs font-bold text-white uppercase tracking-wider">Console de Eventos da Central Cloud</span>
              <p class="text-[10px] text-slate-400 mt-0.5">Stream de atividades operacionais, conexões e broadcasts em tempo real.</p>
            </div>
            <button (click)="hqState.logs.set([])" class="text-xs text-rose-400 hover:text-rose-300 transition-colors font-bold flex items-center gap-1 cursor-pointer">
              <mat-icon class="text-xs">delete_sweep</mat-icon>
              Limpar Logs
            </button>
          </div>
          <div class="space-y-2.5 font-mono text-[11px] overflow-y-auto max-h-[400px]">
            @for (log of hqState.logs(); track log.time) {
              <div class="flex items-start gap-3 bg-slate-950/40 p-2 rounded border border-slate-800/40">
                <span class="text-slate-500 shrink-0">[{{ log.time | date:'HH:mm:ss' }}]</span>
                <span class="px-1.5 rounded text-[10px] shrink-0 font-bold uppercase"
                      [ngClass]="{
                        'bg-green-500/10 text-green-400 border border-green-500/15': log.type === 'success',
                        'bg-blue-500/10 text-blue-400 border border-blue-500/15': log.type === 'info',
                        'bg-amber-500/10 text-amber-400 border border-amber-500/15': log.type === 'warn'
                      }">
                  {{ log.type }}
                </span>
                <span class="text-slate-300 flex-1">{{ log.text }}</span>
              </div>
            }
            @if (hqState.logs().length === 0) {
              <p class="text-xs text-slate-500 text-center py-8 font-sans">Nenhum evento registrado no buffer do console.</p>
            }
          </div>
        </div>
      }

      <!-- Tab 4: Central Store Engine Diagnostics & Backups -->
      @if (activeTab() === 'STORE') {
        <div class="space-y-6">
          <!-- Central Store Health Banner -->
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <mat-icon>storage</mat-icon>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="text-base font-bold text-white">Central Store Persistence Engine</h4>
                    @if (storeDiagnostics()?.status === 'HEALTHY') {
                      <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">ONLINE & ATÔMICO</span>
                    } @else if (storeDiagnostics()?.status === 'RECOVERED_FROM_BACKUP') {
                      <span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold">RECUPERADO DE BACKUP</span>
                    } @else {
                      <span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">DEGRADADO</span>
                    }
                  </div>
                  <p class="text-xs text-slate-400 mt-0.5">Motor de persistência seguro com atomic writes (.tmp -> rename) e snapshots imutáveis.</p>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center gap-2 flex-wrap">
                <button (click)="loadStoreDiagnostics()" [disabled]="storeLoading()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer">
                  <mat-icon class="text-xs">refresh</mat-icon>
                  Atualizar
                </button>
                <button (click)="createBackup()" [disabled]="storeLoading()" class="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold px-3 py-2 rounded-lg border border-indigo-500/30 flex items-center gap-1.5 transition-colors cursor-pointer">
                  <mat-icon class="text-xs">cloud_upload</mat-icon>
                  Criar Snapshot (.bak)
                </button>
                <button (click)="compactStore()" [disabled]="storeLoading()" class="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold px-3 py-2 rounded-lg border border-emerald-500/30 flex items-center gap-1.5 transition-colors cursor-pointer">
                  <mat-icon class="text-xs">compress</mat-icon>
                  Compactar & Reindexar
                </button>
              </div>
            </div>

            <!-- Operational Metrics Card -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div class="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tamanho no Disco</span>
                <span class="text-base font-black text-white mt-1 block">
                  {{ ((storeDiagnostics()?.fileSizeBytes || 0) / 1024) | number:'1.1-1' }} KB
                </span>
                <span class="text-[10px] text-slate-500 truncate block mt-0.5">central_store.json</span>
              </div>

              <div class="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Escritas Atômicas</span>
                <span class="text-base font-black text-indigo-400 mt-1 block">
                  {{ storeDiagnostics()?.writeCount || 0 }}
                </span>
                <span class="text-[10px] text-emerald-500 block mt-0.5">Transações Seguras</span>
              </div>

              <div class="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Backup Ativo (.bak)</span>
                <span class="text-base font-black mt-1 block" [ngClass]="storeDiagnostics()?.backupExists ? 'text-emerald-400' : 'text-amber-400'">
                  {{ storeDiagnostics()?.backupExists ? 'SIM' : 'NÃO' }}
                </span>
                <span class="text-[10px] text-slate-500 block mt-0.5">Replicação local</span>
              </div>

              <div class="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Memória Heap (MB)</span>
                <span class="text-base font-black text-white mt-1 block">
                  {{ storeDiagnostics()?.memoryUsageMb || 0 }} MB
                </span>
                <span class="text-[10px] text-slate-500 block mt-0.5">V8 Node Process</span>
              </div>

              <div class="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Última Gravação</span>
                <span class="text-xs font-bold text-slate-200 mt-1.5 block truncate">
                  {{ (storeDiagnostics()?.lastSavedAt | date:'HH:mm:ss') || 'N/A' }}
                </span>
                <span class="text-[10px] text-slate-500 block mt-0.5">Sync contínuo</span>
              </div>

              <div class="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Carga Inicial</span>
                <span class="text-xs font-bold text-slate-200 mt-1.5 block truncate">
                  {{ (storeDiagnostics()?.lastLoadedAt | date:'HH:mm:ss') || 'Boot' }}
                </span>
                <span class="text-[10px] text-slate-500 block mt-0.5">Startup Server</span>
              </div>
            </div>

            <!-- Entities In Memory Grid -->
            <div>
              <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <mat-icon class="text-xs text-indigo-400">dataset</mat-icon>
                Entidades e Tabelas Gerenciadas na Memória do HQ
              </h5>
              <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <div class="p-3 bg-slate-950/40 rounded-lg border border-slate-800/50">
                  <span class="text-[10px] text-slate-500 font-bold block">Tenants / Lojas</span>
                  <span class="text-lg font-bold text-white mt-0.5 block">{{ storeDiagnostics()?.entities?.tenantsCount || 0 }}</span>
                </div>
                <div class="p-3 bg-slate-950/40 rounded-lg border border-slate-800/50">
                  <span class="text-[10px] text-slate-500 font-bold block">Filiais Cadastradas</span>
                  <span class="text-lg font-bold text-white mt-0.5 block">{{ storeDiagnostics()?.entities?.branchesCount || 0 }}</span>
                </div>
                <div class="p-3 bg-slate-950/40 rounded-lg border border-slate-800/50">
                  <span class="text-[10px] text-slate-500 font-bold block">Usuários RBAC</span>
                  <span class="text-lg font-bold text-white mt-0.5 block">{{ storeDiagnostics()?.entities?.usersCount || 0 }}</span>
                </div>
                <div class="p-3 bg-slate-950/40 rounded-lg border border-slate-800/50">
                  <span class="text-[10px] text-slate-500 font-bold block">Dispositivos PDV</span>
                  <span class="text-lg font-bold text-white mt-0.5 block">{{ storeDiagnostics()?.entities?.devicesCount || 0 }}</span>
                </div>
                <div class="p-3 bg-slate-950/40 rounded-lg border border-slate-800/50">
                  <span class="text-[10px] text-slate-500 font-bold block">Faturas Faturadas</span>
                  <span class="text-lg font-bold text-white mt-0.5 block">{{ storeDiagnostics()?.entities?.invoicesCount || 0 }}</span>
                </div>
                <div class="p-3 bg-slate-950/40 rounded-lg border border-slate-800/50">
                  <span class="text-[10px] text-slate-500 font-bold block">Logs de Auditoria</span>
                  <span class="text-lg font-bold text-white mt-0.5 block">{{ storeDiagnostics()?.entities?.auditLogsCount || 0 }}</span>
                </div>
                <div class="p-3 bg-slate-950/40 rounded-lg border border-slate-800/50">
                  <span class="text-[10px] text-slate-500 font-bold block">Catálogo de Apps</span>
                  <span class="text-lg font-bold text-white mt-0.5 block">{{ storeDiagnostics()?.entities?.appsCount || 0 }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class HqTelemetryComponent implements OnInit {
  private http = inject(HqApiClient);
  hqState = inject(HqStateService);
  
  activeTab = signal<'TERMINALS' | 'AUDIT' | 'EVENTS' | 'STORE'>('TERMINALS');
  telemetryList = signal<TelemetryReport[]>([]);
  auditLogs = signal<HqAuditLogEntry[]>([]);
  auditFilter = signal<string>('');
  storeDiagnostics = signal<CentralStoreDiagnostics | null>(null);
  storeLoading = signal<boolean>(false);

  readonly filteredAuditLogs = computed(() => {
    const q = this.auditFilter().toLowerCase().trim();
    if (!q) return this.auditLogs();
    return this.auditLogs().filter(l => 
      l.action.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) ||
      l.hqAdminEmail.toLowerCase().includes(q) ||
      (l.targetCompanyId && l.targetCompanyId.toLowerCase().includes(q))
    );
  });

  ngOnInit() {
    this.loadTelemetry();
    this.loadAuditLogs();
    this.loadStoreDiagnostics();
  }

  onAuditFilterInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.auditFilter.set(target.value);
  }

  async loadTelemetry() {
    try {
      const list = await firstValueFrom(this.http.get<TelemetryReport[]>('/api/v1/telemetry'));
      this.telemetryList.set(list);
    } catch (err: unknown) {
      console.error('Failed to load telemetry', err);
    }
  }

  async loadAuditLogs() {
    try {
      const logs = await firstValueFrom(this.http.get<HqAuditLogEntry[]>('/api/v1/hq/audit-logs'));
      if (Array.isArray(logs)) {
        this.auditLogs.set(logs.reverse());
      }
    } catch (err: unknown) {
      console.error('Failed to load HQ audit logs', err);
    }
  }

  async loadStoreDiagnostics() {
    try {
      this.storeLoading.set(true);
      const diag = await firstValueFrom(this.http.get<CentralStoreDiagnostics>('/api/v1/hq/store/diagnostics'));
      this.storeDiagnostics.set(diag);
    } catch (err: unknown) {
      console.error('Failed to load Central Store diagnostics', err);
    } finally {
      this.storeLoading.set(false);
    }
  }

  async createBackup() {
    try {
      this.storeLoading.set(true);
      await firstValueFrom(this.http.post('/api/v1/hq/store/backup', { note: 'Snapshot manual via Console HQ' }));
      await this.loadStoreDiagnostics();
      await this.loadAuditLogs();
    } catch (err: unknown) {
      console.error('Failed to create snapshot backup', err);
    } finally {
      this.storeLoading.set(false);
    }
  }

  async compactStore() {
    try {
      this.storeLoading.set(true);
      const res = await firstValueFrom(this.http.post<{ diagnostics: CentralStoreDiagnostics }>('/api/v1/hq/store/compact', {}));
      if (res?.diagnostics) {
        this.storeDiagnostics.set(res.diagnostics);
      } else {
        await this.loadStoreDiagnostics();
      }
      await this.loadAuditLogs();
    } catch (err: unknown) {
      console.error('Failed to compact central store', err);
    } finally {
      this.storeLoading.set(false);
    }
  }
}

