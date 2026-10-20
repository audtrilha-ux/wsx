import { InventoryItem, StockMovement } from './inventory.entity';

export interface InventoryRepository {
  getItems(companyId: string): Promise<InventoryItem[]>;
  getItemById(id: string, companyId: string): Promise<InventoryItem | null>;
  saveItem(item: InventoryItem, companyId: string): Promise<void>;
  adjustStock(itemId: string, delta: number, reason: string, companyId: string): Promise<InventoryItem>;
  getMovements(companyId: string, limit?: number): Promise<StockMovement[]>;
}
