import { TestBed } from '@angular/core/testing';
import { ProcessManagerService } from './process-manager.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { OsEventBusService } from '../events/event-bus.service';

describe('ProcessManagerService — Process Supervisor & Service Manager', () => {
  let service: ProcessManagerService;

  beforeEach(() => {
    const mockDiagnostics = { info: () => true, warn: () => true, error: () => true };
    const mockEventBus = { publish: () => true };

    TestBed.configureTestingModule({
      providers: [
        ProcessManagerService,
        { provide: DiagnosticsService, useValue: mockDiagnostics },
        { provide: OsEventBusService, useValue: mockEventBus }
      ]
    });

    service = TestBed.inject(ProcessManagerService);
  });

  it('should initialize with default OS system services running', () => {
    const procs = service.listProcesses();
    expect(procs.length).toBeGreaterThanOrEqual(5);

    const spooler = procs.find(p => p.id === 'srv_print_spooler');
    expect(spooler).toBeTruthy();
    expect(spooler?.status).toBe('running');
  });

  it('should register custom background service', () => {
    service.registerService('srv_custom_worker', 'Custom Background Worker', 'background_worker');
    const procs = service.listProcesses();
    const custom = procs.find(p => p.id === 'srv_custom_worker');

    expect(custom).toBeTruthy();
    expect(custom?.name).toBe('Custom Background Worker');
  });

  it('should stop and restart a process', async () => {
    await service.stopProcess('srv_print_spooler');
    let proc = service.listProcesses().find(p => p.id === 'srv_print_spooler');
    expect(proc?.status).toBe('stopped');

    await service.startProcess('srv_print_spooler');
    proc = service.listProcesses().find(p => p.id === 'srv_print_spooler');
    expect(proc?.status).toBe('running');
  });

  it('should handle process crash and apply auto restart policy', () => {
    service.handleProcessCrash('srv_outbox_sync', new Error('Network Timeout'));
    const proc = service.listProcesses().find(p => p.id === 'srv_outbox_sync');

    expect(proc?.status).toBe('restarting');
    expect(proc?.restartCount).toBe(1);
  });

  it('should record heartbeats and update process metrics', () => {
    service.recordHeartbeat('srv_p2p_discovery');
    const metrics = service.getProcessMetrics('srv_p2p_discovery');

    expect(metrics).toBeTruthy();
    expect(metrics?.heartbeatCount).toBeGreaterThan(1);
  });

  it('should register app process and manage continuous background state', () => {
    const proc = service.registerAppProcess('app_pos', 'Ponto de Venda', false);
    expect(proc).toBeTruthy();
    expect(proc.pid).toBeGreaterThanOrEqual(1001);
    expect(proc.status).toBe('running');
    expect(proc.isBackground).toBe(false);

    // Minimize window: continuous background execution with monitored CPU
    service.setAppBackgroundState('app_pos', true);
    const updated = service.getAppProcess('app_pos');
    expect(updated?.isBackground).toBe(true);
    expect(updated?.status).toBe('running');
    expect(updated?.metrics.cpuPercentage).toBeLessThan(proc.metrics.cpuPercentage);
  });

  it('should compute metrics summary across daemons and app instances', () => {
    service.registerAppProcess('app_pos', 'Ponto de Venda', false);
    service.registerAppProcess('app_ifood', 'iFood Connector', true);

    const summary = service.getMetricsSummary();
    expect(summary.activeProcessesCount).toBeGreaterThanOrEqual(7);
    expect(summary.foregroundAppsCount).toBe(1);
    expect(summary.backgroundAppsCount).toBe(1);
    expect(summary.totalCpuPercentage).toBeGreaterThan(0);
    expect(summary.totalMemoryMb).toBeGreaterThan(0);
  });

  it('should kill an app process and clean from active table', async () => {
    service.registerAppProcess('app_crm', 'CRM Fidelidade', false);
    expect(service.getAppProcess('app_crm')).toBeTruthy();

    const killed = await service.killProcess('app_app_crm');
    expect(killed).toBe(true);
    expect(service.getAppProcess('app_crm')).toBeUndefined();
  });
});
