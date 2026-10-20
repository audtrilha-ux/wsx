export type MovementType = 
  | 'IN'          // Entrada / Compra
  | 'OUT'         // Saída / Venda
  | 'TRANSFER'    // Transferência entre filiais/depósitos
  | 'LOSS'        // Perda / Avaria
  | 'RETURN'      // Devolução
  | 'AUDIT'       // Contagem / Inventário
  | 'ADJUST'      // Ajuste Manual Auditável
  | 'RESERVE'     // Reserva de Estoque
  | 'UNRESERVE';  // Liberação de Reserva

export interface InventoryMovement {
  id: string;
  companyId: string;
  branchId: string;
  warehouseId?: string;
  targetBranchId?: string;
  targetWarehouseId?: string;
  productId: string;
  variantId?: string;
  type: MovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost?: number;
  totalCost?: number;
  operatorId: string;
  operatorName: string;
  reason: string;
  referenceDocument?: string;
  timestamp: Date;
  syncedWithCentral: boolean;
}

export interface StockReservation {
  id: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  orderReference: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface InventoryCountAudit {
  id: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  auditorName: string;
  status: 'draft' | 'in_progress' | 'completed' | 'canceled';
  itemsCounted: {
    productId: string;
    variantId?: string;
    systemStock: number;
    physicalStock: number;
    difference: number;
    adjustmentReason?: string;
  }[];
  startedAt: Date;
  completedAt?: Date;
}
