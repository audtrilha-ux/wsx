import { Injectable, inject } from '@angular/core';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { TableRepository } from '../domain/table.repository';
import { CloseTableResult, DiningTable, OrderItemStatus, TableKitchenOrder, TableOrderItem, TableOrder } from '../domain/table.entity';
import { OsDatabaseNamespace, OsDatabaseTransaction } from '../../../contracts/os/os-database.contract';

@Injectable({
  providedIn: 'root'
})
export class OsTableRepository implements TableRepository {
  private osSdk = inject(OsSdkService);
  private tablesNs: OsDatabaseNamespace;
  private salesNs: OsDatabaseNamespace;
  private financeNs: OsDatabaseNamespace;

  constructor() {
    // Vinculação canônica pelo SDK para isolamento de tenant automático
    const tablesApp = this.osSdk.bind('app_tables');
    this.tablesNs = tablesApp.storage;

    const posApp = this.osSdk.bind('app_pos');
    this.salesNs = posApp.storage;

    const financeApp = this.osSdk.bind('app_finance');
    this.financeNs = financeApp.storage;
  }

  async getTables(companyId: string): Promise<DiningTable[]> {
    const items = await this.tablesNs.query<DiningTable>();
    let tables = items.map((i) => i.value).filter((t) => t.companyId === companyId);
    
    // Auto-seed only if we are in the default developer workspace / demo sandbox ('comp_1')
    if (tables.length === 0 && companyId === 'comp_1') {
      await this.seedTables(companyId);
      const newItems = await this.tablesNs.query<DiningTable>();
      tables = newItems.map((i) => i.value).filter((t) => t.companyId === companyId);
    }
    
    return tables;
  }
  
  private async seedTables(companyId: string) {
    const initialTables: DiningTable[] = [
      { id: 't1', companyId, number: 1, name: 'Mesa 01', capacity: 4, status: 'AVAILABLE' },
      { id: 't2', companyId, number: 2, name: 'Mesa 02', capacity: 4, status: 'AVAILABLE' },
      { id: 't3', companyId, number: 3, name: 'Mesa 03', capacity: 2, status: 'AVAILABLE' },
      { id: 't4', companyId, number: 4, name: 'Mesa 04', capacity: 6, status: 'AVAILABLE' },
      { id: 't5', companyId, number: 5, name: 'Mesa 05', capacity: 8, status: 'AVAILABLE' }
    ];
    for (const t of initialTables) {
      await this.tablesNs.put(`${companyId}_${t.id}`, t);
    }
  }

  async getKitchenOrders(companyId: string): Promise<TableKitchenOrder[]> {
    const tables = await this.getTables(companyId);
    const kitchenOrders: TableKitchenOrder[] = [];

    for (const table of tables) {
      if (table.currentOrder && table.currentOrder.items && table.currentOrder.items.length > 0) {
        const pendingItems = table.currentOrder.items.filter((i: TableOrderItem) => i.status === 'PENDING_KITCHEN' || i.status === 'PREPARING');
        if (pendingItems.length > 0) {
          kitchenOrders.push({
            tableNumber: table.number,
            tableName: table.name,
            order: {
              ...table.currentOrder,
              items: pendingItems
            }
          });
        }
      }
    }
    
    return kitchenOrders.sort((a, b) => new Date(a.order.openedAt).getTime() - new Date(b.order.openedAt).getTime());
  }

