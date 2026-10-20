import { Router } from 'express';
import { z } from 'zod';
import { centralState, centralDatabase, saveIdempotencyLog, saveCentralState, SaleData, CustomerData, TableData, FinanceTransactionData, ProductData, IdempotencyLogEntry, PublicSpaceData } from '../state.js';
import { requireTenant, AuthenticatedRequest, validateBody } from '../middleware.js';

export const syncRouter = Router();

const BatchSyncOperationSchema = z.object({
  id: z.string().min(1, 'Operation ID is required'),
  idempotencyKey: z.string().optional(),
  tenantId: z.string().min(1, 'tenantId is required'),
  deviceId: z.string().optional(),
  branchId: z.string().optional(),
  appId: z.string().optional(),
  action: z.string().min(1, 'action is required'),
  payload: z.unknown()
});

const BatchSyncDtoSchema = z.object({
  companyId: z.string().optional(),
  operations: z.array(BatchSyncOperationSchema).min(1, 'operations array cannot be empty')
});

// In-process tenant mutex for sequential unit-of-work concurrency per tenant (Single-Node Engine)
const tenantMutexes = new Map<string, Promise<void>>();

async function acquireTenantLock<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  const currentPromise = tenantMutexes.get(tenantId) || Promise.resolve();
  let releaseLock!: () => void;
  const newPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  const chainedPromise = currentPromise.then(() => newPromise);
  tenantMutexes.set(tenantId, chainedPromise);

  await currentPromise;
  try {
    return await fn();
  } finally {
    releaseLock();
    // Safely cleanup map entry if this was the tail promise in the chain
    if (tenantMutexes.get(tenantId) === chainedPromise) {
      tenantMutexes.delete(tenantId);
    }
  }
}

// Zod Schemas for Runtime Action Payloads
const SaleItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().optional(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  total: z.number().nonnegative().optional()
});

const SaleCreateSchema = z.object({
  id: z.string().min(1),
  companyId: z.string().optional(),
  branchId: z.string().optional(),
  items: z.array(SaleItemSchema).min(1),
  total: z.number().nonnegative(),
  paymentMethod: z.enum(['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO']).optional(),
  timestamp: z.string().optional(),
  operator: z.string().optional()
});

const StockAdjustSchema = z.object({
  productId: z.string().min(1),
  newStock: z.number().nonnegative(),
  delta: z.number().optional(),
  reason: z.string().optional()
});

const StockItemSaveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  price: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().optional(),
  stock: z.number().nonnegative().optional(),
  stockQuantity: z.number().nonnegative().optional()
});

const FinanceTransactionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['INFLOW', 'OUTFLOW']),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().nonnegative(),
  paymentMethod: z.enum(['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA', 'BOLETO']).optional(),
  timestamp: z.string().optional(),
  operator: z.string().optional(),
  referenceId: z.string().optional()
});

const CustomerCreateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  document: z.string().optional(),
  points: z.number().optional(),
  tier: z.enum(['Bronze', 'Silver', 'Gold', 'VIP']).optional(),
  totalSpent: z.number().optional()
});

const CustomerPointsAdjustSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().optional(),
  newPoints: z.number().optional(),
  newTier: z.enum(['Bronze', 'Silver', 'Gold', 'VIP']).optional()
});

const TableUpdateSchema = z.object({
  id: z.string().min(1),
  number: z.number().positive().optional(),
  name: z.string().optional(),
  capacity: z.number().positive().optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILLING']).optional(),
  currentOrder: z.record(z.string(), z.unknown()).optional()
});

const TableCloseSchema = z.object({
  tableId: z.string().min(1)
});

const PublicSpaceUpdateSchema = z.object({
  companyId: z.string().optional(),
  companySlug: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  templateId: z.string().optional(),
  themeColor: z.string().optional(),
  status: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  hours: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  products: z.array(z.unknown()).optional(),
  theme: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  publishedAt: z.union([z.string(), z.date()]).optional()
});

function formatZodError(error: z.ZodError): string {
  return error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
}

