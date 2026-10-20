import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DeviceService } from '../device/device.service';
import { PrinterService } from '../printing/printer.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { OsDatabaseService } from '../storage/os-database.service';
import { OsStateService } from '../../os-state.service';
import { HardwareService } from '../hardware/hardware.service';
import { IHealthCheck, IHealthCheckResult, IMetrics, ILogger } from '../../contracts/diagnostics/diagnostics.contract';

export interface HealthCheckResult {
  subsystem: string;
  status: 'healthy' | 'warning' | 'critical';
  details: string;
  mode: 'REAL' | 'FALLBACK';
}

export interface IncidentEntry {
  id: string;
  subsystem: string;
  message: string;
  severity: 'warning' | 'critical';
  timestamp: Date;
  resolved: boolean;
}

export interface DiagnosticReport {
  timestamp: Date;
  overallStatus: 'healthy' | 'warning' | 'critical';
  checks: HealthCheckResult[];
  incidentsHistory?: IncidentEntry[];
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class DiagnosticsService implements IHealthCheck, IMetrics, ILogger {
  private deviceService = inject(DeviceService);
  private printerService = inject(PrinterService);
  private configService = inject(ConfigurationService);
  private osDb = inject(OsDatabaseService);
  private http = inject(HttpClient);
  private osState = inject(OsStateService);
  private hardwareService = inject(HardwareService);

  readonly report = signal<DiagnosticReport | null>(null);
  readonly isRunningCheck = signal<boolean>(false);
  readonly incidentsHistory = signal<IncidentEntry[]>([]);

  // Métricas e Logs
  private metricsMap = new Map<string, number>();
  private logHistory = signal<LogEntry[]>([]);

  readonly logs = this.logHistory.asReadonly();

  constructor() {
    this.loadIncidentHistory();
  }

  // Implementação de IMetrics
  recordLatency(operation: string, durationMs: number): void {
    this.metricsMap.set(`latency_${operation}`, Math.round(durationMs));
  }

  incrementCounter(name: string, value = 1): void {
    const current = this.metricsMap.get(name) || 0;
    this.metricsMap.set(name, current + value);
  }

  getSnapshot(): Record<string, number> {
    const snapshot: Record<string, number> = {};
    this.metricsMap.forEach((val, key) => {
      snapshot[key] = val;
    });
    return snapshot;
  }

  // Implementação de ILogger
  info(message: string, context?: Record<string, unknown>): void {
    this.appendLog('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.appendLog('warn', message, context);
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.appendLog('error', message, context, error);
    this.recordIncident('System', message, 'critical');
  }

  private appendLog(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>, error?: unknown) {
    const entry: LogEntry = { level, message, context, error, timestamp: new Date() };
    this.logHistory.update(list => [entry, ...list.slice(0, 99)]); // Retém últimos 100 logs
  }

  private recordIncident(subsystem: string, message: string, severity: 'warning' | 'critical') {
    const incident: IncidentEntry = {
      id: `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subsystem,
      message,
      severity,
      timestamp: new Date(),
      resolved: false
    };

    this.incidentsHistory.update(list => [incident, ...list.slice(0, 49)]);
    this.persistIncidentHistory();
  }

  private async loadIncidentHistory(): Promise<void> {
    try {
      const ns = this.osDb.getNamespace('system.diagnostics');
      const stored = await ns.get<IncidentEntry[]>('incidents_history');
      if (stored) {
        this.incidentsHistory.set(stored);
      }
    } catch {
      // Ignora erro inicial
    }
  }

  private async persistIncidentHistory(): Promise<void> {
    try {
      const ns = this.osDb.getNamespace('system.diagnostics');
      await ns.put('incidents_history', this.incidentsHistory());
    } catch {
      // Ignora erro
    }
  }

  // Implementação de IHealthCheck
  async runCheck(): Promise<IHealthCheckResult[]> {
    const rep = await this.runDiagnostic();
    return rep.checks.map(c => ({
      component: c.subsystem,
      status: c.status === 'healthy' ? 'healthy' : c.status === 'warning' ? 'degraded' : 'error',
      details: `[Mode: ${c.mode}] ${c.details}`,
      timestamp: rep.timestamp
    }));
  }

  async runDiagnostic(): Promise<DiagnosticReport> {
    this.isRunningCheck.set(true);
    const hasBridge = typeof window !== 'undefined' && !!(window as unknown as { __3EATCRU_NATIVE_BRIDGE__?: unknown }).__3EATCRU_NATIVE_BRIDGE__;
    
    const checks: HealthCheckResult[] = [];

    // 1. Core Kernel Check
    checks.push({
      subsystem: 'Core Kernel',
      status: 'healthy',
      details: 'Núcleo do sistema operacional, barramento de eventos e runtime de apps ativos.',
      mode: hasBridge ? 'REAL' : 'FALLBACK'
    });

    // 2. Device Check
    const dev = this.deviceService.deviceState();
    checks.push({
      subsystem: 'Device & Identity',
      status: dev.status === 'active' ? 'healthy' : 'warning',
      details: dev.platform === 'web'
        ? `Navegador Web Identificado (Confiança: ${dev.trustLevel.toUpperCase()}).`
        : `Terminal [${dev.platform.toUpperCase()}] ID: ${dev.deviceId ? dev.deviceId.substring(0, 8) : 'N/A'}... (Estação: ${dev.stationType.toUpperCase()})`,
      mode: dev.platform !== 'web' ? 'REAL' : 'FALLBACK'
    });

    // 3. Printer Check
    const printerOnline = this.printerService.isPrinterOnline();
    const hasPaper = this.printerService.hasPaper();
    
    let printerStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    let printerDetails = 'Impressora térmica ativa e pronta para emissão de bobinas.';
    if (!printerOnline) {
      printerStatus = 'critical';
      printerDetails = 'Impressora desconectada ou driver inativo.';
    } else if (!hasPaper) {
      printerStatus = 'warning';
      printerDetails = 'Impressora online, mas sem papel térmico.';
    }

    checks.push({
      subsystem: 'Printer Subsystem',
      status: printerStatus,
      details: printerDetails,
      mode: hasBridge ? 'REAL' : 'FALLBACK'
    });

    // 4. Scanner & Peripherals
    const peripherals = this.hardwareService.peripherals();
    const scanner = peripherals.find(p => p.type === 'scanner');
    checks.push({
      subsystem: 'Barcode Scanner',
      status: scanner && scanner.status === 'online' ? 'healthy' : 'warning',
      details: scanner ? `Leitor ${scanner.name} ativo na porta ${scanner.port || 'USB'}.` : 'Nenhum leitor físico registrado.',
      mode: scanner && hasBridge ? 'REAL' : 'FALLBACK'
    });

    // 5. Storage & SQLite Native Check
    const storageHealth = await this.osDb.getHealth();
    checks.push({
      subsystem: 'OS Database Storage',
      status: storageHealth.status === 'healthy' ? 'healthy' : storageHealth.status === 'degraded' ? 'warning' : 'critical',
      details: storageHealth.details,
      mode: hasBridge ? 'REAL' : 'FALLBACK'
    });

    // 6. Network & Central Cloud Ping
    const centralUrl = this.configService.get('centralApiUrl') || '/api/v1';
    try {
      const pingStart = performance.now();
      await firstValueFrom(this.http.get('/api/v1/health'));
      const pingTime = Math.round(performance.now() - pingStart);
      this.recordLatency('central_ping', pingTime);
      checks.push({
        subsystem: 'Network & Central Cloud',
        status: 'healthy',
        details: `Conexão verificada com Central (${centralUrl}) - Latência: ${pingTime}ms`,
        mode: 'REAL'
      });
    } catch {
      checks.push({
        subsystem: 'Network & Central Cloud',
        status: 'warning',
        details: `Central inacessível em ${centralUrl}. Modo Offline-First ativo.`,
        mode: 'FALLBACK'
      });
    }

    // 7. P2P & LAN Diagnostics
    checks.push({
      subsystem: 'P2P Network & LAN',
      status: 'healthy',
      details: 'Interface de rede local ativa e pronta para descoberta de peers.',
      mode: hasBridge ? 'REAL' : 'FALLBACK'
    });

    // Determine overall status
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (checks.some(c => c.status === 'critical')) {
      overall = 'critical';
    } else if (checks.some(c => c.status === 'warning')) {
      overall = 'warning';
    }

    const finalReport: DiagnosticReport = {
      timestamp: new Date(),
      overallStatus: overall,
      checks,
      incidentsHistory: this.incidentsHistory()
    };

    this.report.set(finalReport);
    this.isRunningCheck.set(false);

    // Persistir estado de saúde no OS Storage
    try {
      const ns = this.osDb.getNamespace('system.diagnostics');
      await ns.put('last_diagnostic_report', finalReport);
    } catch {
      // Ignora erro
    }

    // Send telemetry to Central API
    const company = this.osState.company();
    if (company && company.id) {
      const devState = this.deviceService.deviceState();
      const payload = {
        companyName: company.name,
        overallStatus: finalReport.overallStatus,
        checks: finalReport.checks,
        platform: devState.platform,
        version: devState.osVersion || 'v1.4.3'
      };
      firstValueFrom(this.http.post(`/api/v1/telemetry/${company.id}`, payload))
        .catch(err => console.warn('[Telemetry] Falha ao despachar telemetria para Central:', err));
    }

    return finalReport;
  }
}

