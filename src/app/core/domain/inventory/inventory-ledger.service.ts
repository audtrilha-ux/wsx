import { Injectable, signal, inject } from '@angular/core';
import { InventoryMovement, MovementType, StockReservation, InventoryCountAudit } from '../../../contracts/inventory/inventory-ledger.contract';
import { ProductMasterService } from '../product/product-master.service';
import { OsDatabaseService } from '../../storage/os-database.service';
import { SyncService } from '../../sync/sync.service';
import { DiagnosticsService } from '../../diagnostics/diagnostics.service';

@Injectable({
  providedIn: 'root'
})
export class InventoryLedgerService {
  private osDb = inject(OsDatabaseService);
  private syncService = inject(SyncService);
  private diagnostics = inject(DiagnosticsService);
  private productService = inject(ProductMasterService);

  private readonly movementsSignal = signal<InventoryMovement[]>([]);
  readonly movements = this.movementsSignal.asReadonly();

  private readonly reservationsSignal = signal<StockReservation[]>([]);
  readonly reservations = this.reservationsSignal.asReadonly();

  constructor() {
    this.loadMovementsFromStorage();
  }

  async loadMovementsFromStorage(companyId = 'cmp_default'): Promise<void> {
    try {
      const ns = this.osDb.getNamespace(`tenant.${companyId}.inventory_ledger`);
      const stored = await ns.query<InventoryMovement>();
      if (stored && stored.length > 0) {
        this.movementsSignal.set(stored.map(s => s.value));
      }
    } catch (err) {
      this.diagnostics.warn('[InventoryLedger] Erro ao carregar extrato de estoque:', { error: String(err) });
    }
  }

  async recordMovement(params: {
    companyId: string;
    branchId: string;
    warehouseId?: string;
    targetBranchId?: string;
    targetWarehouseId?: string;
    productId: string;
    variantId?: string;
    type: MovementType;
    quantity: number;
    operatorId: string;
    operatorName: string;
    reason: string;
    referenceDocument?: string;
    unitCost?: number;
  }): Promise<InventoryMovement> {
    const product = this.productService.products().find(p => p.id === params.productId);
    if (!product) {
      throw new Error(`[InventoryLedger] Produto '${params.productId}' não encontrado.`);
    }

    const previousStock = product.stockQuantity;
    let newStock = previousStock;

    switch (params.type) {
      case 'IN':
      case 'RETURN':
        newStock += params.quantity;
        break;
      case 'OUT':
      case 'LOSS':
        newStock = Math.max(0, previousStock - params.quantity);
        break;
      case 'ADJUST':
      case 'AUDIT':
        newStock = params.quantity; // Ajuste/Contagem substitui pelo valor real apurado
        break;
      case 'TRANSFER':
        newStock = Math.max(0, previousStock - params.quantity);
        break;
    }

    // Atualiza o estoque do produto no ProductMaster
    await this.productService.saveProduct({
      ...product,
      stockQuantity: newStock,
      companyId: params.companyId
    });

    const now = new Date();
    const movementId = `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const movement: InventoryMovement = {
      id: movementId,
      companyId: params.companyId,
      branchId: params.branchId,
      warehouseId: params.warehouseId || 'wh_main',
      targetBranchId: params.targetBranchId,
      targetWarehouseId: params.targetWarehouseId,
      productId: params.productId,
      variantId: params.variantId,
      type: params.type,
      quantity: params.quantity,
      previousStock,
      newStock,
      unitCost: params.unitCost || product.costPrice,
      totalCost: (params.unitCost || product.costPrice) * params.quantity,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      reason: params.reason,
      referenceDocument: params.referenceDocument,
      timestamp: now,
      syncedWithCentral: true
    };

    // Persiste no banco local
    const ns = this.osDb.getNamespace(`tenant.${params.companyId}.inventory_ledger`);
    await ns.put(movementId, movement);

    // Enfileira na Outbox de sincronismo
    await this.syncService.queueOperation('inventory.movement', movement);

    // Atualiza estado reativo
    this.movementsSignal.update(list => [movement, ...list]);

    this.diagnostics.info(`[InventoryLedger] Movimentação '${params.type}' (${params.quantity} UN) registrada para o produto '${product.name}'. Estoque: ${previousStock} -> ${newStock}`);
    return movement;
  }

  async reserveStock(params: {
    companyId: string;
    branchId: string;
    warehouseId: string;
    productId: string;
    variantId?: string;
    quantity: number;
    orderReference: string;
    expirationMinutes?: number;
  }): Promise<StockReservation> {
    const product = this.productService.products().find(p => p.id === params.productId);
    if (!product) throw new Error(`[Inventory] Produto '${params.productId}' não encontrado.`);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (params.expirationMinutes || 30) * 60 * 1000);

    const reservation: StockReservation = {
      id: `res_${Date.now()}`,
      companyId: params.companyId,
      branchId: params.branchId,
      warehouseId: params.warehouseId,
      productId: params.productId,
      variantId: params.variantId,
      quantity: params.quantity,
      orderReference: params.orderReference,
      expiresAt,
      createdAt: now
    };

    // Atualiza quantidade reservada
    await this.productService.saveProduct({
      ...product,
      reservedQuantity: product.reservedQuantity + params.quantity,
      companyId: params.companyId
    });

    this.reservationsSignal.update(list => [...list, reservation]);
    return reservation;
  }

  async releaseReservation(reservationId: string, companyId = 'cmp_default'): Promise<boolean> {
    const res = this.reservations().find(r => r.id === reservationId);
    if (!res) return false;

    const product = this.productService.products().find(p => p.id === res.productId);
    if (product) {
      await this.productService.saveProduct({
        ...product,
        reservedQuantity: Math.max(0, product.reservedQuantity - res.quantity),
        companyId
      });
    }

    this.reservationsSignal.update(list => list.filter(r => r.id !== reservationId));
    return true;
  }

  async processInventoryAudit(audit: Omit<InventoryCountAudit, 'id' | 'startedAt'>): Promise<InventoryCountAudit> {
    const now = new Date();
    const auditId = `aud_${Date.now()}`;
    const fullAudit: InventoryCountAudit = {
      ...audit,
      id: auditId,
      startedAt: now,
      completedAt: now,
      status: 'completed'
    };

    for (const item of audit.itemsCounted) {
      if (item.difference !== 0) {
        await this.recordMovement({
          companyId: audit.companyId,
          branchId: audit.branchId,
          warehouseId: audit.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          type: 'AUDIT',
          quantity: item.physicalStock,
          operatorId: 'op_auditor',
          operatorName: audit.auditorName,
          reason: item.adjustmentReason || `Ajuste de Inventário - Dif: ${item.difference}`,
          referenceDocument: auditId
        });
      }
    }

    return fullAudit;
  }
}