// Capability matrix per action
const ACTION_PERMISSIONS: Record<string, string[]> = {
  'sale.create': ['admin', 'manager', 'operator', 'hq_admin'],
  'stock.adjust': ['admin', 'manager', 'hq_admin'],
  'stock.item.save': ['admin', 'manager', 'hq_admin'],
  'finance.transaction': ['admin', 'manager', 'hq_admin'],
  'customer.create': ['admin', 'manager', 'operator', 'hq_admin'],
  'customer.points.adjust': ['admin', 'manager', 'operator', 'hq_admin'],
  'table.update': ['admin', 'manager', 'operator', 'hq_admin'],
  'table.close': ['admin', 'manager', 'operator', 'hq_admin'],
  'public_space.update': ['admin', 'manager', 'hq_admin']
};

const ACTION_REQUIRED_APPS: Record<string, string> = {
  'sale.create': 'app_pos',
  'stock.adjust': 'app_inventory',
  'stock.item.save': 'app_inventory',
  'finance.transaction': 'app_finance',
  'customer.create': 'app_crm',
  'customer.points.adjust': 'app_crm',
  'table.update': 'app_tables',
  'table.close': 'app_tables',
  'public_space.update': 'app_public_space'
};

syncRouter.post('/batch', requireTenant, validateBody(BatchSyncDtoSchema), async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const companyId = req.user.role === 'hq_admin' ? (req.body?.companyId || req.user.companyId) : req.user.companyId;
  const { operations } = req.body;

  // Execute entire batch inside tenant lock to guarantee ACID serialized execution
  await acquireTenantLock(companyId, async () => {
    const acks: { opId: string; idempotencyKey: string; status: 'ACK' | 'DUPLICATE' | 'FAILED'; error?: string; serverTimestamp: string }[] = [];
    const serverTimestamp = new Date().toISOString();
    const userRole = req.user!.role;

    // Deep Snapshot maps for Unit of Work (True Transactional Rollback)
    const salesSnapshot = new Map<string, SaleData>();
    for (const [k, v] of centralState.sales.entries()) {
      salesSnapshot.set(k, structuredClone(v));
    }
    const productsSnapshot = new Map<string, ProductData>();
    for (const [k, v] of centralState.products.entries()) {
      productsSnapshot.set(k, structuredClone(v));
    }
    const financeSnapshot = new Map<string, FinanceTransactionData>();
    for (const [k, v] of centralState.financeTransactions.entries()) {
      financeSnapshot.set(k, structuredClone(v));
    }
    const customersSnapshot = new Map<string, CustomerData>();
    for (const [k, v] of centralState.customers.entries()) {
      customersSnapshot.set(k, structuredClone(v));
    }
    const tablesSnapshot = new Map<string, TableData>();
    for (const [k, v] of centralState.tables.entries()) {
      tablesSnapshot.set(k, structuredClone(v));
    }
    const publicSpacesSnapshot = new Map<string, PublicSpaceData>();
    for (const [k, v] of centralState.publicSpaces.entries()) {
      publicSpacesSnapshot.set(k, structuredClone(v));
    }
    const idempotencySnapshot = new Map<string, IdempotencyLogEntry>();
    for (const [k, v] of centralState.syncIdempotencyLog.entries()) {
      idempotencySnapshot.set(k, structuredClone(v));
    }

    const batchSales: SaleData[] = [];
    const batchProducts: ProductData[] = [];
    const batchFinance: FinanceTransactionData[] = [];
    const batchCustomers: CustomerData[] = [];
    const batchTables: TableData[] = [];
    const batchPublicSpaces: PublicSpaceData[] = [];
    const batchIdempotencyEntries: { key: string; status: string; processedAt: string; response: unknown }[] = [];

    let batchFailed = false;

    for (const op of operations) {
      const { id: opId, idempotencyKey, tenantId, action, payload } = op || {};

      // DATA-001: Compute mandatory effective idempotency key (idempotencyKey || opId)
      const effectiveIdempotencyKey = (idempotencyKey && String(idempotencyKey).trim().length > 0)
        ? String(idempotencyKey).trim()
        : String(opId || '').trim();

      if (!tenantId || tenantId !== companyId) {
        acks.push({
          opId,
          idempotencyKey: effectiveIdempotencyKey,
          status: 'FAILED',
          error: `Acesso negado: A operação pertence ao tenant '${tenantId}', mas a sessão está autenticada como '${companyId}'.`,
          serverTimestamp
        });
        batchFailed = true;
        break;
      }

      // Idempotency check (DATA-001: strictly check effectiveIdempotencyKey in memory and persistent storage)
      if (effectiveIdempotencyKey && (centralState.syncIdempotencyLog.has(effectiveIdempotencyKey) || centralDatabase.isIdempotencyProcessed(effectiveIdempotencyKey))) {
        acks.push({
          opId,
          idempotencyKey: effectiveIdempotencyKey,
          status: 'DUPLICATE',
          serverTimestamp
        });
        continue;
      }

      // Role capability matrix check
      const allowedRoles = ACTION_PERMISSIONS[action];
      if (!allowedRoles || !allowedRoles.includes(userRole)) {
        acks.push({
          opId,
          idempotencyKey: effectiveIdempotencyKey,
          status: 'FAILED',
          error: `Acesso negado: Função '${userRole}' não possui autorização para executar a ação '${action}'.`,
          serverTimestamp
        });
        batchFailed = true;
        break;
      }

      // App Entitlement validation
      const requiredApp = ACTION_REQUIRED_APPS[action];
      if (requiredApp && companyId) {
        const entitlementKey = `${companyId}:${requiredApp}`;
        const entitlement = centralState.appEntitlements.get(entitlementKey);
        const hasEntitlement = entitlement && entitlement.status === 'ACTIVE';

        if (!hasEntitlement) {
          acks.push({
            opId,
            idempotencyKey: idempotencyKey || opId,
            status: 'FAILED',
            error: `Acesso negado: O aplicativo '${requiredApp}' não está instalado ou com licença ativa para esta empresa.`,
            serverTimestamp
          });
          batchFailed = true;
          break;
        }
      }

      try {
        let actionHandled = false;

        if (action === 'sale.create') {
          const parsed = SaleCreateSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do payload da venda falhou: ${formatZodError(parsed.error)}`);
          }
          const salePayload = { ...parsed.data, companyId } as SaleData;
          if (req.user?.branchId) salePayload.branchId = req.user.branchId;

          if (salePayload.id) {
            // DATA-001 Remediation: Prevent duplicate sale replay and double stock deduction
            const isExistingInMemory = centralState.sales.has(salePayload.id);
            const isExistingInDb = centralDatabase.isSaleProcessed(salePayload.id);

            if (isExistingInMemory || isExistingInDb) {
              const existingSale = centralState.sales.get(salePayload.id) || centralDatabase.getSale(salePayload.id);
              if (existingSale && existingSale.companyId !== companyId) {
                throw new Error('Acesso negado: Tentativa de alteração de venda pertencente a outra empresa.');
              }
              // Sale was already processed and persisted: short-circuit to prevent repeated inventory/financial side effects
              acks.push({
                opId,
                idempotencyKey: effectiveIdempotencyKey,
                status: 'DUPLICATE',
                serverTimestamp
              });
              continue;
            }

            // Atomic Domain Side Effects: Server-authoritative pricing calculation & Deduct inventory stock
            if (Array.isArray(salePayload.items)) {
              const company = centralState.companies.get(companyId);
              const allowNegative = company?.allowNegativeStock ?? false;
              let serverCalculatedTotal = 0;

              for (const item of salePayload.items) {
                const qty = Number(item.quantity);
                if (isNaN(qty) || qty <= 0) {
                  throw new Error('Invariante violada: A quantidade de cada item na venda deve ser maior que zero.');
                }

                if (item.productId) {
                  const prod = centralState.products.get(item.productId);
                  if (!prod) {
                    throw new Error(`Invariante violada: Produto '${item.productId}' não encontrado no catálogo.`);
                  }
                  if (prod.companyId !== companyId) {
                    throw new Error(`Acesso negado: O produto '${prod.name}' (${item.productId}) pertence a outra empresa.`);
                  }

                  // Force server-authoritative catalog master unit price on items linked to products
                  item.price = prod.price;
                  serverCalculatedTotal += prod.price * qty;

                  const resultingStock = prod.stock - qty;
                  if (resultingStock < 0 && !allowNegative) {
                    throw new Error(`Estoque insuficiente para o produto '${prod.name}'. Estoque atual: ${prod.stock}, quantidade solicitada: ${qty}.`);
                  }

                  prod.stock = Math.max(0, resultingStock);
                  centralState.products.set(item.productId, prod);
                  batchProducts.push(prod);
                } else {
                  // Custom item without catalog product link
                  const customPrice = Number(item.price) || 0;
                  serverCalculatedTotal += customPrice * qty;
                }
              }

              // Server-authoritative total adjustment (subtract valid discount, enforce non-negative)
              const discountAmount = Math.max(0, Number(salePayload.discount) || 0);
              salePayload.total = Math.max(0, serverCalculatedTotal - discountAmount);
            }

            centralState.sales.set(salePayload.id, salePayload);
            batchSales.push(salePayload);

            // Atomic Domain Side Effect: Create financial transaction record if not present
            const finId = `fin_sale_${salePayload.id}`;
            const existingTableTxId = `tx_table_${salePayload.id}`;
            const hasExistingTx = Array.from(centralState.financeTransactions.values()).some(
              t => t.companyId === companyId && (t.referenceId === salePayload.id || t.id === finId || t.id === existingTableTxId)
            );

            if (!hasExistingTx) {
              const newFin: FinanceTransactionData = {
                id: finId,
                companyId,
                branchId: req.user?.branchId,
                type: 'INFLOW',
                category: 'SALE',
                description: `Venda balcão / PDV #${salePayload.id.slice(-6)}`,
                amount: salePayload.total,
                paymentMethod: (salePayload.paymentMethod as 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO') || 'DINHEIRO',
                timestamp: salePayload.timestamp || serverTimestamp,
                operator: salePayload.operator || req.user!.name,
                referenceId: salePayload.id
              };
              centralState.financeTransactions.set(finId, newFin);
              batchFinance.push(newFin);
            }

            actionHandled = true;
          }
        } else if (action === 'stock.adjust') {
          const parsed = StockAdjustSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do ajuste de estoque falhou: ${formatZodError(parsed.error)}`);
          }
          const stockPayload = parsed.data;
          if (centralState.products.has(stockPayload.productId)) {
            const prod = centralState.products.get(stockPayload.productId)!;
            if (req.user!.role !== 'hq_admin' && prod.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de ajustar estoque de produto de outra empresa.');
            }
            prod.stock = stockPayload.newStock;
            centralState.products.set(stockPayload.productId, prod);
            batchProducts.push(prod);
            actionHandled = true;
          } else {
            throw new Error(`Invariante violada: Produto '${stockPayload.productId}' não encontrado para ajuste de estoque.`);
          }
        } else if (action === 'stock.item.save') {
          const parsed = StockItemSaveSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do cadastro de produto falhou: ${formatZodError(parsed.error)}`);
          }
          const itemPayload = parsed.data;
          const itemId = itemPayload.id || `prod_${Date.now()}`;
          if (centralState.products.has(itemId)) {
            const existingProd = centralState.products.get(itemId)!;
            if (existingProd.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de alterar produto de outra empresa.');
            }
          }
          const savedProduct: ProductData = {
            id: itemId,
            companyId,
            name: itemPayload.name,
            price: Number(itemPayload.salePrice ?? itemPayload.price) || 0,
            stock: Number(itemPayload.stockQuantity ?? itemPayload.stock) || 0
          };
          centralState.products.set(itemId, savedProduct);
          batchProducts.push(savedProduct);
          actionHandled = true;
        } else if (action === 'finance.transaction') {
          const parsed = FinanceTransactionSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação da movimentação financeira falhou: ${formatZodError(parsed.error)}`);
          }
          const finPayload = { ...parsed.data, companyId } as FinanceTransactionData;
          if (req.user?.branchId) finPayload.branchId = req.user.branchId;

          // Check for financial entry deduplication if linked to a sale reference
          if (finPayload.referenceId) {
            const existingRefTx = Array.from(centralState.financeTransactions.values()).find(
              t => t.companyId === companyId && t.referenceId === finPayload.referenceId
            );
            if (existingRefTx && existingRefTx.id !== finPayload.id) {
              // Update existing reference transaction instead of duplicating
              existingRefTx.amount = finPayload.amount;
              existingRefTx.paymentMethod = finPayload.paymentMethod || existingRefTx.paymentMethod;
              existingRefTx.description = finPayload.description || existingRefTx.description;
              centralState.financeTransactions.set(existingRefTx.id, existingRefTx);
              batchFinance.push(existingRefTx);
              actionHandled = true;
            }
          }

          if (!actionHandled) {
            if (centralState.financeTransactions.has(finPayload.id)) {
              const existingTx = centralState.financeTransactions.get(finPayload.id)!;
              if (existingTx.companyId !== companyId) {
                throw new Error('Acesso negado: Tentativa de alterar movimentação financeira de outra empresa.');
              }
            }
            centralState.financeTransactions.set(finPayload.id, finPayload);
            batchFinance.push(finPayload);
            actionHandled = true;
          }
        } else if (action === 'customer.create') {
          const parsed = CustomerCreateSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do cadastro de cliente falhou: ${formatZodError(parsed.error)}`);
          }
          const custPayload = { ...parsed.data, companyId } as CustomerData;
          if (req.user?.branchId) custPayload.branchId = req.user.branchId;

          if (centralState.customers.has(custPayload.id)) {
            const existingCust = centralState.customers.get(custPayload.id)!;
            if (existingCust.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de alterar cliente de outra empresa.');
            }
          }
          centralState.customers.set(custPayload.id, custPayload);
          batchCustomers.push(custPayload);
          actionHandled = true;
        } else if (action === 'customer.points.adjust') {
          const parsed = CustomerPointsAdjustSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do ajuste de pontos falhou: ${formatZodError(parsed.error)}`);
          }
          const ptsPayload = parsed.data;
          if (centralState.customers.has(ptsPayload.customerId)) {
            const cust = centralState.customers.get(ptsPayload.customerId)!;
            if (req.user!.role !== 'hq_admin' && cust.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de ajustar pontos de cliente de outra empresa.');
            }
            if (ptsPayload.newPoints !== undefined) {
              cust.points = ptsPayload.newPoints;
            } else if (ptsPayload.amount !== undefined) {
              cust.points = (cust.points || 0) + ptsPayload.amount;
            }
            if (ptsPayload.newTier) {
              cust.tier = ptsPayload.newTier as 'Bronze' | 'Silver' | 'Gold' | 'VIP';
            }
            centralState.customers.set(ptsPayload.customerId, cust);
            batchCustomers.push(cust);
            actionHandled = true;
          } else {
            throw new Error('Invariante violada: Cliente não encontrado para ajuste de pontuação.');
          }
        } else if (action === 'table.update') {
          const parsed = TableUpdateSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação da mesa falhou: ${formatZodError(parsed.error)}`);
          }
          const tablePayload = { ...parsed.data, companyId } as unknown as TableData;
          if (req.user?.branchId) tablePayload.branchId = req.user.branchId;

          if (centralState.tables.has(tablePayload.id)) {
            const existingTbl = centralState.tables.get(tablePayload.id)!;
            if (existingTbl.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de alterar mesa/comanda de outra empresa.');
            }
          }
          centralState.tables.set(tablePayload.id, tablePayload);
          batchTables.push(tablePayload);
          actionHandled = true;
        } else if (action === 'table.close') {
          const parsed = TableCloseSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do fechamento de mesa falhou: ${formatZodError(parsed.error)}`);
          }
          const closePayload = parsed.data;
          if (centralState.tables.has(closePayload.tableId)) {
            const tbl = centralState.tables.get(closePayload.tableId)!;
            if (req.user!.role !== 'hq_admin' && tbl.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de fechar mesa/comanda de outra empresa.');
            }
            tbl.status = 'AVAILABLE';
            tbl.currentOrder = undefined;
            centralState.tables.set(closePayload.tableId, tbl);
            batchTables.push(tbl);
            actionHandled = true;
          } else {
            throw new Error('Invariante violada: Mesa/Comanda não encontrada para fechamento.');
          }
        } else if (action === 'public_space.update') {
          const parsed = PublicSpaceUpdateSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do Public Space falhou: ${formatZodError(parsed.error)}`);
          }
          const existing = centralState.publicSpaces.get(companyId) || {
            companyId,
            companySlug: companyId,
            title: 'Meu Espaço Público',
            description: '',
            logo: '',
            templateId: 'restaurant',
            themeColor: '#e11d48',
            status: 'published',
            publishedAt: new Date().toISOString(),
            phone: '',
            email: '',
            address: '',
            hours: 'Seg a Sab 09:00 - 22:00',
            products: []
          };
          const spacePayload = {
            ...existing,
            ...parsed.data,
            companyId
          } as PublicSpaceData;
          centralState.publicSpaces.set(companyId, spacePayload);
          batchPublicSpaces.push(spacePayload);
          actionHandled = true;
        }

        if (!actionHandled) {
          throw new Error(`Operação não tratada ou ação inválida: ${action}`);
        }

        // Record idempotency token (DATA-001: persist effectiveIdempotencyKey)
        if (effectiveIdempotencyKey) {
          const entry = {
            status: 'ACK',
            processedAt: serverTimestamp,
            response: { opId, action, companyId }
          };
          centralState.syncIdempotencyLog.set(effectiveIdempotencyKey, entry);
          batchIdempotencyEntries.push({
            key: effectiveIdempotencyKey,
            status: 'ACK',
            processedAt: serverTimestamp,
            response: entry.response
          });
        }

        acks.push({
          opId,
          idempotencyKey: effectiveIdempotencyKey,
          status: 'ACK',
          serverTimestamp
        });
      } catch (err) {
        acks.push({
          opId,
          idempotencyKey: effectiveIdempotencyKey,
          status: 'FAILED',
          error: err instanceof Error ? err.message : String(err),
          serverTimestamp
        });
        batchFailed = true;
        break;
      }
    }

    // Persist batch atomically to primary SQLite database
    if (!batchFailed) {
      try {
        centralDatabase.applySyncBatchTransaction({
          sales: batchSales,
          products: batchProducts,
          financeTransactions: batchFinance,
          customers: batchCustomers,
          tables: batchTables,
          publicSpaces: batchPublicSpaces,
          idempotencyEntries: batchIdempotencyEntries
        });
      } catch (dbErr) {
        console.error('[SyncRouter] CRITICAL: Failed to apply sync batch transaction to SQLite:', dbErr);
        batchFailed = true;
        for (const ack of acks) {
          if (ack.status === 'ACK') {
            ack.status = 'FAILED';
            ack.error = 'Falha crítica ao persistir lote de sincronismo no banco de dados central (SQLite).';
          }
        }
      }
    }

    // Transaction Rollback (Unit of Work): If any operation failed, restore state snapshot and invalidate all ACKs
    if (batchFailed) {
      centralState.sales = salesSnapshot;
      centralState.products = productsSnapshot;
      centralState.financeTransactions = financeSnapshot;
      centralState.customers = customersSnapshot;
      centralState.tables = tablesSnapshot;
      centralState.publicSpaces = publicSpacesSnapshot;
      centralState.syncIdempotencyLog = idempotencySnapshot;

      // ATOMIC BATCH PROTOCOL: Invalidate all preliminary ACKs because the entire batch was rolled back!
      for (const ack of acks) {
        if (ack.status === 'ACK') {
          ack.status = 'FAILED';
          ack.error = 'BATCH_ROLLED_BACK: A operação foi desfeita porque outra operação do lote falhou e o lote inteiro sofreu rollback atômico.';
        }
      }
    } else {
      saveIdempotencyLog(centralState.syncIdempotencyLog);
      saveCentralState(true);
    }

    res.json({
      success: !batchFailed,
      processedCount: batchFailed ? 0 : acks.filter(a => a.status === 'ACK' || a.status === 'DUPLICATE').length,
      failedCount: acks.filter(a => a.status === 'FAILED').length,
      rolledBack: batchFailed,
      serverTimestamp,
      acks
    });
  });
});

