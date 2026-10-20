import { TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';
import { AppRuntimeService } from './app-runtime.service';
import { AppRegistryService } from './app-registry.service';
import { AppManifest } from '../../contracts/apps/app-manifest.contract';
import { OsDatabaseService } from '../storage/os-database.service';
import { PrinterService } from '../printing/printer.service';
import { SyncService } from '../sync/sync.service';
import { OsEventBusService } from '../events/event-bus.service';
import { HardwareService } from '../hardware/hardware.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { DeviceService } from '../device/device.service';
import { IdentityService } from '../identity/identity.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { OperatorLockService } from '../operator-lock/operator-lock.service';
import { ProcessManagerService } from './process-manager.service';

describe('AppRuntimeService — Lifecycle, Permissions & SemVer Validation', () => {
  let runtimeService: AppRuntimeService;
  let mockRegistry: {
    get: (id: string) => AppManifest | undefined;
    getAll: () => AppManifest[];
    has: (id: string) => boolean;
    loadComponent: (id: string) => Promise<Type<unknown> | undefined>;
  };
  let mockDevice: {
    deviceState: () => {
      deviceId: string;
      osVersion: string;
      hostname: string;
      ip: string;
      platform: 'web' | 'windows' | 'android' | 'linux';
      isOnline: boolean;
      lastHeartbeat: Date;
    };
  };

  beforeEach(() => {
    const posManifest: AppManifest = {
      id: 'app_pos',
      name: 'POS App',
      description: 'Point of sale',
      version: '1.0.0',
      category: 'SALES',
      icon: 'point_of_sale',
      developer: '3eatcru',
      isSystemApp: true,
      osCompatibility: '>=2.0.0',
      loadComponent: async () => null as unknown as Type<unknown>
    };

    mockRegistry = {
      get: (id: string) => id === 'app_pos' ? posManifest : undefined,
      getManifest: (id: string) => id === 'app_pos' ? posManifest : undefined,
      getAll: () => [posManifest],
      has: (id: string) => id === 'app_pos' || !!mockRegistry.get(id),
      loadComponent: async () => undefined
    };

    mockDevice = {
      deviceState: () => ({
        deviceId: 'dev_1',
        osVersion: '2.5.0',
        hostname: 'term-1',
        ip: '127.0.0.1',
        platform: 'web',
        isOnline: true,
        lastHeartbeat: new Date()
      })
    };

    const mockOsDb = { getNamespace: () => ({}) };
    const mockPrinter = { print: async () => true };
    const mockSync = { isOnline: () => true, queueOperation: async () => undefined };
    const mockEventBus = { 
      publish: () => true, 
      subscribe: () => ({
        unsubscribe: () => undefined
      }),
      clearSubscriptions: () => true 
    };
    const mockHardware = { readScale: async () => 0, triggerCashDrawer: async () => true, sendCustomerDisplay: async () => true, listPeripherals: () => [] };
    const mockDiag = { info: () => true, warn: () => true, error: () => true };
    const mockIdentity = { currentTenant: () => ({ tenantId: 'comp_1', installedApps: ['app_pos', 'app_future', 'app_with_deps'] }) };
    const mockConfig = { get: () => null };
    const mockOpLock = { activeOperator: () => null };
    const mockProcessManager = {
      registerAppProcess: () => ({ pid: 1001, status: 'running' }),
      unregisterAppProcess: () => true,
      setAppBackgroundState: () => true
    };

    TestBed.configureTestingModule({
      providers: [
        AppRuntimeService,
        { provide: AppRegistryService, useValue: mockRegistry },
        { provide: DeviceService, useValue: mockDevice },
        { provide: OsDatabaseService, useValue: mockOsDb },
        { provide: PrinterService, useValue: mockPrinter },
        { provide: SyncService, useValue: mockSync },
        { provide: OsEventBusService, useValue: mockEventBus },
        { provide: HardwareService, useValue: mockHardware },
        { provide: DiagnosticsService, useValue: mockDiag },
        { provide: IdentityService, useValue: mockIdentity },
        { provide: ConfigurationService, useValue: mockConfig },
        { provide: OperatorLockService, useValue: mockOpLock },
        { provide: ProcessManagerService, useValue: mockProcessManager }
      ]
    });

    runtimeService = TestBed.inject(AppRuntimeService);
  });

  describe('SemVer Compatibility Logic', () => {
    it('should correctly accept compatibility when app requires current or lower OS version', () => {
      const manifest: AppManifest = {
        id: 'app_pos',
        name: 'POS App',
        description: 'Point of sale',
        version: '1.0.0',
        category: 'SALES',
        icon: 'point_of_sale',
        developer: '3eatcru',
        osCompatibility: '>=2.0.0',
        loadComponent: async () => null as unknown as Type<unknown>
      };

      mockRegistry.get = (id: string) => (id === 'app_pos' ? manifest : undefined);

      const result = runtimeService.validateAppCompatibility('app_pos');
      expect(result.compatible).toBe(true);
    });

    it('should reject launch when required minOsVersion is higher than current OS version', () => {
      const manifest: AppManifest = {
        id: 'app_future',
        name: 'Future App',
        description: 'Requires higher version',
        version: '1.0.0',
        category: 'FINANCE',
        icon: 'analytics',
        developer: '3eatcru',
        osCompatibility: '>=99.0.0',
        loadComponent: async () => null as unknown as Type<unknown>
      };

      mockRegistry.get = (id: string) => (id === 'app_future' ? manifest : undefined);

      const result = runtimeService.validateAppCompatibility('app_future');
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('99.0.0');
    });

    it('should reject launch when required dependencies are missing or unresolved', () => {
      const manifest: AppManifest = {
        id: 'app_with_deps',
        name: 'Dependent App',
        description: 'Has dependency',
        version: '1.0.0',
        category: 'SALES',
        icon: 'point_of_sale',
        developer: '3eatcru',
        dependencies: [
          { id: 'dep_non_existent', versionRange: '^1.0.0' }
        ],
        loadComponent: async () => null as unknown as Type<unknown>
      };

      mockRegistry.get = (id: string) => (id === 'app_with_deps' ? manifest : undefined);

      const result = runtimeService.validateAppCompatibility('app_with_deps');
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('dep_non_existent');
    });
  });

  describe('Runtime State Management', () => {
    it('should initialize with an empty running apps map and manage lifecycle states', () => {
      expect(runtimeService.getRunningApps().length).toBe(0);

      runtimeService.updateInstanceState('app_pos', 'active');
      expect(runtimeService.getAppState('app_pos')).toBe('active');
      expect(runtimeService.getRunningApps().length).toBe(1);

      runtimeService.updateInstanceState('app_pos', 'destroyed');
      expect(runtimeService.getAppState('app_pos')).toBe('unmounted');
      expect(runtimeService.getRunningApps().length).toBe(0);
    });

    it('should register and clean up app subscriptions', () => {
      let unsubscribed = false;
      runtimeService.registerSubscription('app_pos', () => {
        unsubscribed = true;
      });

      runtimeService.cleanupAppSubscriptions('app_pos');
      expect(unsubscribed).toBe(true);
    });

    it('should manage background tasks and termination', async () => {
      runtimeService.updateInstanceState('app_pos', 'active');
      const taskId = runtimeService.registerBackgroundTask('app_pos', 'sync_data', async () => {
        // Mock task
      });

      expect(taskId).toContain('bg_app_pos');
      const tasks = runtimeService.getAppBackgroundTasks('app_pos');
      expect(tasks.length).toBe(1);

      await runtimeService.terminateApp('app_pos', 'User requested');
      expect(runtimeService.getAppState('app_pos')).toBe('unmounted');
    });

    it('should handle app crash and apply restart policy', async () => {
      runtimeService.updateInstanceState('app_pos', 'active');
      runtimeService.setRestartPolicy('app_pos', 'always', 2);

      await runtimeService.handleAppCrash('app_pos', new Error('Uncaught NullPointer'));
      expect(runtimeService.getAppState('app_pos')).toBe('initializing');
    });

    it('should sandbox OsContext events and automatically cleanup subscriptions on terminateApp', async () => {
      let unsubCalled = false;
      const ctx = runtimeService.createContext('app_pos', 'comp_1', 'Empresa 1');
      expect(ctx.appId).toBe('app_pos');

      // Subscribe through isolated context
      const sub = ctx.events.subscribe('order.placed', () => undefined);
      expect(sub).toBeDefined();

      // Register an explicit subscription tracker
      runtimeService.registerSubscription('app_pos', () => {
        unsubCalled = true;
      });

      // Terminating app must clean up all subscriptions
      await runtimeService.terminateApp('app_pos');
      expect(unsubCalled).toBe(true);
      expect(runtimeService.getAppState('app_pos')).toBe('unmounted');
    });

    it('should update process supervisor with continuous background execution on pause', () => {
      runtimeService.updateInstanceState('app_pos', 'active');
      expect(runtimeService.getAppState('app_pos')).toBe('active');

      runtimeService.updateInstanceState('app_pos', 'paused');
      expect(runtimeService.getAppState('app_pos')).toBe('paused');

      runtimeService.updateInstanceState('app_pos', 'active');
      expect(runtimeService.getAppState('app_pos')).toBe('active');
    });
  });
});