  async openTable(companyId: string, tableId: string, customerCount: number, waiterName: string): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table) throw new Error('Mesa não encontrada');
    
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    table.status = 'OCCUPIED';
    table.currentOrder = {
      id: `ord_${uuid}`,
      tableId,
      openedAt: new Date().toISOString(),
      customerCount,
      waiterName,
      items: [],
      subtotal: 0,
      total: 0
    };
    
    await this.tablesNs.put(dbKey, table);
    return table;
  }

  private recalculateOrderTotals(order: TableOrder) {
    const activeItems = order.items.filter((i: TableOrderItem) => i.status !== 'CANCELLED');
    order.subtotal = activeItems.reduce((acc: number, i: TableOrderItem) => acc + i.totalPrice, 0);
    
    if (order.discount && order.discountType) {
      if (order.discountType === 'PERCENT') {
        const val = (order.subtotal * order.discount) / 100;
        order.total = Math.max(0, order.subtotal - val);
      } else {
        order.total = Math.max(0, order.subtotal - order.discount);
      }
    } else {
      order.total = order.subtotal;
    }
    
    if (order.customerCount > 0) {
      order.perPersonTotal = order.total / order.customerCount;
    } else {
      order.perPersonTotal = order.total;
    }
  }

  async addItemToOrder(
    companyId: string,
    tableId: string, 
    item: Omit<TableOrderItem, 'id' | 'orderedAt' | 'totalPrice' | 'status'> & { status?: OrderItemStatus }
  ): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table || !table.currentOrder) throw new Error('Mesa não está aberta');
    
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const newItem: TableOrderItem = {
      ...item,
      id: `item_${uuid}`,
      status: item.status || 'PENDING_KITCHEN',
      orderedAt: new Date().toISOString(),
      totalPrice: item.quantity * item.unitPrice
    };
    
    table.currentOrder.items.push(newItem);
    if (table.status === 'BILLING') {
      table.status = 'OCCUPIED';
    }
    
    this.recalculateOrderTotals(table.currentOrder);
    
    await this.tablesNs.put(dbKey, table);
    return table;
  }

  async updateOrderItemStatus(
    companyId: string,
    tableId: string, 
    itemId: string, 
    status: OrderItemStatus
  ): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table || !table.currentOrder) throw new Error('Mesa não está aberta');
    
    const targetItem = table.currentOrder.items.find((i: TableOrderItem) => i.id === itemId);
    if (!targetItem) throw new Error('Item não encontrado na comanda');
    
    targetItem.status = status;
    this.recalculateOrderTotals(table.currentOrder);
    await this.tablesNs.put(dbKey, table);
    return table;
  }

  async requestBill(companyId: string, tableId: string): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table || !table.currentOrder) throw new Error('Mesa não está aberta');
    
    table.status = 'BILLING';
    await this.tablesNs.put(dbKey, table);
    return table;
  }

  async closeTable(companyId: string, tableId: string, paymentMethod: string): Promise<CloseTableResult> {
    const dbKey = `${companyId}_${tableId}`;
    
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const saleId = `sale_tbl_${uuid}`;
    let total = 0;
    let finalInflowAmount = 0;
    let saleItems: { productId: string; quantity: number }[] = [];
    let tableName = '';
    const txId = `tx_table_${saleId}`;
    
    await this.tablesNs.transaction(async (tx: OsDatabaseTransaction) => {
      const table = await tx.get<DiningTable>(dbKey);
      if (!table || !table.currentOrder) throw new Error('Mesa não está aberta');
      
      tableName = table.name;
      saleItems = table.currentOrder.items
        .filter((i: TableOrderItem) => i.status !== 'CANCELLED')
        .map((i: TableOrderItem) => ({
          productId: i.productId,
          quantity: i.quantity
        }));
      total = table.currentOrder.total;
      const paid = table.currentOrder.paidAmount || 0;
      finalInflowAmount = Math.max(0, total - paid);
      
      // Criar Venda no app POS
      await tx.put(saleId, {
        id: saleId,
        companyId,
        total,
        timestamp: new Date().toISOString(),
        items: saleItems
      }, this.salesNs.namespace);
      
      // Criar transação Financeira
      await tx.put(txId, {
        id: txId,
        companyId,
        type: 'INFLOW',
        category: 'SALE',
        description: `Fechamento ${table.name} #${saleId.substring(0, 8)} (${table.currentOrder.customerCount} pessoas)`,
        amount: finalInflowAmount,
        paymentMethod: paymentMethod === 'DINHEIRO' || paymentMethod === 'PIX' || paymentMethod === 'CARTAO_CREDITO' || paymentMethod === 'CARTAO_DEBITO' ? paymentMethod : 'DINHEIRO',
        timestamp: new Date().toISOString(),
        operator: table.currentOrder.waiterName || 'Garçom',
        referenceId: saleId
      }, this.financeNs.namespace);
      
      // Liberar mesa
      table.status = 'AVAILABLE';
      table.currentOrder = undefined;
      table.reservation = undefined;
      await tx.put(dbKey, table);
    });

    const app = this.osSdk.bind('app_tables');
    await app.sync.queueOperation('sale.create', {
      id: saleId,
      companyId,
      total,
      paymentMethod,
      timestamp: new Date().toISOString(),
      items: saleItems
    });

    await app.sync.queueOperation('finance.transaction', {
      id: txId,
      companyId,
      type: 'INFLOW',
      category: 'SALE',
      description: `Fechamento ${tableName} #${saleId.substring(0, 8)}`,
      amount: finalInflowAmount,
      paymentMethod: paymentMethod === 'DINHEIRO' || paymentMethod === 'PIX' || paymentMethod === 'CARTAO_CREDITO' || paymentMethod === 'CARTAO_DEBITO' ? paymentMethod : 'DINHEIRO',
      timestamp: new Date().toISOString(),
      referenceId: saleId
    });

    await app.sync.queueOperation('table.close', { tableId });
    app.events.publish('table.closed', { tableId, saleId, total });
    app.logger.info(`Mesa #${tableId} finalizada com sucesso`, { saleId, total });
    
    return {
      success: true,
      saleId,
      total
    };
  }

  async reserveTable(
    companyId: string,
    tableId: string,
    clientName: string,
    time: string,
    peopleCount: number,
    contact?: string
  ): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table) throw new Error('Mesa não encontrada');
    
    table.status = 'RESERVED';
    table.reservation = {
      clientName,
      time,
      peopleCount,
      contact
    };
    
    await this.tablesNs.put(dbKey, table);
    
    const app = this.osSdk.bind('app_tables');
    await app.sync.queueOperation('table.reserve', { tableId, reservation: table.reservation });
    app.events.publish('table.reserved', { tableId, reservation: table.reservation });
    
    return table;
  }

  async cancelReservation(companyId: string, tableId: string): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table) throw new Error('Mesa não encontrada');
    
    table.status = 'AVAILABLE';
    table.reservation = undefined;
    
    await this.tablesNs.put(dbKey, table);
    
    const app = this.osSdk.bind('app_tables');
    await app.sync.queueOperation('table.cancel_reservation', { tableId });
    app.events.publish('table.reservation_cancelled', { tableId });
    
    return table;
  }

  async transferTable(companyId: string, sourceTableId: string, targetTableId: string): Promise<DiningTable> {
    const sourceKey = `${companyId}_${sourceTableId}`;
    const targetKey = `${companyId}_${targetTableId}`;
    
    const sourceTable = await this.tablesNs.get<DiningTable>(sourceKey);
    const targetTable = await this.tablesNs.get<DiningTable>(targetKey);
    
    if (!sourceTable || !sourceTable.currentOrder) throw new Error('Mesa de origem não está aberta');
    if (!targetTable) throw new Error('Mesa de destino não encontrada');
    if (targetTable.status === 'OCCUPIED' || targetTable.status === 'BILLING') {
      throw new Error('Mesa de destino já está ocupada');
    }
    
    // Transfer order
    const order = sourceTable.currentOrder;
    order.tableId = targetTableId;
    
    targetTable.currentOrder = order;
    targetTable.status = 'OCCUPIED';
    targetTable.reservation = undefined; // Clear any reservation on check-in
    
    sourceTable.currentOrder = undefined;
    sourceTable.status = 'AVAILABLE';
    
    await this.tablesNs.put(sourceKey, sourceTable);
    await this.tablesNs.put(targetKey, targetTable);
    
    const app = this.osSdk.bind('app_tables');
    await app.sync.queueOperation('table.transfer', { sourceTableId, targetTableId });
    app.events.publish('table.transferred', { sourceTableId, targetTableId });
    
    return targetTable;
  }

  async cancelOrderItem(companyId: string, tableId: string, itemId: string): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table || !table.currentOrder) throw new Error('Mesa não está aberta');
    
    const targetItem = table.currentOrder.items.find((i: TableOrderItem) => i.id === itemId);
    if (!targetItem) throw new Error('Item não encontrado na comanda');
    
    targetItem.status = 'CANCELLED';
    this.recalculateOrderTotals(table.currentOrder);
    
    await this.tablesNs.put(dbKey, table);
    
    const app = this.osSdk.bind('app_tables');
    await app.sync.queueOperation('table.cancel_item', { tableId, itemId });
    app.events.publish('table.item_cancelled', { tableId, itemId });
    
    return table;
  }

  async applyDiscount(
    companyId: string,
    tableId: string,
    discountValue: number,
    discountType: 'PERCENT' | 'FIXED'
  ): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table || !table.currentOrder) throw new Error('Mesa não está aberta');
    
    table.currentOrder.discount = discountValue;
    table.currentOrder.discountType = discountType;
    this.recalculateOrderTotals(table.currentOrder);
    
    await this.tablesNs.put(dbKey, table);
    
    const app = this.osSdk.bind('app_tables');
    await app.sync.queueOperation('table.apply_discount', { tableId, discountValue, discountType });
    app.events.publish('table.discount_applied', { tableId, discountValue, discountType });
    
    return table;
  }

  async joinTables(companyId: string, sourceTableId: string, targetTableId: string): Promise<DiningTable> {
    const sourceKey = `${companyId}_${sourceTableId}`;
    const targetKey = `${companyId}_${targetTableId}`;
    
    const sourceTable = await this.tablesNs.get<DiningTable>(sourceKey);
    const targetTable = await this.tablesNs.get<DiningTable>(targetKey);
    
    if (!sourceTable || !sourceTable.currentOrder) throw new Error('Mesa de origem não possui comanda ativa');
    if (!targetTable) throw new Error('Mesa de destino não encontrada');
    
    // Se a mesa de destino não estiver aberta, abrimos ela
    if (!targetTable.currentOrder) {
      targetTable.currentOrder = {
        id: `${companyId}_ord_${targetTableId}_${Date.now()}`,
        tableId: targetTableId,
        openedAt: sourceTable.currentOrder.openedAt,
        customerCount: sourceTable.currentOrder.customerCount,
        waiterName: sourceTable.currentOrder.waiterName,
        items: [],
        subtotal: 0,
        total: 0
      };
      targetTable.status = 'OCCUPIED';
    } else {
      // Se já estiver aberta, somamos o número de clientes
      targetTable.currentOrder.customerCount += sourceTable.currentOrder.customerCount;
    }
    
    // Mesclamos os itens ativos e pendentes da mesa de origem para o destino
    const sourceItems = sourceTable.currentOrder.items;
    targetTable.currentOrder.items.push(...sourceItems);
    
    // Recalcula totais do destino
    this.recalculateOrderTotals(targetTable.currentOrder);
    
    // Libera a mesa de origem
    sourceTable.currentOrder = undefined;
    sourceTable.status = 'AVAILABLE';
    
    await this.tablesNs.put(sourceKey, sourceTable);
    await this.tablesNs.put(targetKey, targetTable);
    
    const app = this.osSdk.bind('app_tables');
    await app.sync.queueOperation('table.join', { sourceTableId, targetTableId });
    app.events.publish('table.joined', { sourceTableId, targetTableId });
    
    return targetTable;
  }

  async splitTable(
    companyId: string, 
    sourceTableId: string, 
    targetTableId: string, 
    itemIdsToMove: { itemId: string; quantity: number }[]
  ): Promise<{ sourceTable: DiningTable; targetTable: DiningTable }> {
    const sourceKey = `${companyId}_${sourceTableId}`;
    const targetKey = `${companyId}_${targetTableId}`;
    
    const sourceTable = await this.tablesNs.get<DiningTable>(sourceKey);
    const targetTable = await this.tablesNs.get<DiningTable>(targetKey);
    
    if (!sourceTable || !sourceTable.currentOrder) throw new Error('Mesa de origem não possui comanda ativa');
    if (!targetTable) throw new Error('Mesa de destino não encontrada');
    
    // Se a mesa de destino não estiver aberta, abrimos ela
    if (!targetTable.currentOrder) {
      targetTable.currentOrder = {
        id: `${companyId}_ord_${targetTableId}_${Date.now()}`,
        tableId: targetTableId,
        openedAt: new Date().toISOString(),
        customerCount: 1,
        waiterName: sourceTable.currentOrder.waiterName || 'Atendente',
        items: [],
        subtotal: 0,
        total: 0
      };
      targetTable.status = 'OCCUPIED';
    }
    
    for (const moveInfo of itemIdsToMove) {
      const sourceItemIndex = sourceTable.currentOrder.items.findIndex(i => i.id === moveInfo.itemId);
      if (sourceItemIndex === -1) continue;
      
      const sourceItem = sourceTable.currentOrder.items[sourceItemIndex];
      const qtyToMove = Math.min(sourceItem.quantity, moveInfo.quantity);
      if (qtyToMove <= 0) continue;
      
      if (sourceItem.quantity > qtyToMove) {
        // Reduz quantidade na mesa de origem
        sourceItem.quantity -= qtyToMove;
        sourceItem.totalPrice = sourceItem.quantity * sourceItem.unitPrice;
        
        // Cria novo item correspondente na mesa de destino
        const targetItem: TableOrderItem = {
          ...sourceItem,
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          quantity: qtyToMove,
          totalPrice: qtyToMove * sourceItem.unitPrice
        };
        targetTable.currentOrder.items.push(targetItem);
      } else {
        // Move item completo
        sourceTable.currentOrder.items.splice(sourceItemIndex, 1);
        targetTable.currentOrder.items.push(sourceItem);
      }
    }
    
    // Recalcula os totais de ambas as comandas
    this.recalculateOrderTotals(sourceTable.currentOrder);
    this.recalculateOrderTotals(targetTable.currentOrder);
    
    // Se a mesa de origem ficou sem itens ativos, liberamos ela
    const activeSourceItems = sourceTable.currentOrder.items.filter(i => i.status !== 'CANCELLED');
    if (activeSourceItems.length === 0) {
      sourceTable.currentOrder = undefined;
      sourceTable.status = 'AVAILABLE';
    }
    
    await this.tablesNs.put(sourceKey, sourceTable);
    await this.tablesNs.put(targetKey, targetTable);
    
    const app = this.osSdk.bind('app_tables');
    await app.sync.queueOperation('table.split', { sourceTableId, targetTableId, itemIdsToMove });
    app.events.publish('table.split_completed', { sourceTableId, targetTableId });
    
    return { sourceTable, targetTable };
  }

  async payPartial(companyId: string, tableId: string, amount: number, paymentMethod: string): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table || !table.currentOrder) throw new Error('Mesa não está aberta');
    
    const currentPaid = table.currentOrder.paidAmount || 0;
    const remaining = table.currentOrder.total - currentPaid;
    if (amount <= 0) throw new Error('Valor do pagamento parcial deve ser maior que zero');
    if (amount > remaining) throw new Error(`Valor de R$ ${amount} excede o saldo restante de R$ ${remaining}`);
    
    table.currentOrder.paidAmount = currentPaid + amount;
    
    // Register financial inflow in finance app space
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const txId = `tx_partial_${tableId}_${uuid}`;
    
    await this.financeNs.put(txId, {
      id: txId,
      companyId,
      type: 'INFLOW',
      category: 'SALE',
      description: `Pagamento Parcial ${table.name} (${table.currentOrder.customerCount} pessoas)`,
      amount,
      paymentMethod: paymentMethod === 'DINHEIRO' || paymentMethod === 'PIX' || paymentMethod === 'CARTAO_CREDITO' || paymentMethod === 'CARTAO_DEBITO' ? paymentMethod : 'DINHEIRO',
      timestamp: new Date().toISOString(),
      operator: table.currentOrder.waiterName || 'Garçom'
    });
    
    await this.tablesNs.put(dbKey, table);
    
    const app = this.osSdk.bind('app_tables');
    await app.sync.queueOperation('finance.transaction', {
      id: txId,
      companyId,
      type: 'INFLOW',
      category: 'SALE',
      description: `Pagamento Parcial ${table.name}`,
      amount,
      paymentMethod: paymentMethod === 'DINHEIRO' || paymentMethod === 'PIX' || paymentMethod === 'CARTAO_CREDITO' || paymentMethod === 'CARTAO_DEBITO' ? paymentMethod : 'DINHEIRO',
      timestamp: new Date().toISOString()
    });
    
    await app.sync.queueOperation('table.pay_partial', { tableId, amount, paymentMethod });
    app.events.publish('table.partial_paid', { tableId, amount, paymentMethod });
    
    return table;
  }

}