/**
 * GET /pull
 * Recupera todas as entidades do domínio pertencentes ao tenant (empresa) autenticado
 * para realizar sincronização bidirecional do Client OS.
 */
syncRouter.get('/pull', requireTenant, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  const companyId = req.user.role === 'hq_admin' 
    ? ((req.query['companyId'] as string) || req.user.companyId)
    : req.user.companyId;

  if (!companyId) {
    res.status(400).json({ error: 'Identificador de empresa (companyId) é obrigatório.' });
    return;
  }

  // Coleta dados das coleções centrais isoladas por tenant
  const sales = Array.from(centralState.sales.values()).filter(s => s.companyId === companyId);
  const products = Array.from(centralState.products.values()).filter(p => p.companyId === companyId);
  const financeTransactions = Array.from(centralState.financeTransactions.values()).filter(f => f.companyId === companyId);
  const customers = Array.from(centralState.customers.values()).filter(c => c.companyId === companyId);
  const tables = Array.from(centralState.tables.values()).filter(t => t.companyId === companyId);
  const publicSpace = centralState.publicSpaces.get(companyId) || null;

  res.json({
    success: true,
    companyId,
    serverTimestamp: new Date().toISOString(),
    data: {
      sales,
      products,
      financeTransactions,
      customers,
      tables,
      publicSpace
    }
  });
});

