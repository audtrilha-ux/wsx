import { TestBed } from '@angular/core/testing';
import { OsInventoryRepository } from './os-inventory.repository';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { InventoryItem } from '../domain/inventory.entity';
import { OsDatabaseTransaction } from '../../../contracts/os/os-database.contract';

interface MockEvent {
  eventName: string;
  payload: unknown;
}

interface MockOp {
  action: string;
  payload: unknown;
}

describe('OsInventoryRepository', () => {
  let repository: OsInventoryRepository;
  let publishedEvents: MockEvent[] = [];
  let queuedOperations: MockOp[] = [];

  beforeEach(() => {
    publishedEvents = [];
    queuedOperations = [];

    // Memory Store
    const store = new Map<string, unknown>();

    const mockStorage = {
      namespace: 'test',
      get: async <T = unknown>(key: string): Promise<T | null> => {
        return (store.get(key) as T) || null;
      },
      put: async <T = unknown>(key: string, value: T): Promise<void> => {
        store.set(key, value);
      },
      delete: async (key: string): Promise<void> => {
        store.delete(key);
      },
      query: async <T = unknown>(): Promise<{ key: string; value: T }[]> => {
        return Array.from(store.entries()).map(([key, value]) => ({ key, value: value as T }));
      },
      clear: async (): Promise<void> => {
        store.clear();
      },
      transaction: async <R>(callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R> => {
        const tx: OsDatabaseTransaction = {
          get: async <T = unknown>(key: string): Promise<T | null> => {
            return (store.get(key) as T) || null;
          },
          put: async <T = unknown>(key: string, value: T): Promise<void> => {
            store.set(key, value);
          },
          delete: async (key: string): Promise<void> => {
            store.delete(key);
          }
        };
        return callback(tx);
      }
    };

    const mockOsSdk = {
      bind: () => ({
        companyId: 'comp_1',
        companyName: 'Test Company',
        isOnline: true,
        storage: mockStorage,
        events: {
          publish: (eventName: string, payload: unknown) => {
            publishedEvents.push({ eventName, payload });
          },
          subscribe: () => {
            return { unsubscribe: () => {
              const noop = 'noop';
              return noop;
            } };
          }
        },
        sync: {
          queueOperation: async (action: string, payload: unknown) => {
            queuedOperations.push({ action, payload });
          }
        },
        logger: {
          info: (msg: string) => {
            const temp = msg;
            return temp;
          },
          error: (msg: string) => {
            const temp = msg;
            return temp;
          }
        },
        notify: () => {
          const noop = 'noop';
          return noop;
        }
      })
    };

    TestBed.configureTestingModule({
      providers: [
        OsInventoryRepository,
        { provide: OsSdkService, useValue: mockOsSdk }
      ]
    });

    repository = TestBed.inject(OsInventoryRepository);
  });

  it('should seed default products for demo tenant comp_1', async () => {
    const items = await repository.getItems('comp_1');
    expect(items.length).toBe(5);
    expect(items[0].sku).toBe('BUR-001');
    expect(items[0].stockQuantity).toBe(45);
  });

  it('should register a custom product master with barcode and active status', async () => {
    const customItem: InventoryItem = {
      id: 'inv_comp_1_custom',
      companyId: 'comp_1',
      sku: 'PRD-123',
      name: 'Test Premium Product',
      category: 'Test Category',
      costPrice: 50.00,
      salePrice: 120.00,
      stockQuantity: 10,
      minStock: 2,
      unit: 'UN',
      barcode: '7891234567890',
      status: 'active',
      updatedAt: ''
    };

    await repository.saveItem(customItem, 'comp_1');

    const retrieved = await repository.getItemById('inv_comp_1_custom', 'comp_1');
    expect(retrieved).toBeTruthy();
    expect(retrieved?.sku).toBe('PRD-123');
    expect(retrieved?.barcode).toBe('7891234567890');
    expect(retrieved?.status).toBe('active');
  });

  it('should adjust stock correctly and record detailed movements', async () => {
    const customItem: InventoryItem = {
      id: 'inv_comp_1_test_adjust',
      companyId: 'comp_1',
      sku: 'ADJ-001',
      name: 'Adjustable Item',
      category: 'General',
      costPrice: 10.00,
      salePrice: 20.00,
      stockQuantity: 15,
      minStock: 5,
      unit: 'UN',
      status: 'active',
      updatedAt: ''
    };

    await repository.saveItem(customItem, 'comp_1');

    // Add +5 items
    const updated = await repository.adjustStock('inv_comp_1_test_adjust', 5, 'Chegada de mercadoria', 'comp_1');
    expect(updated.stockQuantity).toBe(20);

    // Retrieve ledger history
    const movements = await repository.getMovements('comp_1');
    expect(movements.length).toBe(1);
    expect(movements[0].itemId).toBe('inv_comp_1_test_adjust');
    expect(movements[0].type).toBe('IN');
    expect(movements[0].quantity).toBe(5);
    expect(movements[0].previousStock).toBe(15);
    expect(movements[0].newStock).toBe(20);
    expect(movements[0].reason).toBe('Chegada de mercadoria');
  });

  it('should reject stock adjustments that would cause negative quantities', async () => {
    const item: InventoryItem = {
      id: 'inv_comp_1_low_stock',
      companyId: 'comp_1',
      sku: 'LOW-01',
      name: 'Limited Item',
      category: 'General',
      costPrice: 1.00,
      salePrice: 2.00,
      stockQuantity: 3,
      minStock: 1,
      unit: 'UN',
      status: 'active',
      updatedAt: ''
    };

    await repository.saveItem(item, 'comp_1');

    // Try to subtract 5, which would leave -2.
    let error: Error | null = null;
    try {
      await repository.adjustStock('inv_comp_1_low_stock', -5, 'Saída excessiva', 'comp_1');
    } catch (err: unknown) {
      error = err as Error;
    }

    expect(error).toBeTruthy();
    expect(error?.message).toContain('Estoque Insuficiente');
  });
});
