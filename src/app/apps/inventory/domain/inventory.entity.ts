export type StockUnit = 'UN' | 'KG' | 'L' | 'CX';

export interface InventoryItem {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  stockQuantity: number;
  minStock: number;
  unit: StockUnit;
  barcode?: string;
  status?: 'active' | 'inactive';
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  companyId: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  timestamp: string;
}