/**
 * GET /changes
 * Recupera alterações incrementais ocorridas após um cursor/timestamp determinado (since)
 */
syncRouter.get('/changes', requireTenant, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  const companyId = req.user.role === 'hq_admin'
    ? ((req.query['tenantId'] as string) || (req.query['companyId'] as string) || req.user.companyId)
    : req.user.companyId;

  if (!companyId) {
    res.status(400).json({ error: 'Identificador de empresa (companyId/tenantId) é obrigatório.' });
    return;
  }

  const since = req.query['since'] as string | undefined;
  const sinceDate = since ? new Date(since).getTime() : 0;

  // Filtragem delta por timestamp
  const sales = Array.from(centralState.sales.values())
    .filter(s => s.companyId === companyId && (!sinceDate || new Date(s.timestamp || 0).getTime() > sinceDate));

  const products = Array.from(centralState.products.values())
    .filter(p => p.companyId === companyId);

  const financeTransactions = Array.from(centralState.financeTransactions.values())
    .filter(f => f.companyId === companyId && (!sinceDate || new Date(f.timestamp || 0).getTime() > sinceDate));

  const customers = Array.from(centralState.customers.values())
    .filter(c => c.companyId === companyId && (!sinceDate || new Date(c.createdAt || 0).getTime() > sinceDate));

  const tables = Array.from(centralState.tables.values())
    .filter(t => t.companyId === companyId);

  const records = [
    ...sales.map(s => ({ entity: 'sale', ...s })),
    ...products.map(p => ({ entity: 'product', ...p })),
    ...financeTransactions.map(f => ({ entity: 'finance', ...f })),
    ...customers.map(c => ({ entity: 'customer', ...c })),
    ...tables.map(t => ({ entity: 'table', ...t }))
  ];

  res.json({
    success: true,
    companyId,
    records,
    latestTimestamp: new Date().toISOString()
  });
});
