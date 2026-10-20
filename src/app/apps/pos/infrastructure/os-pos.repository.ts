import { Injectable, inject } from '@angular/core';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { ProductRepository, SaleRepository } from '../domain/pos.repository';
import { Product, Sale } from '../domain/pos.entity';
import { OsDatabaseNamespace } from '../../../contracts/os/os-database.contract';
import { OsInventoryRepository } from '../../inventory/infrastructure/os-inventory.repository';

@Injectable({
  providedIn: 'root'
})
export class OsProductRepository implements ProductRepository {
  private osSdk = inject(OsSdkService);
  private ns: OsDatabaseNamespace;
  
  constructor() {
    this.ns = this.osSdk.bind('app_pos').storage;
  }

  async getProducts(companyId: string): Promise<Product[]> {
    const items = await this.ns.query<Product>();
    const filtered = items.map((i) => i.value).filter((p) => p.companyId === companyId);
    if (filtered.length > 0) return filtered;

    // Seed conditionally: only auto-seed for the developer sandbox/demo workspace ('comp_1')
    if (companyId !== 'comp_1') {
      return [];
    }

    // Catálogo inicial de produtos para o tenant de demonstração
    const seed: Product[] = [
      { id: `prod_${companyId}_1`, companyId, name: 'Combo Burger Especial 180g', price: 36.90, stock: 45, category: 'Lanches', barcode: '7891111' },
      { id: `prod_${companyId}_2`, companyId, name: 'Refrigerante Lata 350ml', price: 6.50, stock: 120, category: 'Bebidas', barcode: '7892222' },
      { id: `prod_${companyId}_3`, companyId, name: 'Batata Rústica com Alecrim', price: 16.00, stock: 60, category: 'Acompanhamentos', barcode: '7893333' },
      { id: `prod_${companyId}_4`, companyId, name: 'Sundae de Caramelo & Nozes', price: 13.50, stock: 30, category: 'Sobremesas', barcode: '7894444' },
      { id: `prod_${companyId}_5`, companyId, name: 'Água Mineral sem Gás 500ml', price: 4.50, stock: 80, category: 'Bebidas', barcode: '7895555' },
      { id: `prod_${companyId}_6`, companyId, name: 'Suco Natural de Laranja 400ml', price: 9.90, stock: 40, category: 'Bebidas', barcode: '7896666' }
    ];

    for (const p of seed) {
      await this.ns.put(p.id, p);
    }
    return seed;
  }

  async getProductById(id: string, companyId: string): Promise<Product | null> {
    const product = await this.ns.get<Product>(id);
    if (product && product.companyId !== companyId) {
      return null; // Security Tenant Mismatch Defense
    }
    return product;
  }

  async saveProduct(product: Product, companyId: string): Promise<void> {
    if (product.companyId !== companyId) {
      throw new Error('Tenant Mismatch: Tentativa inválida de gravação de produto de outro tenant.');
    }
    await this.ns.put(product.id, product);
  }
}

@Injectable({
  providedIn: 'root'
})
export class OsSaleRepository implements SaleRepository {
  private osSdk = inject(OsSdkService);
  private ns: OsDatabaseNamespace;
  private inventoryRepo = inject(OsInventoryRepository);

  constructor() {
    this.ns = this.osSdk.bind('app_pos').storage;
  }

  async createSale(saleData: Omit<Sale, 'id' | 'createdAt'>, companyId: string): Promise<Sale> {
    if (saleData.companyId !== companyId) {
      throw new Error('Tenant Mismatch: Tentativa inválida de gravação de venda para outro tenant.');
    }

    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const newId = `sale_${uuid}`;
    const sale: Sale = {
      ...saleData,
      id: newId,
      createdAt: new Date().toISOString()
    };
    
    // Rebaixa estoque dos produtos vendidos no PDV (catálogo local e inventário)
    for (const item of sale.items) {
      const product = await this.ns.get<Product>(item.productId);
      if (product) {
        product.stock = (product.stock || 0) - item.quantity;
        await this.ns.put(product.id, product);
      }
      const inventoryItems = await this.inventoryRepo.getItems(companyId);
      const invItem = inventoryItems.find(i =>
        (product?.barcode && i.barcode === product.barcode) ||
        i.id === item.productId ||
        (product && i.name.toLowerCase() === product.name.toLowerCase())
      );
      if (invItem) {
        await this.inventoryRepo.adjustStock(invItem.id, -item.quantity, `Venda PDV #${newId}`, companyId);
      }
    }

    // Grava no storage local com namespace isolado
    await this.ns.put(newId, sale);

    // Notifica o barramento de eventos do OS
    const app = this.osSdk.bind('app_pos');
    app.events.publish('sale.completed', sale);

    // Registra na fila de sincronização outbox do OS
    await app.sync.queueOperation('sale.create', sale);

    // Registra métrica e log estruturado
    app.logger.info(`Venda #${sale.id} registrada com sucesso`, {
      saleId: sale.id,
      total: sale.total,
      paymentMethod: sale.paymentMethod
    });

    return sale;
  }

  async getSales(companyId: string): Promise<Sale[]> {
    const items = await this.ns.query<Sale>();
    return items.map((i) => i.value).filter((s) => s.companyId === companyId);
  }

  async updateSaleStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED', companyId: string): Promise<Sale> {
    const sale = await this.ns.get<Sale>(id);
    if (!sale) {
      throw new Error(`Venda #${id} não encontrada.`);
    }
    if (sale.companyId !== companyId) {
      throw new Error('Tenant Mismatch: Tentativa inválida de alterar venda de outro tenant.');
    }

    if (sale.status === status) {
      return sale;
    }

    const previousStatus = sale.status;
    sale.status = status;
    await this.ns.put(id, sale);

    const app = this.osSdk.bind('app_pos');

    // Se estiver cancelando uma venda concluída, devolve o estoque dos produtos
    if (status === 'CANCELLED' && previousStatus === 'COMPLETED') {
      for (const item of sale.items) {
        const product = await this.ns.get<Product>(item.productId);
        if (product) {
          product.stock = (product.stock || 0) + item.quantity;
          await this.ns.put(product.id, product);
        }
        const inventoryItems = await this.inventoryRepo.getItems(companyId);
        const invItem = inventoryItems.find(i =>
          (product?.barcode && i.barcode === product.barcode) ||
          i.id === item.productId ||
          (product && i.name.toLowerCase() === product.name.toLowerCase())
        );
        if (invItem) {
          await this.inventoryRepo.adjustStock(invItem.id, item.quantity, `Cancelamento PDV #${id}`, companyId);
        }
      }
      app.events.publish('sale.cancelled', sale);
      await app.sync.queueOperation('sale.cancel', { id, companyId });
    }

    app.logger.info(`Status da Venda #${id} atualizado de ${previousStatus} para ${status}`, {
      saleId: id,
      previousStatus,
      status
    });

    return sale;
  }
}
