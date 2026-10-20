export type KitchenStation = 'kitchen' | 'bar' | 'grill' | 'dessert' | 'counter';
export type KdsOrderPriority = 'low' | 'normal' | 'high' | 'urgent';
export type KdsTicketStatus = 'queued' | 'in_preparation' | 'paused' | 'ready' | 'served' | 'cancelled';

export interface KdsItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  notes?: string;
  station: KitchenStation;
  status: KdsTicketStatus;
  preparationStartedAt?: Date;
  readyAt?: Date;
  servedAt?: Date;
}

export interface KdsTicket {
  id: string;
  companyId: string;
  branchId: string;
  tableNumber?: number;
  tableName?: string;
  customerName?: string;
  orderType: 'dine_in' | 'takeout' | 'delivery' | 'comanda';
  station: KitchenStation;
  priority: KdsOrderPriority;
  items: KdsItem[];
  status: KdsTicketStatus;
  createdAt: Date;
  estimatedPreparationMinutes: number;
  slaTargetMinutes: number;
  isSlaBreached: boolean;
  pausedAt?: Date;
  pausedReason?: string;
}
