import { Injectable, inject } from '@angular/core';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { InventoryRepository } from '../domain/inventory.repository';
import { InventoryItem, StockMovement } from '../domain/inventory.entity';
import { OsDatabaseNamespace } from '../../../contracts/os/os-database.contract';

@Injectable({
  providedIn: 'root'
})
export class OsInventoryRepository implements InventoryRepository {
  private osSdk = inject(OsSdkService);
  private storage: OsDatabaseNamespace;

  constructor() {
    // Vinculação canônica pelo SDK para isolamento de tenant automático (tenant.[companyId].app.app_inventory)
    const app = this.osSdk.bind('app_inventory');
    this.storage = app.storage;
  }

  async getItems(companyId: string): Promise<InventoryItem[]> {
    const records = await this.storage.query<InventoryItem>();
    const filtered = records
      .filter(r => !r.key.startsWith('mov_'))
      .map(r => r.value)
      .filter(item => item && item.companyId === companyId && item.sku);

    if (filtered.length > 0) return filtered;

    // Only auto-seed if we are in the default developer workspace / demo sandbox ('comp_1')
    if (companyId !== 'comp_1') {
      return [];
    }

    // Seed inicial para o catálogo de estoque do tenant de demonstração
    const seed: InventoryItem[] = [
      {
        id: `inv_${companyId}_1`,
        companyId,
        sku: 'BUR-001',
        name: 'Blend de Carne Bovina 180g',
        category: 'Insumos / Carnes',
        costPrice: 9.50,
        salePrice: 36.90,
        stockQuantity: 45,
        minStock: 20,
        unit: 'UN',
        updatedAt: new Date().toISOString()
      },
      {
        id: `inv_${companyId}_2`,
        companyId,
        sku: 'BEB-010',
        name: 'Refrigerante Cola 350ml Lata',
        category: 'Bebidas',
        costPrice: 2.80,
        salePrice: 6.50,
        stockQuantity: 120,
        minStock: 30,
        unit: 'UN',
        updatedAt: new Date().toISOString()
      },
      {
        id: `inv_${companyId}_3`,
        companyId,
        sku: 'PAO-002',
        name: 'Pão Brioche Selado Artesanal',
        category: 'Panificação',
        costPrice: 1.60,
        salePrice: 5.00,
        stockQuantity: 14,
        minStock: 25,
        unit: 'UN',
        updatedAt: new Date().toISOString()
      },
      {
        id: `inv_${companyId}_4`,
        companyId,
        sku: 'BAT-005',
        name: 'Batata Congelada Pré-Frita 2kg',
        category: 'Congelados',
        costPrice: 12.00,
        salePrice: 28.00,
        stockQuantity: 8,
        minStock: 15,
        unit: 'CX',
        updatedAt: new Date().toISOString()
      },
      {
        id: `inv_${companyId}_5`,
        companyId,
        sku: 'QUE-003',
        name: 'Queijo Cheddar Inglês Fatiado 1kg',
        category: 'Laticínios',
        costPrice: 24.50,
        salePrice: 55.00,
        stockQuantity: 18,
        minStock: 10,
        unit: 'KG',
        updatedAt: new Date().toISOString()
      }
    ];

    for (const item of seed) {
      await this.storage.put(`item_${item.id}`, item);
      await this.storage.put(item.id, item);
    }
    return seed;
  }

  async getItemById(id: string, companyId: string): Promise<InventoryItem | null> {
    const item = (await this.storage.get<InventoryItem>(`item_${id}`)) || (await this.storage.get<InventoryItem>(id));
    if (item && item.companyId !== companyId) {
      return null; // Security Tenant Mismatch Defense
    }
    return item;
  }

  async saveItem(item: InventoryItem, companyId: string): Promise<void> {
    if (item.companyId !== companyId) {
      throw new Error('Tenant Mismatch: Tentativa inválida de salvar item de estoque para outro tenant.');
    }
    const updated = {
      ...item,
      updatedAt: new Date().toISOString()
    };
    await this.storage.put(`item_${item.id}`, updated);
    await this.storage.put(item.id, updated);

    const app = this.osSdk.bind('app_inventory');
    app.events.publish('inventory.item.saved', updated);
    await app.sync.queueOperation('stock.item.save', updated);
    app.logger.info(`Item de estoque ${item.sku} salvo`, { id: item.id, name: item.name });
  }

  async adjustStock(itemId: string, delta: number, reason: string, companyId: string): Promise<InventoryItem> {
    // Perform adjust stock using a robust transaction block to guarantee atomic balance update
    return this.storage.transaction<InventoryItem>(async (tx) => {
      const item = (await tx.get<InventoryItem>(`item_${itemId}`)) || (await tx.get<InventoryItem>(itemId));
      if (!item) {
        throw new Error(`Item de estoque #${itemId} não encontrado.`);
      }
      if (item.companyId !== companyId) {
        throw new Error(`Tenant Mismatch: Tentativa de ajustar item de outro tenant.`);
      }

      const previousStock = item.stockQuantity;
      const newStock = previousStock + delta;
      
      // Regra de Negócio: Impedir que o estoque fique negativo e lançar erro explícito
      if (newStock < 0) {
        throw new Error(`Estoque Insuficiente: Saldo atual é de ${previousStock} ${item.unit || 'UN'}, saída solicitada de ${Math.abs(delta)} é inválida.`);
      }

      const updatedItem: InventoryItem = {
        ...item,
        stockQuantity: newStock,
        updatedAt: new Date().toISOString()
      };

      await tx.put(`item_${item.id}`, updatedItem);
      await tx.put(item.id, updatedItem);

      // Registra movimentação de auditoria
      const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
      const movement: StockMovement = {
        id: `mov_${uuid}`,
        itemId: item.id,
        companyId: item.companyId,
        type: delta > 0 ? 'IN' : (delta < 0 ? 'OUT' : 'ADJUST'),
        quantity: Math.abs(delta),
        previousStock,
        newStock,
        reason: reason || 'Ajuste operacional de inventário',
        timestamp: new Date().toISOString()
      };

      await this.storage.put(`mov_${movement.id}`, movement);

      const app = this.osSdk.bind('app_inventory');
      app.events.publish('inventory.stock.adjusted', { item: updatedItem, movement });
      await app.sync.queueOperation('stock.adjust', {
        productId: item.id,
        newStock,
        delta,
        reason: reason || 'Ajuste operacional de inventário'
      });
      app.logger.info(`Estoque ajustado para ${item.name}`, { previousStock, newStock, delta });

      return updatedItem;
    });
  }

  async getMovements(companyId: string, limit = 20): Promise<StockMovement[]> {
    const records = await this.storage.query<StockMovement>();
    const movements = records
      .filter(r => r.key.startsWith('mov_'))
      .map(r => r.value)
      .filter(m => m && m.companyId === companyId && m.itemId);

    movements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return movements.slice(0, limit);
  }
}
