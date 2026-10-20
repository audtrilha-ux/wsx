import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SyncService, OutboxOperation } from './sync.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { IdentityService } from '../identity/identity.service';
import { OsDatabaseService } from '../storage/os-database.service';
import { DeviceService } from '../device/device.service';
import { ConflictResolverService } from './conflict-resolver.service';
import { OsDatabaseNamespace, OsDatabaseTransaction } from '../../contracts/os/os-database.contract';

interface DummySale {
  id: string;
  companyId?: string;
  total?: number;
}

interface DummyProduct {
  id: string;
  companyId?: string;
  name?: string;
}

class MockNamespace implements OsDatabaseNamespace {
  constructor(public namespace: string, public store = new Map<string, unknown>()) {}

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async query<T>(): Promise<{ key: string; value: T }[]> {
    return Array.from(this.store.entries()).map(([key, value]) => ({ key, value: value as T }));
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async transaction<R>(callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R> {
    const tx: OsDatabaseTransaction = {
      get: async (k) => {
        return this.get(k);
      },
      put: async (k, v) => {
        await this.put(k, v);
      },
      delete: async (k) => {
        await this.delete(k);
      }
    };
    return callback(tx);
  }
}

describe('SyncService', () => {
  let service: SyncService;
  let httpMock: HttpTestingController;
  let mockDbService: { getNamespace: (ns: string) => OsDatabaseNamespace };
  let mockDeviceService: { deviceState: ReturnType<typeof signal> };
  let mockIdentityService: { isOfflineFirstEnabled: () => boolean; currentTenant: ReturnType<typeof signal>; currentSession: ReturnType<typeof signal> };
  let syncNamespace: MockNamespace;
  let salesNamespace: MockNamespace;
  let productsNamespace: MockNamespace;

  beforeEach(() => {
    syncNamespace = new MockNamespace('tenant.tenant_abc.system.sync');
    salesNamespace = new MockNamespace('tenant.tenant_abc.sales');
    productsNamespace = new MockNamespace('tenant.tenant_abc.products');

    mockDbService = {
      getNamespace: (ns: string) => {
        if (ns.includes('sync')) return syncNamespace;
        if (ns.includes('sales')) return salesNamespace;
        if (ns.includes('products')) return productsNamespace;
        return new MockNamespace(ns);
      }
    };

    mockDeviceService = {
      deviceState: signal({
        deviceId: 'dev_123',
        companyId: 'tenant_abc',
        branchId: 'branch_xyz',
        platform: 'web' as const,
        osVersion: '1.0.0',
        appVersion: '1.0.0',
        status: 'active' as const,
        lastSeen: new Date(),
        pairedAt: new Date()
      })
    };

    mockIdentityService = {
      isOfflineFirstEnabled: () => true,
      currentTenant: signal({ tenantId: 'tenant_abc', name: 'Test Tenant' }),
      currentSession: signal({ token: 'test-token' })
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SyncService,
        { provide: OsDatabaseService, useValue: mockDbService },
        { provide: DeviceService, useValue: mockDeviceService },
        { provide: IdentityService, useValue: mockIdentityService },
        ConflictResolverService
      ]
    });

    service = TestBed.inject(SyncService);
    service.networkOnline.set(false);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should queue operations with full ACID transaction guarantees', async () => {
    const fakeTx: OsDatabaseTransaction = {
      get: async () => null,
      put: async (k, v) => {
        await syncNamespace.put(k, v);
      },
      delete: async (k) => {
        await syncNamespace.delete(k);
      }
    };

    await service.queueOperationTransacted(fakeTx, 'sales.create', { id: 'sale_999', total: 150 });

    // Verify outbox signal is immediately updated
    const list = service.outbox();
    expect(list.length).toBe(1);
    expect(list[0].action).toBe('sales.create');
    const payload = list[0].payload as DummySale;
    expect(payload.id).toBe('sale_999');

    // Verify written to database inside the transaction namespace
    const dbRecord = await syncNamespace.get<OutboxOperation>(`outbox_${list[0].id}`);
    expect(dbRecord).toBeTruthy();
    expect(dbRecord?.action).toBe('sales.create');
    expect(dbRecord?.tenantId).toBe('tenant_abc');
  });

  it('should recover stuck processing transactions on start', async () => {
    // Seed stuck operation in outbox database
    const stuckOp: OutboxOperation = {
      id: 'op_stuck',
      idempotencyKey: 'idemp_stuck',
      tenantId: 'tenant_abc',
      action: 'products.update',
      payload: { id: 'p1' },
      timestamp: new Date().toISOString(),
      status: 'processing',
      retryCount: 1
    };

    await syncNamespace.put('outbox_op_stuck', stuckOp);

    // Re-trigger loadPersistedOutbox
    await service.loadPersistedOutbox();

    // Stuck operation must be recovered to 'pending'
    const list = service.outbox();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('op_stuck');
    expect(list[0].status).toBe('pending');

    const dbRecord = await syncNamespace.get<OutboxOperation>('outbox_op_stuck');
    expect(dbRecord?.status).toBe('pending');
  });

  it('should perform bidirectional synchronization (Pull) cleanly', async () => {
    service.networkOnline.set(true);
    service.serverReachable.set(true);

    // Trigger sync/pull changes
    const pullPromise = service.pullServerChanges();

    const req = httpMock.expectOne('/api/v1/sync/pull?companyId=tenant_abc');
    expect(req.request.method).toBe('GET');

    // Respond with new entities from server
    req.flush({
      success: true,
      data: {
        sales: [{ id: 'sale_srv_1', companyId: 'tenant_abc', total: 320 }],
        products: [{ id: 'prod_srv_1', companyId: 'tenant_abc', name: 'Pulled Product' }],
        financeTransactions: [],
        customers: [],
        tables: []
      }
    });

    await pullPromise;

    // Verify data is correctly saved into respective local namespaces
    const saleLocal = await salesNamespace.get<DummySale>('sale_srv_1');
    expect(saleLocal).toBeTruthy();
    expect(saleLocal?.total).toBe(320);

    const prodLocal = await productsNamespace.get<DummyProduct>('prod_srv_1');
    expect(prodLocal).toBeTruthy();
    expect(prodLocal?.name).toBe('Pulled Product');
  });

  it('should support transacted operation queue with event log', async () => {
    const ns = mockDbService.getNamespace('tenant.tenant_abc.sales');
    await ns.transaction(async (tx) => {
      await service.queueOperationTransactedWithEvent(
        tx,
        'sale.create',
        { id: 's1', total: 100 },
        { action: 'sale.create', total: 100 }
      );
    });

    expect(service.outbox().length).toBe(1);
    expect(service.outbox()[0].action).toBe('sale.create');
  });

  it('should reconcile domain state using ConflictResolverService', async () => {
    const remoteProducts = [
      { id: 'p1', name: 'Updated Product Remote', version: 2, updatedAt: '2026-09-20T12:00:00Z' }
    ];

    await productsNamespace.put('p1', { id: 'p1', name: 'Old Local Product', version: 1, updatedAt: '2026-09-19T12:00:00Z' });

    await service.reconcileDomainState('products', remoteProducts, 'last-write-wins');

    const reconciled = await productsNamespace.get<{ id: string; name: string }>('p1');
    expect(reconciled?.name).toBe('Updated Product Remote');
  });
});

