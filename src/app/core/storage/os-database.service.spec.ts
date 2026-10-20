import { TestBed } from '@angular/core/testing';
import { OsDatabaseService } from './os-database.service';
import { OS_DATABASE_ADAPTER, IOsDatabaseAdapter, OsDatabaseTransaction } from '../../contracts/os/os-database.contract';

class MockDatabaseAdapter implements IOsDatabaseAdapter {
  getCalls: { namespace: string; key: string }[] = [];
  putCalls: { namespace: string; key: string; value: unknown }[] = [];
  deleteCalls: { namespace: string; key: string }[] = [];

  async get<T>(namespace: string, key: string): Promise<T | null> {
    this.getCalls.push({ namespace, key });
    return null;
  }

  async put<T>(namespace: string, key: string, value: T): Promise<void> {
    this.putCalls.push({ namespace, key, value });
  }

  async delete(namespace: string, key: string): Promise<void> {
    this.deleteCalls.push({ namespace, key });
  }

  async query<T>(): Promise<{ key: string; value: T }[]> {
    return [];
  }

  async clear(): Promise<void> {
    // Mock implementation
  }

  async transaction<R>(_namespace: string, callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R> {
    const tx: OsDatabaseTransaction = {
      get: async () => null,
      put: async () => {
        // Mock implementation
      },
      delete: async () => {
        // Mock implementation
      }
    };
    return callback(tx);
  }

  async migrate(): Promise<void> {
    // Mock implementation
  }

  async backup(): Promise<Blob | null> {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'mock',
      records: [{ namespace: 'ns1', key: 'k1', value: { a: 1 } }]
    };
    return new Blob([JSON.stringify(payload)], { type: 'application/json' });
  }

  async restore(): Promise<{ success: boolean; recordCount: number }> {
    return { success: true, recordCount: 1 };
  }
}

describe('OsDatabaseService', () => {
  let service: OsDatabaseService;
  let mockAdapter: MockDatabaseAdapter;

  beforeEach(() => {
    mockAdapter = new MockDatabaseAdapter();

    TestBed.configureTestingModule({
      providers: [
        OsDatabaseService,
        {
          provide: OS_DATABASE_ADAPTER,
          useValue: mockAdapter
        }
      ]
    });

    service = TestBed.inject(OsDatabaseService);
  });

  it('should be created and bind namespace correctly', () => {
    expect(service).toBeTruthy();
    const ns = service.getNamespace('test_ns');
    expect(ns).toBeTruthy();
  });

  it('should delegate CRUD calls to the adapter', async () => {
    const ns = service.getNamespace('test_ns');
    await ns.get('key1');
    expect(mockAdapter.getCalls.length).toBe(1);
    expect(mockAdapter.getCalls[0]).toEqual({ namespace: 'test_ns', key: 'key1' });

    await ns.put('key2', { val: 42 });
    expect(mockAdapter.putCalls.length).toBe(1);
    expect(mockAdapter.putCalls[0]).toEqual({ namespace: 'test_ns', key: 'key2', value: { val: 42 } });

    await ns.delete('key3');
    expect(mockAdapter.deleteCalls.length).toBe(1);
    expect(mockAdapter.deleteCalls[0]).toEqual({ namespace: 'test_ns', key: 'key3' });
  });

  it('should verify backup payload integrity', async () => {
    const backupBlob = await service.backup();
    expect(backupBlob).toBeTruthy();

    const verification = await service.verifyBackup(backupBlob!);
    expect(verification.valid).toBe(true);
    expect(verification.recordCount).toBe(1);
  });

  it('should export and import database payloads', async () => {
    const exportedBlob = await service.exportDatabase();
    expect(exportedBlob).toBeTruthy();

    const importResult = await service.importDatabase(exportedBlob);
    expect(importResult.success).toBe(true);
    expect(importResult.recordCount).toBe(1);
  });

  it('should recover corrupted database using migrations', async () => {
    const result = await service.recoverCorruptedDatabase();
    expect(result.recovered).toBe(true);
    expect(result.details).toContain('restaurado');
  });
});
