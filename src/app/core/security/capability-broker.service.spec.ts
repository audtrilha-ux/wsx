import { TestBed } from '@angular/core/testing';
import { CapabilityBrokerService } from './capability-broker.service';
import { OsDatabaseService } from '../storage/os-database.service';
import { IdentityService } from '../identity/identity.service';
import { DeviceService } from '../device/device.service';

class MockNamespace {
  private store = new Map<string, unknown>();

  constructor(public name: string) {}

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) || null;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async query<T>(): Promise<{ key: string; value: T }[]> {
    const list: { key: string; value: T }[] = [];
    this.store.forEach((value, key) => list.push({ key, value: value as T }));
    return list;
  }
}

describe('CapabilityBrokerService', () => {
  let service: CapabilityBrokerService;
  let namespaces: Map<string, MockNamespace>;

  beforeEach(() => {
    namespaces = new Map();

    const mockOsDbService = {
      getNamespace: (nsName: string) => {
        if (!namespaces.has(nsName)) {
          namespaces.set(nsName, new MockNamespace(nsName));
        }
        return namespaces.get(nsName)!;
      }
    };

    const mockIdentityService = {
      currentTenant: () => ({ tenantId: 'tenant_test' })
    };

    const mockDeviceService = {
      deviceState: () => ({ companyId: 'tenant_test' })
    };

    TestBed.configureTestingModule({
      providers: [
        CapabilityBrokerService,
        { provide: OsDatabaseService, useValue: mockOsDbService },
        { provide: IdentityService, useValue: mockIdentityService },
        { provide: DeviceService, useValue: mockDeviceService }
      ]
    });

    service = TestBed.inject(CapabilityBrokerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should automatically grant capabilities to system core apps', async () => {
    const hasStorage = await service.hasCapability('sys.pos', 'storage.read');
    const hasPrinter = await service.hasCapability('sys.pos', 'printer');

    expect(hasStorage).toBe(true);
    expect(hasPrinter).toBe(true);
  });

  it('should deny ungranted capabilities for external apps', async () => {
    const hasPrinter = await service.hasCapability('ext.custom_app', 'printer');
    expect(hasPrinter).toBe(false);
  });

  it('should allow dynamic grant and revocation for external apps', async () => {
    await service.grantCapability('ext.custom_app', 'printer', 'admin_user');
    let hasPrinter = await service.hasCapability('ext.custom_app', 'printer');
    expect(hasPrinter).toBe(true);

    await service.revokeCapability('ext.custom_app', 'printer');
    hasPrinter = await service.hasCapability('ext.custom_app', 'printer');
    expect(hasPrinter).toBe(false);
  });

  it('should enforce capabilities and throw when ungranted', async () => {
    await expect(service.enforceCapability('ext.custom_app', 'payment')).rejects.toThrow(
      /Acesso negado/
    );

    await service.grantCapability('ext.custom_app', 'payment');
    await expect(service.enforceCapability('ext.custom_app', 'payment')).resolves.toBeUndefined();
  });

  it('should record audit logs for capability evaluations', async () => {
    await service.grantCapability('ext.custom_app', 'hardware.scan');
    await service.hasCapability('ext.custom_app', 'hardware.scan');

    const logs = await service.getAuditLogs('ext.custom_app');
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.some(l => l.capability === 'hardware.scan' && l.action === 'grant')).toBe(true);
  });
});
