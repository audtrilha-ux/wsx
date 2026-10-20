export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'BILLING' | 'RESERVED';
export type OrderItemStatus = 
  | 'PENDING' 
  | 'PREPARING' 
  | 'PENDING_KITCHEN' 
  | 'IN_PREPARATION' 
  | 'READY' 
  | 'SERVED' 
  | 'CANCELLED';

export interface TableOrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: OrderItemStatus;
  notes?: string;
  orderedAt: string;
}

export interface TableOrder {
  id: string;
  tableId: string;
  openedAt: string;
  customerCount: number;
  waiterName: string;
  items: TableOrderItem[];
  subtotal: number;
  discount?: number;
  discountType?: 'PERCENT' | 'FIXED';
  total: number;
  perPersonTotal?: number;
  paidAmount?: number;
}

export interface TableReservation {
  clientName: string;
  contact?: string;
  time: string;
  peopleCount: number;
}

export interface DiningTable {
  id: string;
  companyId: string;
  number: number;
  name: string;
  capacity: number;
  status: TableStatus;
  currentOrder?: TableOrder;
  reservation?: TableReservation;
}

export interface TableKitchenOrder {
  tableNumber: number;
  tableName: string;
  order: TableOrder;
}

export interface CloseTableResult {
  success: boolean;
  saleId: string;
  total: number;
}


