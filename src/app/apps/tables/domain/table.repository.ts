import { CloseTableResult, DiningTable, OrderItemStatus, TableKitchenOrder, TableOrderItem } from './table.entity';

export interface TableRepository {
  getTables(companyId: string): Promise<DiningTable[]>;
  getKitchenOrders(companyId: string): Promise<TableKitchenOrder[]>;
  openTable(companyId: string, tableId: string, customerCount: number, waiterName: string): Promise<DiningTable>;
  addItemToOrder(companyId: string, tableId: string, item: Omit<TableOrderItem, 'id' | 'orderedAt' | 'totalPrice' | 'status'> & { status?: OrderItemStatus }): Promise<DiningTable>;
  updateOrderItemStatus(companyId: string, tableId: string, itemId: string, status: OrderItemStatus): Promise<DiningTable>;
  requestBill(companyId: string, tableId: string): Promise<DiningTable>;
  closeTable(companyId: string, tableId: string, paymentMethod: string): Promise<CloseTableResult>;
  
  reserveTable(companyId: string, tableId: string, clientName: string, time: string, peopleCount: number, contact?: string): Promise<DiningTable>;
  cancelReservation(companyId: string, tableId: string): Promise<DiningTable>;
  transferTable(companyId: string, sourceTableId: string, targetTableId: string): Promise<DiningTable>;
  cancelOrderItem(companyId: string, tableId: string, itemId: string): Promise<DiningTable>;
  applyDiscount(companyId: string, tableId: string, discountValue: number, discountType: 'PERCENT' | 'FIXED'): Promise<DiningTable>;
  
  joinTables(companyId: string, sourceTableId: string, targetTableId: string): Promise<DiningTable>;
  splitTable(companyId: string, sourceTableId: string, targetTableId: string, itemIdsToMove: { itemId: string; quantity: number }[]): Promise<{ sourceTable: DiningTable; targetTable: DiningTable }>;
  payPartial(companyId: string, tableId: string, amount: number, paymentMethod: string): Promise<DiningTable>;
}

