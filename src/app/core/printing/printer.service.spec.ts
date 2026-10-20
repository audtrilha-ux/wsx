import { TestBed } from '@angular/core/testing';
import { PrinterService } from './printer.service';
import { HardwareService } from '../hardware/hardware.service';
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

describe('PrinterService', () => {
  let service: PrinterService;
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
      currentTenant: () => ({ tenantId: 'tenant_print_test' })
    };

    const mockDeviceService = {
      deviceState: () => ({ companyId: 'tenant_print_test' })
    };

    TestBed.configureTestingModule({
      providers: [
        PrinterService,
        HardwareService,
        { provide: OsDatabaseService, useValue: mockOsDbService },
        { provide: IdentityService, useValue: mockIdentityService },
        { provide: DeviceService, useValue: mockDeviceService }
      ]
    });
    service = TestBed.inject(PrinterService);
  });

  it('should initialize with default profile and online status', () => {
    expect(service).toBeTruthy();
    expect(service.profile().paperWidth).toBe('80mm');
    expect(service.isPrinterOnline()).toBe(true);
    expect(service.hasPaper()).toBe(true);
  });

  it('should format templates according to paper profile', () => {
    const formatted = service.formatTemplate('Item: Cafe R$ 5,00', '80mm');
    expect(formatted).toContain('3EATCRU OS - RECIBO');
    expect(formatted).toContain('Item: Cafe R$ 5,00');
    expect(formatted).toContain('Obrigado pela preferência!');
  });

  it('should queue print jobs and update status in database', async () => {
    const success = await service.print('Cupom de Venda #1001', 'Venda Teste', '80mm', 1);

    expect(success).toBe(true);
    expect(service.jobs().length).toBeGreaterThan(0);
    const job = service.jobs().find(j => j.title === 'Cupom de Venda #1001');
    expect(job).toBeDefined();
    expect(job?.title).toBe('Cupom de Venda #1001');
  });
});
