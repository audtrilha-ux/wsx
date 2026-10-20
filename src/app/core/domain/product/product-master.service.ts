import { Injectable, signal, inject } from '@angular/core';
import { ProductMaster, ProductVariant, WarehouseLocation } from '../../../contracts/inventory/product-master.contract';
import { OsDatabaseService } from '../../storage/os-database.service';
import { SyncService } from '../../sync/sync.service';
import { DiagnosticsService } from '../../diagnostics/diagnostics.service';

@Injectable({
  providedIn: 'root'
})
export class ProductMasterService {
  private osDb = inject(OsDatabaseService);
  private syncService = inject(SyncService);
  private diagnostics = inject(DiagnosticsService);

  private readonly productsSignal = signal<ProductMaster[]>([]);
  readonly products = this.productsSignal.asReadonly();

  private readonly warehousesSignal = signal<WarehouseLocation[]>([
    { id: 'wh_main', code: 'DEP-01', name: 'Depósito Central / Loja Principal', branchId: 'br_main', isMain: true },
    { id: 'wh_sec', code: 'DEP-02', name: 'Almoxarifado Secundário', branchId: 'br_main', isMain: false }
  ]);
  readonly warehouses = this.warehousesSignal.asReadonly();

  constructor() {
    this.loadProductsFromStorage();
  }

  async loadProductsFromStorage(companyId = 'cmp_default'): Promise<void> {
    try {
      const ns = this.osDb.getNamespace(`tenant.${companyId}.products`);
      const stored = await ns.query<ProductMaster>();
      if (stored && stored.length > 0) {
        this.productsSignal.set(stored.map(s => s.value));
      } else {
        // Inicializa catálogo padrão inicial se vazio
        await this.seedInitialProducts(companyId);
      }
    } catch (err) {
      this.diagnostics.warn('[ProductMaster] Erro ao carregar catálogo do banco do OS:', { error: String(err) });
    }
  }

  async saveProduct(product: Partial<ProductMaster> & { name: string; sku: string; salePrice: number; companyId: string }): Promise<ProductMaster> {
    const now = new Date();
    const productId = product.id || `prd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    const canonicalSku = product.canonicalSku || product.sku.toUpperCase().trim();
    const barcodes = product.barcodes && product.barcodes.length > 0 ? Array.from(new Set(product.barcodes)) : [product.sku];

    const fullProduct: ProductMaster = {
      id: productId,
      companyId: product.companyId,
      branchId: product.branchId || 'br_main',
      sku: product.sku,
      canonicalSku,
      name: product.name,
      category: product.category || 'Geral',
      costPrice: product.costPrice || 0,
      salePrice: product.salePrice,
      stockQuantity: product.stockQuantity || 0,
      reservedQuantity: product.reservedQuantity || 0,
      minStock: product.minStock || 5,
      unit: product.unit || 'UN',
      barcodes,
      warehouses: product.warehouses || [
        { warehouseId: 'wh_main', warehouseName: 'Depósito Central', stockQuantity: product.stockQuantity || 0, reservedQuantity: 0 }
      ],
      hasVariants: !!(product.variants && product.variants.length > 0),
      variants: product.variants || [],
      status: product.status || 'active',
      links: product.links || {
        pos: true,
        inventory: true,
        publicSpace: true,
        delivery: false
      },
      createdAt: product.createdAt || now,
      updatedAt: now
    };

    // Salva no banco local do tenant
    const ns = this.osDb.getNamespace(`tenant.${product.companyId}.products`);
    await ns.put(productId, fullProduct);

    // Notifica outbox de sincronismo
    await this.syncService.queueOperation('products.update', fullProduct);

    // Atualiza estado reativo
    this.productsSignal.update(list => {
      const idx = list.findIndex(p => p.id === productId);
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = fullProduct;
        return copy;
      }
      return [fullProduct, ...list];
    });

    this.diagnostics.info(`[ProductMaster] Produto '${fullProduct.name}' (SKU: ${fullProduct.sku}) salvo com sucesso.`);
    return fullProduct;
  }

  async addBarcode(productId: string, newBarcode: string, companyId = 'cmp_default'): Promise<boolean> {
    const product = this.products().find(p => p.id === productId);
    if (!product) return false;

    if (!product.barcodes.includes(newBarcode)) {
      const updatedBarcodes = [...product.barcodes, newBarcode];
      await this.saveProduct({
        ...product,
        barcodes: updatedBarcodes,
        companyId
      });
      return true;
    }
    return false;
  }

  async addVariant(productId: string, variant: Omit<ProductVariant, 'id'>, companyId = 'cmp_default'): Promise<ProductMaster | null> {
    const product = this.products().find(p => p.id === productId);
    if (!product) return null;

    const variantId = `vrt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const fullVariant: ProductVariant = {
      ...variant,
      id: variantId
    };

    const updatedVariants = [...product.variants, fullVariant];
    return await this.saveProduct({
      ...product,
      hasVariants: true,
      variants: updatedVariants,
      companyId
    });
  }

  findByBarcodeOrSku(term: string): ProductMaster | null {
    const cleanTerm = term.trim().toLowerCase();
    return this.products().find(p => 
      p.sku.toLowerCase() === cleanTerm ||
      p.canonicalSku.toLowerCase() === cleanTerm ||
      p.barcodes.some(b => b.toLowerCase() === cleanTerm) ||
      p.variants.some(v => v.sku.toLowerCase() === cleanTerm || v.barcodes.some(vb => vb.toLowerCase() === cleanTerm))
    ) || null;
  }

  private async seedInitialProducts(companyId: string): Promise<void> {
    const seeds: (Partial<ProductMaster> & { name: string; sku: string; salePrice: number; companyId: string })[] = [
      {
        companyId,
        sku: 'BEB-001',
        name: 'Refrigerante Coca-Cola 350ml',
        category: 'Bebidas',
        costPrice: 2.50,
        salePrice: 6.50,
        stockQuantity: 120,
        unit: 'UN',
        barcodes: ['7894900011517', 'BEB-001'],
        hasVariants: false,
        variants: []
      },
      {
        companyId,
        sku: 'HAM-002',
        name: 'Hambúrguer Artesanal Smash Bacon',
        category: 'Lanches',
        costPrice: 12.00,
        salePrice: 28.90,
        stockQuantity: 45,
        unit: 'UN',
        barcodes: ['HAM-002', '7891000000002'],
        hasVariants: true,
        variants: [
          {
            id: 'vrt_smash_simples',
            sku: 'HAM-002-SMP',
            name: 'Smash Simples (1 Carne)',
            options: [{ name: 'Tamanho', value: 'Simples' }],
            barcodes: ['7891000000021'],
            costPrice: 9.00,
            salePrice: 22.90,
            stockQuantity: 25,
            minStock: 5,
            status: 'active'
          },
          {
            id: 'vrt_smash_duplo',
            sku: 'HAM-002-DPL',
            name: 'Smash Duplo (2 Carnes)',
            options: [{ name: 'Tamanho', value: 'Duplo' }],
            barcodes: ['7891000000022'],
            costPrice: 14.00,
            salePrice: 32.90,
            stockQuantity: 20,
            minStock: 5,
            status: 'active'
          }
        ]
      }
    ];

    for (const s of seeds) {
      await this.saveProduct(s);
    }
  }
}
