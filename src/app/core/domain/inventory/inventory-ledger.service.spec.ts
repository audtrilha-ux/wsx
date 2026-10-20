import { TestBed } from '@angular/core/testing';
import { InventoryLedgerService } from './inventory-ledger.service';
import { ProductMasterService } from '../product/product-master.service';
import { OsDatabaseService } from '../../storage/os-database.service';
import { SyncService } from '../../sync/sync.service';
import { DiagnosticsService } from '../../diagnostics/diagnostics.service';

describe('InventoryLedgerService — Central Ledger, Movements & Reservations', () => {
  let service: InventoryLedgerService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    const mockDb = {
      getNamespace: () => ({
        query: async () => [],
        put: async () => undefined
      })
    };

    const mockProductService = {
      products: () => [
        {
          id: 'prd_01',
          name: 'Suco de Laranja 500ml',
          sku: 'SUC-01',
          stockQuantity: 50,
          reservedQuantity: 0,
          costPrice: 3.00,
          salePrice: 8.00
        }
      ],
      saveProduct: async (p: unknown) => p
    };

    const mockSync = { 
      queueOperationTransacted: async () => undefined,
      queueOperation: async () => undefined 
    };
    const mockDiagnostics = { info: () => true, warn: () => true, error: () => true };

    TestBed.configureTestingModule({
      providers: [
        InventoryLedgerService,
        { provide: ProductMasterService, useValue: mockProductService },
        { provide: OsDatabaseService, useValue: mockDb },
        { provide: SyncService, useValue: mockSync },
        { provide: DiagnosticsService, useValue: mockDiagnostics }
      ]
    });

    service = TestBed.inject(InventoryLedgerService);
  });

  it('should record stock entry (IN movement)', async () => {
    const mvt = await service.recordMovement({
      companyId: 'cmp_01',
      branchId: 'br_01',
      productId: 'prd_01',
      type: 'IN',
      quantity: 20,
      operatorId: 'op_01',
      operatorName: 'João Estoquista',
      reason: 'Compra Fornecedor NF-1020'
    });

    expect(mvt).toBeTruthy();
    expect(mvt.previousStock).toBe(50);
    expect(mvt.newStock).toBe(70);
  });

  it('should record stock loss (LOSS movement)', async () => {
    const mvt = await service.recordMovement({
      companyId: 'cmp_01',
      branchId: 'br_01',
      productId: 'prd_01',
      type: 'LOSS',
      quantity: 5,
      operatorId: 'op_01',
      operatorName: 'João Estoquista',
      reason: 'Avaria/Vencimento'
    });

    expect(mvt.previousStock).toBe(50);
    expect(mvt.newStock).toBe(45);
  });

  it('should reserve stock for order', async () => {
    const res = await service.reserveStock({
      companyId: 'cmp_01',
      branchId: 'br_01',
      warehouseId: 'wh_main',
      productId: 'prd_01',
      quantity: 10,
      orderReference: 'ORD-5501'
    });

    expect(res).toBeTruthy();
    expect(res.quantity).toBe(10);
  });
});
