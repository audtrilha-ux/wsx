import { Injectable, inject } from '@angular/core';
import { OsTableRepository } from '../infrastructure/os-table.repository';
import { CloseTableResult, DiningTable, OrderItemStatus, TableKitchenOrder, TableOrderItem } from '../domain/table.entity';

@Injectable({
  providedIn: 'root'
})
export class GetTablesUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string): Promise<DiningTable[]> {
    return this.repo.getTables(companyId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class OpenTableUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, tableId: string, customerCount: number, waiterName: string): Promise<DiningTable> {
    return this.repo.openTable(companyId, tableId, customerCount, waiterName);
  }
}

@Injectable({
  providedIn: 'root'
})
export class AddItemToOrderUseCase {
  private repo = inject(OsTableRepository);
  execute(
    companyId: string,
    tableId: string, 
    item: Omit<TableOrderItem, 'id' | 'orderedAt' | 'totalPrice' | 'status'> & { status?: OrderItemStatus }
  ): Promise<DiningTable> {
    return this.repo.addItemToOrder(companyId, tableId, item);
  }
}

@Injectable({
  providedIn: 'root'
})
export class UpdateOrderItemStatusUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, tableId: string, itemId: string, status: OrderItemStatus): Promise<DiningTable> {
    return this.repo.updateOrderItemStatus(companyId, tableId, itemId, status);
  }
}

@Injectable({
  providedIn: 'root'
})
export class CloseTableUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, tableId: string, paymentMethod: string): Promise<CloseTableResult> {
    return this.repo.closeTable(companyId, tableId, paymentMethod);
  }
}

@Injectable({
  providedIn: 'root'
})
export class ReserveTableUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, tableId: string, clientName: string, time: string, peopleCount: number, contact?: string): Promise<DiningTable> {
    return this.repo.reserveTable(companyId, tableId, clientName, time, peopleCount, contact);
  }
}

@Injectable({
  providedIn: 'root'
})
export class CancelReservationUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, tableId: string): Promise<DiningTable> {
    return this.repo.cancelReservation(companyId, tableId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class TransferTableUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, sourceTableId: string, targetTableId: string): Promise<DiningTable> {
    return this.repo.transferTable(companyId, sourceTableId, targetTableId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class CancelOrderItemUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, tableId: string, itemId: string): Promise<DiningTable> {
    return this.repo.cancelOrderItem(companyId, tableId, itemId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class ApplyDiscountUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, tableId: string, discountValue: number, discountType: 'PERCENT' | 'FIXED'): Promise<DiningTable> {
    return this.repo.applyDiscount(companyId, tableId, discountValue, discountType);
  }
}

@Injectable({
  providedIn: 'root'
})
export class JoinTablesUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, sourceTableId: string, targetTableId: string): Promise<DiningTable> {
    return this.repo.joinTables(companyId, sourceTableId, targetTableId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class SplitTableUseCase {
  private repo = inject(OsTableRepository);
  execute(
    companyId: string, 
    sourceTableId: string, 
    targetTableId: string, 
    itemIdsToMove: { itemId: string; quantity: number }[]
  ): Promise<{ sourceTable: DiningTable; targetTable: DiningTable }> {
    return this.repo.splitTable(companyId, sourceTableId, targetTableId, itemIdsToMove);
  }
}

@Injectable({
  providedIn: 'root'
})
export class PayPartialUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, tableId: string, amount: number, paymentMethod: string): Promise<DiningTable> {
    return this.repo.payPartial(companyId, tableId, amount, paymentMethod);
  }
}


export interface KitchenItemView {
  tableNumber: number;
  tableName: string;
  tableId: string;
  item: TableOrderItem;
}

@Injectable({
  providedIn: 'root'
})
export class GetKitchenOrdersUseCase {
  private repo = inject(OsTableRepository);

  async execute(companyId: string): Promise<TableKitchenOrder[]> {
    return this.repo.getKitchenOrders(companyId);
  }
}
