import { TestBed } from '@angular/core/testing';
import { ProductMasterService } from './product-master.service';
import { OsDatabaseService } from '../../storage/os-database.service';
import { SyncService } from '../../sync/sync.service';
import { DiagnosticsService } from '../../diagnostics/diagnostics.service';

describe('ProductMasterService — Product Master & Variant Management', () => {
  let service: ProductMasterService;

  beforeEach(() => {
    const mockDb = {
      getNamespace: () => ({
        query: async () => [],
        put: async () => undefined
      })
    };
    const mockSync = {
      queueOperation: async () => undefined,
      queueOperationTransacted: async () => undefined
    };
    const mockDiagnostics = { info: () => true, warn: () => true, error: () => true };

    TestBed.configureTestingModule({
      providers: [
        ProductMasterService,
        { provide: OsDatabaseService, useValue: mockDb },
        { provide: SyncService, useValue: mockSync },
        { provide: DiagnosticsService, useValue: mockDiagnostics }
      ]
    });

    service = TestBed.inject(ProductMasterService);
  });

  it('should save new product with canonical SKU and barcodes', async () => {
    const saved = await service.saveProduct({
      companyId: 'cmp_01',
      sku: 'SKU-100',
      name: 'Café Espresso Gourmet',
      salePrice: 7.50,
      barcodes: ['7890000100', 'SKU-100']
    });

    expect(saved).toBeTruthy();
    expect(saved.canonicalSku).toBe('SKU-100');
    expect(saved.barcodes).toContain('7890000100');
  });

  it('should add variants to existing product', async () => {
    const saved = await service.saveProduct({
      companyId: 'cmp_01',
      sku: 'CAM-01',
      name: 'Camiseta Algodão',
      salePrice: 49.90
    });

    const updated = await service.addVariant(saved.id, {
      sku: 'CAM-01-G',
      name: 'Camiseta Algodão - Tamanho G',
      options: [{ name: 'Tamanho', value: 'G' }],
      barcodes: ['7890000001'],
      costPrice: 20,
      salePrice: 49.90,
      stockQuantity: 10,
      minStock: 2,
      status: 'active'
    }, 'cmp_01');

    expect(updated?.hasVariants).toBe(true);
    expect(updated?.variants.length).toBe(1);
    expect(updated?.variants[0].sku).toBe('CAM-01-G');
  });

  it('should search product by barcode or SKU', async () => {
    await service.saveProduct({
      companyId: 'cmp_01',
      sku: 'PIZ-01',
      name: 'Pizza Calabresa',
      salePrice: 45.00,
      barcodes: ['7891234567890']
    });

    const found = service.findByBarcodeOrSku('7891234567890');
    expect(found).toBeTruthy();
    expect(found?.name).toBe('Pizza Calabresa');
  });
});
