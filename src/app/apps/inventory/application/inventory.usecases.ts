import { Injectable, inject } from '@angular/core';
import { OsInventoryRepository } from '../infrastructure/os-inventory.repository';
import { InventoryItem, StockMovement } from '../domain/inventory.entity';

@Injectable({
  providedIn: 'root'
})
export class GetInventoryItemsUseCase {
  private repo = inject(OsInventoryRepository);
  execute(companyId: string): Promise<InventoryItem[]> {
    return this.repo.getItems(companyId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class SaveInventoryItemUseCase {
  private repo = inject(OsInventoryRepository);
  execute(item: InventoryItem, companyId: string): Promise<void> {
    return this.repo.saveItem(item, companyId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class AdjustStockUseCase {
  private repo = inject(OsInventoryRepository);
  execute(itemId: string, delta: number, reason: string, companyId: string): Promise<InventoryItem> {
    return this.repo.adjustStock(itemId, delta, reason, companyId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class GetStockMovementsUseCase {
  private repo = inject(OsInventoryRepository);
  execute(companyId: string, limit = 20): Promise<StockMovement[]> {
    return this.repo.getMovements(companyId, limit);
  }
}
