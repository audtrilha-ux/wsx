import { TestBed } from '@angular/core/testing';
import { OsProductRepository, OsSaleRepository } from './os-pos.repository';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { Product, Sale } from '../domain/pos.entity';

interface MockEvent {
  eventName: string;
  payload: unknown;
}

interface MockOp {
  action: string;
  payload: unknown;
}

describe('OsPosRepository', () => {
  let productRepo: OsProductRepository;
  let saleRepo: OsSaleRepository;
  let publishedEvents: MockEvent[] = [];
  let queuedOperations: MockOp[] = [];
  let store: Map<string, unknown>;

  beforeEach(() => {
    publishedEvents = [];
    queuedOperations = [];
    store = new Map<string, unknown>();

    const mockStorage = {
      namespace: 'test_pos',
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
      }
    };

    const mockOsSdk = {
      bind: () => ({
        companyId: 'comp_1',
        companyName: 'Test Burger',
        isOnline: true,
        storage: mockStorage,
        events: {
          publish: (eventName: string, payload: unknown) => {
            publishedEvents.push({ eventName, payload });
          },
          subscribe: () => {
            return { unsubscribe: () => 'noop' };
          }
        },
        sync: {
          queueOperation: async (action: string, payload: unknown) => {
            queuedOperations.push({ action, payload });
          }
        },
        logger: {
          info: (msg: string) => msg,
          warn: (msg: string) => msg,
          error: (msg: string) => msg
        },
        notify: () => 'noop'
      })
    };

    TestBed.configureTestingModule({
      providers: [
        OsProductRepository,
        OsSaleRepository,
        { provide: OsSdkService, useValue: mockOsSdk }
      ]
    });

    productRepo = TestBed.inject(OsProductRepository);
    saleRepo = TestBed.inject(OsSaleRepository);
  });

  it('should seed default products with barcodes for demo workspace comp_1', async () => {
    const products = await productRepo.getProducts('comp_1');
    expect(products.length).toBe(6);
    expect(products[0].barcode).toBe('7891111');
    expect(products[0].stock).toBe(45);
  });

  it('should register a sale and automatically decrement product stock', async () => {
    // Seed a product
    const product: Product = {
      id: 'prod_comp_1_test',
      companyId: 'comp_1',
      name: 'Burger Teste',
      price: 25.00,
      stock: 50,
      barcode: '123456789'
    };
    await store.set('prod_comp_1_test', product);

    // Create a sale of 2 items
    const saleData: Omit<Sale, 'id' | 'createdAt'> = {
      companyId: 'comp_1',
      items: [
        {
          productId: 'prod_comp_1_test',
          name: 'Burger Teste',
          price: 25.00,
          quantity: 2,
          total: 50.00
        }
      ],
      total: 50.00,
      paymentMethod: 'PIX',
      status: 'COMPLETED'
    };

    const created = await saleRepo.createSale(saleData, 'comp_1');
    expect(created.id).toContain('sale_');
    expect(created.total).toBe(50.00);

    // Check that product stock was decremented by 2
    const updatedProduct = await store.get('prod_comp_1_test') as Product;
    expect(updatedProduct).toBeTruthy();
    expect(updatedProduct.stock).toBe(48);

    // Check that event was published
    expect(publishedEvents.some(e => e.eventName === 'sale.completed')).toBe(true);
    expect(queuedOperations.some(op => op.action === 'sale.create')).toBe(true);
  });

  it('should restore product stock when cancelling a completed sale', async () => {
    // Seed a product
    const product: Product = {
      id: 'prod_comp_1_cancel',
      companyId: 'comp_1',
      name: 'Coke Special',
      price: 8.00,
      stock: 10,
      barcode: '987654321'
    };
    await store.set('prod_comp_1_cancel', product);

    // Register sale of 3 items
    const saleData: Omit<Sale, 'id' | 'createdAt'> = {
      companyId: 'comp_1',
      items: [
        {
          productId: 'prod_comp_1_cancel',
          name: 'Coke Special',
          price: 8.00,
          quantity: 3,
          total: 24.00
        }
      ],
      total: 24.00,
      paymentMethod: 'DINHEIRO',
      status: 'COMPLETED'
    };

    const created = await saleRepo.createSale(saleData, 'comp_1');
    
    // Confirm stock is now 7
    let currentProd = await store.get('prod_comp_1_cancel') as Product;
    expect(currentProd.stock).toBe(7);

    // Cancel sale
    const updatedSale = await saleRepo.updateSaleStatus(created.id, 'CANCELLED', 'comp_1');
    expect(updatedSale.status).toBe('CANCELLED');

    // Stock should be restored to 10
    currentProd = await store.get('prod_comp_1_cancel') as Product;
    expect(currentProd.stock).toBe(10);

    // Cancel event and outbox operation should be queued
    expect(publishedEvents.some(e => e.eventName === 'sale.cancelled')).toBe(true);
    expect(queuedOperations.some(op => op.action === 'sale.cancel')).toBe(true);
  });
});
