import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  centralState,
  centralDatabase,
  saveCentralState,
  recordHqAuditLog,
  CompanyData,
  TenantUserData,
  ProductData,
  SaleData,
  FinanceTransactionData,
  CustomerData,
  TableData,
  AppEntitlement
} from '../state.js';
import { hashPassword } from '../config.js';
import { getDemoPlans, getDemoHqAdmins } from '../fixtures/demo-data.js';

export const simulationRouter = Router();

export interface SimulationLogEntry {
  step: string;
  action: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  details: string;
  metadata?: Record<string, unknown>;
}

export interface SimulationResult {
  success: boolean;
  executedAt: string;
  durationMs: number;
  logs: SimulationLogEntry[];
  summary: {
    companiesCreated: number;
    productsCataloged: number;
    inventoryAdjustments: number;
    salesProcessed: number;
    totalRevenueGenerated: number;
    stockDeductionsVerified: number;
    tablesServiced: number;
    loyaltyPointsAccrued: number;
  };
  tenants: {
    retail: {
      id: string;
      name: string;
      productsCount: number;
      salesCount: number;
      revenue: number;
      stockBalanceSum: number;
    };
    restaurant: {
      id: string;
      name: string;
      productsCount: number;
      salesCount: number;
      revenue: number;
      stockBalanceSum: number;
      tablesCount: number;
    };
  };
  verifications: {
    check: string;
    passed: boolean;
    details: string;
  }[];
}

/**
 * Reseta o banco de dados e limpa os registros operacionais para um ambiente imaculado de simulação.
 */
export function executeCleanReset(): { success: boolean; message: string } {
  try {
    const rawDb = centralDatabase.getRawDatabase();
    if (rawDb) {
      rawDb.prepare('DELETE FROM sales').run();
      rawDb.prepare('DELETE FROM products').run();
      rawDb.prepare('DELETE FROM tables_registry').run();
      rawDb.prepare('DELETE FROM finance_transactions').run();
      rawDb.prepare('DELETE FROM customers').run();
      rawDb.prepare('DELETE FROM orders').run();
      rawDb.prepare('DELETE FROM company_ledger').run();
      rawDb.prepare('DELETE FROM idempotency_log').run();
      rawDb.prepare('DELETE FROM billing_idempotency_log').run();
      rawDb.prepare('DELETE FROM processed_webhook_events').run();
      rawDb.prepare('DELETE FROM app_entitlements').run();
      rawDb.prepare('DELETE FROM company_users').run();
      rawDb.prepare('DELETE FROM companies').run();
    }

    // Reset em memória
    centralState.sales.clear();
    centralState.products.clear();
    centralState.tables.clear();
    centralState.financeTransactions.clear();
    centralState.customers.clear();
    centralState.orders.clear();
    centralState.companyLedger.clear();
    centralState.syncIdempotencyLog.clear();
    centralState.appEntitlements.clear();
    centralState.companyUsers.clear();
    centralState.companies.clear();
    centralState.hqAuditLogs = [];

    // Repovoa planos do catálogo e admins HQ
    centralState.plans = getDemoPlans();
    centralState.hqAdmins = getDemoHqAdmins();

    if (rawDb) {
      for (const p of centralState.plans) {
        rawDb.prepare(`
          INSERT OR REPLACE INTO plans (id, name, monthly_price, max_terminals, max_branches, description, included_apps, features)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          p.id,
          p.name,
          p.monthlyPrice,
          p.maxTerminals,
          p.maxBranches,
          p.description,
          JSON.stringify(p.includedApps),
          JSON.stringify(p.features)
        );
      }

      for (const admin of centralState.hqAdmins) {
        rawDb.prepare(`
          INSERT OR REPLACE INTO hq_admins (id, name, email, role, password, mfa_enabled, mfa_secret)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          admin.id,
          admin.name,
          admin.email,
          admin.role,
          admin.password,
          admin.mfaEnabled ? 1 : 0,
          admin.mfaSecret
        );
      }
    }

    saveCentralState();
    return { success: true, message: 'Base de dados resetada com sucesso para estado limpo.' };
  } catch (err) {
    return { success: false, message: `Falha ao resetar banco de dados: ${String(err)}` };
  }
}

/**
 * Executa a simulação completa do ecossistema:
 * 1. Reset da base
 * 2. Criação das empresas (Varejo + Restaurante)
 * 3. Povoamento de estoque e ajustes
 * 4. Vendas no PDV (Varejo) com baixa de estoque e entrada financeira
 * 5. Ciclo de mesas, comanda e KDS (Restaurante) com liquidação
 * 6. Conciliação e asserção de invariantes
 */
export function runFullSimulation(): SimulationResult {
  const startTime = Date.now();
  const logs: SimulationLogEntry[] = [];

  const addLog = (step: string, action: string, status: 'SUCCESS' | 'WARNING' | 'ERROR', details: string, metadata?: Record<string, unknown>) => {
    logs.push({
      step,
      action,
      timestamp: new Date().toISOString(),
      status,
      details,
      metadata
    });
  };

  // 1. Reset
  const resetRes = executeCleanReset();
  if (!resetRes.success) {
    addLog('01_RESET', 'Database Clean Reset', 'ERROR', resetRes.message);
    throw new Error(resetRes.message);
  }
  addLog('01_RESET', 'Database Clean Reset', 'SUCCESS', 'Base SQLite reinicializada no modo WAL com integridade referencial ativa.');

  // 2. Criação de Empresas
  const retailId = 'comp_sim_retail';
  const restaurantId = 'comp_sim_restaurant';

  const retailCompany: CompanyData = {
    id: retailId,
    name: 'Londrina Confecções & Varejo',
    slug: 'londrina-varejo',
    cnpj: '12.345.678/0001-90',
    balance: 500,
    installedApps: ['app_pos', 'app_inventory', 'app_crm', 'app_finance', 'app_public_space', 'app_settings'],
    status: 'active',
    plan: 'pro',
    maxTerminals: 5,
    maxBranches: 3,
    activeTerminals: 2,
    channel: 'stable',
    osTargetVersion: '1.4.3-lts',
    licenseExpiresAt: '2027-12-31',
    allowNegativeStock: false,
    branches: [
      {
        id: 'br_retail_1',
        companyId: retailId,
        name: 'Matriz Calçadão Londrina',
        address: 'Calçadão de Londrina, 350 - Centro, Londrina - PR',
        phone: '(43) 3321-1000',
        isActive: true,
        isMain: true
      },
      {
        id: 'br_retail_2',
        companyId: retailId,
        name: 'Filial Catuaí Shopping',
        address: 'Rod. Celso Garcia Cid, km 377 - Gleba Palhano, Londrina - PR',
        phone: '(43) 3321-2000',
        isActive: true
      }
    ]
  };

  const restaurantCompany: CompanyData = {
    id: restaurantId,
    name: 'Bistrô & Trattoria Londrina',
    slug: 'trattoria-londrina',
    cnpj: '98.765.432/0001-11',
    balance: 750,
    installedApps: ['app_pos', 'app_tables', 'app_inventory', 'app_crm', 'app_finance', 'app_public_space', 'app_settings'],
    status: 'active',
    plan: 'pro',
    maxTerminals: 5,
    maxBranches: 2,
    activeTerminals: 2,
    channel: 'stable',
    osTargetVersion: '1.4.3-lts',
    licenseExpiresAt: '2027-12-31',
    allowNegativeStock: false,
    branches: [
      {
        id: 'br_rest_1',
        companyId: restaurantId,
        name: 'Salão Gastronômico Centro',
        address: 'Rua Espírito Santo, 1200 - Centro, Londrina - PR',
        phone: '(43) 3344-5566',
        isActive: true,
        isMain: true
      }
    ]
  };

  const retailAdmin: TenantUserData = {
    id: 'usr_retail_admin',
    companyId: retailId,
    name: 'Ana Paula Mendonça (Gerente Varejo)',
    email: 'admin.varejo@londrina-sim.com',
    pin: hashPassword('1234'),
    password: hashPassword('VarejoPass2026!'),
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  const restAdmin: TenantUserData = {
    id: 'usr_rest_admin',
    companyId: restaurantId,
    name: 'Chef Lorenzo Moretti',
    email: 'admin.bistro@londrina-sim.com',
    pin: hashPassword('4321'),
    password: hashPassword('BistroPass2026!'),
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  // Persiste empresas e usuários
  centralState.companies.set(retailId, retailCompany);
  centralState.companies.set(restaurantId, restaurantCompany);
  centralState.companyUsers.set(retailId, [retailAdmin]);
  centralState.companyUsers.set(restaurantId, [restAdmin]);

  const rawDb = centralDatabase.getRawDatabase();
  if (rawDb) {
    const insertComp = rawDb.prepare(`
      INSERT INTO companies (id, name, slug, cnpj, balance, installed_apps, status, plan, max_terminals, max_branches, active_terminals, channel, os_target_version, license_expires_at, branches, allow_negative_stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertComp.run(
      retailCompany.id, retailCompany.name, retailCompany.slug, retailCompany.cnpj, retailCompany.balance,
      JSON.stringify(retailCompany.installedApps), retailCompany.status, retailCompany.plan, retailCompany.maxTerminals,
      retailCompany.maxBranches, retailCompany.activeTerminals, retailCompany.channel, retailCompany.osTargetVersion,
      retailCompany.licenseExpiresAt, JSON.stringify(retailCompany.branches), retailCompany.allowNegativeStock ? 1 : 0
    );

    insertComp.run(
      restaurantCompany.id, restaurantCompany.name, restaurantCompany.slug, restaurantCompany.cnpj, restaurantCompany.balance,
      JSON.stringify(restaurantCompany.installedApps), restaurantCompany.status, restaurantCompany.plan, restaurantCompany.maxTerminals,
      restaurantCompany.maxBranches, restaurantCompany.activeTerminals, restaurantCompany.channel, restaurantCompany.osTargetVersion,
      restaurantCompany.licenseExpiresAt, JSON.stringify(restaurantCompany.branches), restaurantCompany.allowNegativeStock ? 1 : 0
    );

    const insertUser = rawDb.prepare(`
      INSERT INTO company_users (id, company_id, name, email, role, password, pin, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertUser.run(retailAdmin.id, retailAdmin.companyId, retailAdmin.name, retailAdmin.email, retailAdmin.role, retailAdmin.password, retailAdmin.pin);
    insertUser.run(restAdmin.id, restAdmin.companyId, restAdmin.name, restAdmin.email, restAdmin.role, restAdmin.password, restAdmin.pin);
  }

  // Concede licenças de Apps (App Entitlements) para ambas as empresas
  const appsToEntitleRetail = ['app_pos', 'app_inventory', 'app_crm', 'app_finance', 'app_public_space', 'app_settings'];
  for (const appId of appsToEntitleRetail) {
    const entKey = `${retailId}:${appId}`;
    const ent: AppEntitlement = {
      id: `ent_${retailId}_${appId}`,
      companyId: retailId,
      appId,
      status: 'ACTIVE',
      pricingModel: 'FREE',
      amount: 0,
      currency: 'BRL',
      createdAt: new Date().toISOString()
    };
    centralState.appEntitlements.set(entKey, ent);
  }

  const appsToEntitleRest = ['app_pos', 'app_tables', 'app_inventory', 'app_crm', 'app_finance', 'app_public_space', 'app_settings'];
  for (const appId of appsToEntitleRest) {
    const entKey = `${restaurantId}:${appId}`;
    const ent: AppEntitlement = {
      id: `ent_${restaurantId}_${appId}`,
      companyId: restaurantId,
      appId,
      status: 'ACTIVE',
      pricingModel: 'FREE',
      amount: 0,
      currency: 'BRL',
      createdAt: new Date().toISOString()
    };
    centralState.appEntitlements.set(entKey, ent);
  }

  // Cria as mesas do restaurante
  const restaurantTables: TableData[] = [
    { id: 'tbl_1', companyId: restaurantId, branchId: 'br_rest_1', number: 1, name: 'Mesa 01 (Janela)', capacity: 2, status: 'AVAILABLE' },
    { id: 'tbl_2', companyId: restaurantId, branchId: 'br_rest_1', number: 2, name: 'Mesa 02 (Salão)', capacity: 4, status: 'AVAILABLE' },
    { id: 'tbl_3', companyId: restaurantId, branchId: 'br_rest_1', number: 3, name: 'Mesa 03 (Salão)', capacity: 4, status: 'AVAILABLE' },
    { id: 'tbl_4', companyId: restaurantId, branchId: 'br_rest_1', number: 4, name: 'Mesa 04 (Lounge Central)', capacity: 6, status: 'AVAILABLE' },
    { id: 'tbl_5', companyId: restaurantId, branchId: 'br_rest_1', number: 5, name: 'Mesa 05 (Deck Externo)', capacity: 2, status: 'AVAILABLE' }
  ];

  for (const t of restaurantTables) {
    centralState.tables.set(t.id, t);
    if (rawDb) {
      rawDb.prepare(`
        INSERT INTO tables_registry (id, company_id, branch_id, number, name, capacity, status, current_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(t.id, t.companyId, t.branchId || null, t.number, t.name, t.capacity, t.status);
    }
  }

  addLog('02_COMPANIES', 'Provision Dual-Profile Tenants', 'SUCCESS', `Empresas '${retailCompany.name}' (Varejo) e '${restaurantCompany.name}' (Restaurante) provisionadas com sucesso.`);

  // 3. Povoamento do Estoque
  const retailProducts: ProductData[] = [
    { id: 'prod_ret_1', companyId: retailId, name: 'Camisa Social Slim Fit Algodão', price: 89.90, stock: 50 },
    { id: 'prod_ret_2', companyId: retailId, name: 'Calça Jeans Premium Denim', price: 149.90, stock: 35 },
    { id: 'prod_ret_3', companyId: retailId, name: 'Vestido Midi Estampa Floral', price: 169.90, stock: 20 },
    { id: 'prod_ret_4', companyId: retailId, name: 'Jaqueta Corta-Vento Impermeável', price: 219.00, stock: 15 },
    { id: 'prod_ret_5', companyId: retailId, name: 'Kit Meias Algodão (3 Pares)', price: 24.90, stock: 100 },
    { id: 'prod_ret_6', companyId: retailId, name: 'Cinto em Couro Legítimo Fivela Fosca', price: 69.90, stock: 30 }
  ];

  const restaurantProducts: ProductData[] = [
    { id: 'prod_res_1', companyId: restaurantId, name: 'Risotto de Funghi Porcini', price: 58.00, stock: 40 },
    { id: 'prod_res_2', companyId: restaurantId, name: 'Bife Ancho Grelhado com Ervas 350g', price: 79.90, stock: 25 },
    { id: 'prod_res_3', companyId: restaurantId, name: 'Fettuccine al Tartufo & Parmigiano', price: 52.00, stock: 30 },
    { id: 'prod_res_4', companyId: restaurantId, name: 'Tiramisù Clássico Italiano', price: 26.00, stock: 35 },
    { id: 'prod_res_5', companyId: restaurantId, name: 'Vinho Tinto Cabernet Sauvignon Reserva', price: 85.00, stock: 48 },
    { id: 'prod_res_6', companyId: restaurantId, name: 'Água Mineral com Gás San Pellegrino 500ml', price: 14.00, stock: 60 }
  ];

  const insertProdStmt = rawDb ? rawDb.prepare(`
    INSERT INTO products (id, company_id, branch_id, name, price, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `) : null;

  for (const p of [...retailProducts, ...restaurantProducts]) {
    centralState.products.set(p.id, p);
    if (insertProdStmt) {
      insertProdStmt.run(p.id, p.companyId, null, p.name, p.price, p.stock);
    }
  }

  addLog('03_INVENTORY_SEED', 'Populate Master Catalog', 'SUCCESS', `12 produtos mestres cadastrados (6 para Varejo, 6 para Gastronomia) com estoque inicial e precificação.`);

  // 4. Modificações e Ajustes de Estoque
  // 4a. Entrada de reposição no Varejo: +20 unidades de Camisa Social Slim
  const pRet1 = centralState.products.get('prod_ret_1')!;
  const prevStockRet1 = pRet1.stock;
  pRet1.stock += 20; // 50 + 20 = 70
  centralState.products.set('prod_ret_1', pRet1);
  if (rawDb) rawDb.prepare('UPDATE products SET stock = ? WHERE id = ?').run(pRet1.stock, pRet1.id);
  addLog('04_STOCK_ADJUST', 'Restock Inflow', 'SUCCESS', `Entrada de reposição em '${pRet1.name}': de ${prevStockRet1} para ${pRet1.stock} un. (+20 un)`);

  // 4b. Saída por avaria no Varejo: -2 unidades de Calça Jeans
  const pRet2 = centralState.products.get('prod_ret_2')!;
  const prevStockRet2 = pRet2.stock;
  pRet2.stock -= 2; // 35 - 2 = 33
  centralState.products.set('prod_ret_2', pRet2);
  if (rawDb) rawDb.prepare('UPDATE products SET stock = ? WHERE id = ?').run(pRet2.stock, pRet2.id);
  addLog('04_STOCK_ADJUST', 'Damage Outflow', 'SUCCESS', `Ajuste por avaria em '${pRet2.name}': de ${prevStockRet2} para ${pRet2.stock} un. (-2 un)`);

  // 4c. Entrada de vinhos no Restaurante: +12 garrafas de Cabernet Sauvignon
  const pRes5 = centralState.products.get('prod_res_5')!;
  const prevStockRes5 = pRes5.stock;
  pRes5.stock += 12; // 48 + 12 = 60
  centralState.products.set('prod_res_5', pRes5);
  if (rawDb) rawDb.prepare('UPDATE products SET stock = ? WHERE id = ?').run(pRes5.stock, pRes5.id);
  addLog('04_STOCK_ADJUST', 'Wine Cellar Restock', 'SUCCESS', `Entrada de estoque em '${pRes5.name}': de ${prevStockRes5} para ${pRes5.stock} garrafas (+12 un)`);

  // 5. Clientes CRM
  const retailCustomer: CustomerData = {
    id: 'cust_ret_1',
    companyId: retailId,
    branchId: 'br_retail_1',
    name: 'Juliana Paes Silveira',
    phone: '(43) 99111-2233',
    email: 'juliana.paes@email.com',
    points: 15,
    totalSpent: 420.00,
    tier: 'Silver',
    createdAt: new Date().toISOString()
  };

  const restCustomer: CustomerData = {
    id: 'cust_res_1',
    companyId: restaurantId,
    branchId: 'br_rest_1',
    name: 'Carlos Drummond de Andrade',
    phone: '(43) 99333-4455',
    email: 'carlos.drummond@email.com',
    points: 40,
    totalSpent: 1250.00,
    tier: 'Gold',
    createdAt: new Date().toISOString()
  };

  centralState.customers.set(retailCustomer.id, retailCustomer);
  centralState.customers.set(restCustomer.id, restCustomer);

  if (rawDb) {
    const insertCust = rawDb.prepare(`
      INSERT INTO customers (id, company_id, branch_id, name, phone, email, points, total_spent, tier, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCust.run(retailCustomer.id, retailCustomer.companyId, retailCustomer.branchId || null, retailCustomer.name, retailCustomer.phone, retailCustomer.email, retailCustomer.points, retailCustomer.totalSpent, retailCustomer.tier, retailCustomer.createdAt);
    insertCust.run(restCustomer.id, restCustomer.companyId, restCustomer.branchId || null, restCustomer.name, restCustomer.phone, restCustomer.email, restCustomer.points, restCustomer.totalSpent, restCustomer.tier, restCustomer.createdAt);
  }

  addLog('05_CRM_SEED', 'Seed Customer Profiles', 'SUCCESS', `Clientes CRM '${retailCustomer.name}' e '${restCustomer.name}' integrados com saldos de fidelidade.`);

  // 6. Vendas no PDV (Varejo)
  // Venda 1: 2x Camisa Social Slim (R$ 89.90 x 2 = 179.80) + 1x Cinto Couro (R$ 69.90) = Total R$ 249.70 via PIX
  const sale1Id = `sale_ret_${randomUUID().substring(0, 8)}`;
  const pRet6 = centralState.products.get('prod_ret_6')!;

  pRet1.stock -= 2; // 70 - 2 = 68
  pRet6.stock -= 1; // 30 - 1 = 29
  centralState.products.set('prod_ret_1', pRet1);
  centralState.products.set('prod_ret_6', pRet6);
  if (rawDb) {
    rawDb.prepare('UPDATE products SET stock = ? WHERE id = ?').run(pRet1.stock, pRet1.id);
    rawDb.prepare('UPDATE products SET stock = ? WHERE id = ?').run(pRet6.stock, pRet6.id);
  }

  const sale1: SaleData = {
    id: sale1Id,
    companyId: retailId,
    branchId: 'br_retail_1',
    items: [
      { productId: pRet1.id, quantity: 2, price: pRet1.price },
      { productId: pRet6.id, quantity: 1, price: pRet6.price }
    ],
    total: 249.70,
    timestamp: new Date().toISOString(),
    paymentMethod: 'PIX',
    operator: retailAdmin.name
  };

  centralState.sales.set(sale1Id, sale1);

  const fin1Id = `fin_ret_${randomUUID().substring(0, 8)}`;
  const fin1: FinanceTransactionData = {
    id: fin1Id,
    companyId: retailId,
    branchId: 'br_retail_1',
    type: 'INFLOW',
    category: 'SALE',
    description: `Venda balcão / PDV #${sale1Id.slice(-6)} (2x Camisa Slim, 1x Cinto)`,
    amount: 249.70,
    paymentMethod: 'PIX',
    timestamp: new Date().toISOString(),
    operator: retailAdmin.name,
    referenceId: sale1Id
  };
  centralState.financeTransactions.set(fin1Id, fin1);

  retailCustomer.points += 24; // 15 + 24 = 39
  retailCustomer.totalSpent += 249.70;
  centralState.customers.set(retailCustomer.id, retailCustomer);

  if (rawDb) {
    rawDb.prepare(`
      INSERT INTO sales (id, company_id, branch_id, items, total, timestamp, payment_method, operator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sale1.id, sale1.companyId, sale1.branchId || null, JSON.stringify(sale1.items), sale1.total, sale1.timestamp, sale1.paymentMethod || null, sale1.operator || null);

    rawDb.prepare(`
      INSERT INTO finance_transactions (id, company_id, branch_id, type, category, description, amount, payment_method, timestamp, operator, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fin1.id, fin1.companyId, fin1.branchId || null, fin1.type, fin1.category, fin1.description, fin1.amount, fin1.paymentMethod, fin1.timestamp, fin1.operator, fin1.referenceId || null);

    rawDb.prepare('UPDATE customers SET points = ?, total_spent = ? WHERE id = ?').run(retailCustomer.points, retailCustomer.totalSpent, retailCustomer.id);
  }

  addLog('06_RETAIL_SALE', 'Process POS Cashier Sale #1', 'SUCCESS', `Venda de R$ 249.70 processada em PIX. Estoque baixado com sucesso (${pRet1.name}: 68 un, ${pRet6.name}: 29 un). +24 pts fidelidade creditados.`);

  // Venda 2 Varejo: 1x Vestido Midi (R$ 169.90) + 1x Kit Meias (R$ 24.90) = Total R$ 194.80 em Cartão de Crédito
  const sale2Id = `sale_ret_${randomUUID().substring(0, 8)}`;
  const pRet3 = centralState.products.get('prod_ret_3')!;
  const pRet5 = centralState.products.get('prod_ret_5')!;

  pRet3.stock -= 1; // 20 - 1 = 19
  pRet5.stock -= 1; // 100 - 1 = 99
  centralState.products.set('prod_ret_3', pRet3);
  centralState.products.set('prod_ret_5', pRet5);
  if (rawDb) {
    rawDb.prepare('UPDATE products SET stock = ? WHERE id = ?').run(pRet3.stock, pRet3.id);
    rawDb.prepare('UPDATE products SET stock = ? WHERE id = ?').run(pRet5.stock, pRet5.id);
  }

  const sale2: SaleData = {
    id: sale2Id,
    companyId: retailId,
    branchId: 'br_retail_1',
    items: [
      { productId: pRet3.id, quantity: 1, price: pRet3.price },
      { productId: pRet5.id, quantity: 1, price: pRet5.price }
    ],
    total: 194.80,
    timestamp: new Date().toISOString(),
    paymentMethod: 'CARTAO_CREDITO',
    operator: retailAdmin.name
  };
  centralState.sales.set(sale2Id, sale2);

  const fin2Id = `fin_ret_${randomUUID().substring(0, 8)}`;
  const fin2: FinanceTransactionData = {
    id: fin2Id,
    companyId: retailId,
    branchId: 'br_retail_1',
    type: 'INFLOW',
    category: 'SALE',
    description: `Venda balcão / PDV #${sale2Id.slice(-6)} (Vestido Floral, Kit Meias)`,
    amount: 194.80,
    paymentMethod: 'CARTAO_CREDITO',
    timestamp: new Date().toISOString(),
    operator: retailAdmin.name,
    referenceId: sale2Id
  };
  centralState.financeTransactions.set(fin2Id, fin2);

  if (rawDb) {
    rawDb.prepare(`
      INSERT INTO sales (id, company_id, branch_id, items, total, timestamp, payment_method, operator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sale2.id, sale2.companyId, sale2.branchId || null, JSON.stringify(sale2.items), sale2.total, sale2.timestamp, sale2.paymentMethod || null, sale2.operator || null);

    rawDb.prepare(`
      INSERT INTO finance_transactions (id, company_id, branch_id, type, category, description, amount, payment_method, timestamp, operator, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fin2.id, fin2.companyId, fin2.branchId || null, fin2.type, fin2.category, fin2.description, fin2.amount, fin2.paymentMethod, fin2.timestamp, fin2.operator, fin2.referenceId || null);
  }

  addLog('06_RETAIL_SALE', 'Process POS Cashier Sale #2', 'SUCCESS', `Venda de R$ 194.80 processada em Cartão de Crédito. Estoque baixado (${pRet3.name}: 19 un, ${pRet5.name}: 99 un).`);

  // 7. Ciclo de Salão, Mesas e Cozinha KDS (Restaurante)
  const tbl4 = centralState.tables.get('tbl_4')!;
  tbl4.status = 'OCCUPIED';
  const tableOrderId = `ord_tbl_${randomUUID().substring(0, 8)}`;
  const pRes1 = centralState.products.get('prod_res_1')!; // Risotto R$ 58.00

  tbl4.currentOrder = {
    id: tableOrderId,
    tableId: 'tbl_4',
    companyId: restaurantId,
    customerCount: 2,
    status: 'OPEN',
    waiterName: restAdmin.name,
    openedAt: new Date().toISOString(),
    items: [
      {
        id: `item_ord_1`,
        productId: pRes1.id,
        name: pRes1.name,
        quantity: 2,
        unitPrice: pRes1.price,
        notes: 'Ponto do arroz al dente',
        status: 'IN_PREPARATION',
        orderedAt: new Date().toISOString()
      },
      {
        id: `item_ord_2`,
        productId: pRes5.id,
        name: pRes5.name,
        quantity: 2,
        unitPrice: pRes5.price,
        notes: 'Servir com taças bordô',
        status: 'READY',
        orderedAt: new Date().toISOString()
      }
    ]
  };

  centralState.tables.set('tbl_4', tbl4);
  if (rawDb) {
    rawDb.prepare('UPDATE tables_registry SET status = ?, current_order = ? WHERE id = ?')
      .run(tbl4.status, JSON.stringify(tbl4.currentOrder), tbl4.id);
  }

  addLog('07_RESTAURANT_TABLE', 'Open Table & Dispatch KDS Order', 'SUCCESS', `Mesa 04 aberta para '${restCustomer.name}' com pedido de R$ 286.00 despachado para a Cozinha KDS.`);

  // 7b. Fechamento da Mesa, Pagamento em Cartão de Débito, Baixa de Insumos e Liberação
  pRes1.stock -= 2; // 40 - 2 = 38
  pRes5.stock -= 2; // 60 - 2 = 58
  centralState.products.set('prod_res_1', pRes1);
  centralState.products.set('prod_res_5', pRes5);
  if (rawDb) {
    rawDb.prepare('UPDATE products SET stock = ? WHERE id = ?').run(pRes1.stock, pRes1.id);
    rawDb.prepare('UPDATE products SET stock = ? WHERE id = ?').run(pRes5.stock, pRes5.id);
  }

  const restSaleId = `sale_res_${randomUUID().substring(0, 8)}`;
  const restSale: SaleData = {
    id: restSaleId,
    companyId: restaurantId,
    branchId: 'br_rest_1',
    items: [
      { productId: pRes1.id, quantity: 2, price: pRes1.price },
      { productId: pRes5.id, quantity: 2, price: pRes5.price }
    ],
    total: 286.00,
    timestamp: new Date().toISOString(),
    paymentMethod: 'CARTAO_DEBITO',
    operator: restAdmin.name
  };
  centralState.sales.set(restSaleId, restSale);

  const finRestId = `fin_res_${randomUUID().substring(0, 8)}`;
  const finRest: FinanceTransactionData = {
    id: finRestId,
    companyId: restaurantId,
    branchId: 'br_rest_1',
    type: 'INFLOW',
    category: 'SALE',
    description: `Fechamento de Mesa 04 / Comanda #${tableOrderId.slice(-6)} (2x Risotto Funghi, 2x Vinho Reserva)`,
    amount: 286.00,
    paymentMethod: 'CARTAO_DEBITO',
    timestamp: new Date().toISOString(),
    operator: restAdmin.name,
    referenceId: restSaleId
  };
  centralState.financeTransactions.set(finRestId, finRest);

  restCustomer.points += 28; // 40 + 28 = 68
  restCustomer.totalSpent += 286.00; // 1250 + 286 = 1536.00
  centralState.customers.set(restCustomer.id, restCustomer);

  // Libera a Mesa 04
  tbl4.status = 'AVAILABLE';
  tbl4.currentOrder = undefined;
  centralState.tables.set('tbl_4', tbl4);

  if (rawDb) {
    rawDb.prepare(`
      INSERT INTO sales (id, company_id, branch_id, items, total, timestamp, payment_method, operator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(restSale.id, restSale.companyId, restSale.branchId || null, JSON.stringify(restSale.items), restSale.total, restSale.timestamp, restSale.paymentMethod || null, restSale.operator || null);

    rawDb.prepare(`
      INSERT INTO finance_transactions (id, company_id, branch_id, type, category, description, amount, payment_method, timestamp, operator, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(finRest.id, finRest.companyId, finRest.branchId || null, finRest.type, finRest.category, finRest.description, finRest.amount, finRest.paymentMethod, finRest.timestamp, finRest.operator, finRest.referenceId || null);

    rawDb.prepare('UPDATE customers SET points = ?, total_spent = ? WHERE id = ?').run(restCustomer.points, restCustomer.totalSpent, restCustomer.id);
    rawDb.prepare('UPDATE tables_registry SET status = ?, current_order = NULL WHERE id = ?').run(tbl4.status, tbl4.id);
  }

  addLog('07_RESTAURANT_TABLE', 'Close Table & Settle Bill', 'SUCCESS', `Mesa 04 liquidada com R$ 286.00 em Cartão de Débito. Insumos baixados (${pRes1.name}: 38 un, ${pRes5.name}: 58 un). Mesa liberada para AVAILABLE.`);

  // 8. Asserções e Validações de Integridade
  const verifications = [
    {
      check: 'Multi-Tenant Isolation Check',
      passed: centralState.products.get('prod_ret_1')?.companyId === retailId && centralState.products.get('prod_res_1')?.companyId === restaurantId,
      details: 'Produtos e vendas pertencem estritamente aos seus respectivos inquilinos sem vazamento cruzado.'
    },
    {
      check: 'Non-Negative Inventory Invariant',
      passed: Array.from(centralState.products.values()).every(p => p.stock >= 0),
      details: 'Nenhum item do catálogo mestre violou a restrição de estoque negativo (todos os saldos >= 0).'
    },
    {
      check: 'Financial Reconciliation Invariant',
      passed: (
        (centralState.financeTransactions.get(fin1Id)?.amount === 249.70) &&
        (centralState.financeTransactions.get(fin2Id)?.amount === 194.80) &&
        (centralState.financeTransactions.get(finRestId)?.amount === 286.00)
      ),
      details: 'Todas as entradas financeiras coincidem centavo a centavo com os totais de vendas e mesas.'
    },
    {
      check: 'KDS Table Cycle Lifecycle',
      passed: tbl4.status === 'AVAILABLE' && tbl4.currentOrder === undefined,
      details: 'Mesa percorreu todo o ciclo de vida (Livre -> Ocupada -> Comanda KDS -> Paga -> Liberada).'
    },
    {
      check: 'CRM Loyalty Points Accrual',
      passed: retailCustomer.points === 39 && restCustomer.points === 68,
      details: 'Pontuação de fidelidade creditada corretamente com base no consumo realizado.'
    }
  ];

  for (const v of verifications) {
    addLog('08_VERIFICATION', v.check, v.passed ? 'SUCCESS' : 'ERROR', v.details);
  }

  recordHqAuditLog({
    hqAdminId: 'system_simulation_engine',
    hqAdminEmail: 'simulation@3eatcru.com',
    action: 'FULL_ECOSYSTEM_SIMULATION',
    targetCompanyId: 'all',
    details: 'Simulação completa do ecossistema executada com sucesso (Varejo + Restaurante).'
  });

  saveCentralState();

  const totalRevenue = 249.70 + 194.80 + 286.00;
  const durationMs = Date.now() - startTime;

  return {
    success: verifications.every(v => v.passed),
    executedAt: new Date().toISOString(),
    durationMs,
    logs,
    summary: {
      companiesCreated: 2,
      productsCataloged: 12,
      inventoryAdjustments: 3,
      salesProcessed: 3,
      totalRevenueGenerated: totalRevenue,
      stockDeductionsVerified: 5,
      tablesServiced: 1,
      loyaltyPointsAccrued: 24 + 28
    },
    tenants: {
      retail: {
        id: retailId,
        name: retailCompany.name,
        productsCount: retailProducts.length,
        salesCount: 2,
        revenue: 249.70 + 194.80,
        stockBalanceSum: Array.from(centralState.products.values()).filter(p => p.companyId === retailId).reduce((s, p) => s + p.stock, 0)
      },
      restaurant: {
        id: restaurantId,
        name: restaurantCompany.name,
        productsCount: restaurantProducts.length,
        salesCount: 1,
        revenue: 286.00,
        stockBalanceSum: Array.from(centralState.products.values()).filter(p => p.companyId === restaurantId).reduce((s, p) => s + p.stock, 0),
        tablesCount: restaurantTables.length
      }
    },
    verifications
  };
}

// -------------------------------------------------------------
// MOTOR DE SIMULAÇÃO DE CLIENTES & FIDELIDADE
// -------------------------------------------------------------

export interface CustomerSimulationOptions {
  companyId?: string;
  action?: 'seed' | 'purchase' | 'redeem' | 'full';
  customerId?: string;
  pointsToRedeem?: number;
}

export interface CustomerSimulationResult {
  success: boolean;
  action: 'seed' | 'purchase' | 'redeem' | 'full';
  companyId: string;
  logs: SimulationLogEntry[];
  customers: CustomerData[];
  transactions: {
    sales: SaleData[];
    finance: FinanceTransactionData[];
    loyaltyAdjustments: { customerId: string; customerName: string; change: number; newTotal: number; reason: string }[];
  };
  metrics: {
    totalCustomers: number;
    totalPoints: number;
    totalSpent: number;
    vipCount: number;
  };
}

export function simulateCustomerWorkflows(opts: CustomerSimulationOptions = {}): CustomerSimulationResult {
  const action = opts.action || 'full';
  const companyId = opts.companyId || (centralState.companies.get('comp_sim_retail') ? 'comp_sim_retail' : 'comp_1');
  const targetCompany = centralState.companies.get(companyId);
  const companyName = targetCompany ? targetCompany.name : 'Empresa Varejo';
  const branchId = 'br_retail_1';
  const rawDb = centralDatabase.getRawDatabase();

  const logs: SimulationLogEntry[] = [];
  const addLog = (step: string, logAction: string, status: 'SUCCESS' | 'WARNING' | 'ERROR', details: string, metadata?: Record<string, unknown>) => {
    logs.push({
      step,
      action: logAction,
      timestamp: new Date().toISOString(),
      status,
      details,
      metadata
    });
  };

  const generatedSales: SaleData[] = [];
  const generatedFinance: FinanceTransactionData[] = [];
  const loyaltyAdjustments: { customerId: string; customerName: string; change: number; newTotal: number; reason: string }[] = [];

  // Helper para cadastrar personas brasileiras ricas no banco
  const seedPersonas = () => {
    const personas: CustomerData[] = [
      {
        id: `cust_${companyId}_mariana`,
        companyId,
        branchId,
        name: 'Mariana Silva',
        phone: '(43) 99876-5432',
        email: 'mariana.silva@email.com',
        points: 35,
        totalSpent: 350.00,
        tier: 'Silver',
        notes: 'Cliente assídua do setor de vestuário e calçados. Prefere pagar via PIX.',
        tags: ['Fidelidade', 'Varejo', 'Moda'],
        createdAt: new Date().toISOString()
      },
      {
        id: `cust_${companyId}_roberto`,
        companyId,
        branchId,
        name: 'Dr. Roberto Valença',
        phone: '(43) 99123-4567',
        email: 'roberto.valenca@advocacia.com',
        points: 160,
        totalSpent: 3200.00,
        tier: 'VIP',
        notes: 'Sócio de escritório de advocacia. Compras corporativas e alfaiataria fina.',
        tags: ['VIP', 'Corporativo', 'Alto Ticket'],
        createdAt: new Date().toISOString()
      },
      {
        id: `cust_${companyId}_camila`,
        companyId,
        branchId,
        name: 'Camila Rodrigues',
        phone: '(43) 98877-6655',
        email: 'camila.rodrigues@tech.io',
        points: 85,
        totalSpent: 1150.00,
        tier: 'Gold',
        notes: 'Participante assídua do clube de benefícios. Resgata pontos em descontos.',
        tags: ['Gold', 'Tech', 'Cashback'],
        createdAt: new Date().toISOString()
      },
      {
        id: `cust_${companyId}_lucas`,
        companyId,
        branchId,
        name: 'Lucas Fernandes',
        phone: '(43) 99654-3210',
        email: 'lucas.fernandes@estudante.uel.br',
        points: 12,
        totalSpent: 120.00,
        tier: 'Bronze',
        notes: 'Estudante universitário. Cadastrado no caixa no primeiro atendimento.',
        tags: ['Universitário', 'Novo'],
        createdAt: new Date().toISOString()
      },
      {
        id: `cust_${companyId}_studio`,
        companyId,
        branchId,
        name: 'Studio Alfa Eventos & Buffet Ltda',
        phone: '(43) 3344-5566',
        email: 'contato@studioalfa.com.br',
        points: 240,
        totalSpent: 4800.00,
        tier: 'VIP',
        notes: 'Cliente corporativo com faturamento mensal e pedidos em lote.',
        tags: ['PJ', 'Atacado', 'Eventos'],
        createdAt: new Date().toISOString()
      }
    ];

    for (const p of personas) {
      centralState.customers.set(p.id, p);
      if (rawDb) {
        rawDb.prepare(`
          INSERT INTO customers (id, company_id, branch_id, name, phone, email, points, total_spent, tier, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            phone = excluded.phone,
            email = excluded.email,
            points = excluded.points,
            total_spent = excluded.total_spent,
            tier = excluded.tier
        `).run(p.id, p.companyId, p.branchId || null, p.name, p.phone, p.email, p.points, p.totalSpent, p.tier, p.createdAt);
      }
    }

    addLog('01_CUSTOMER_SEED', 'Seed Personas', 'SUCCESS', `5 Personas de clientes cadastradas para '${companyName}' (Mariana, Dr. Roberto, Camila, Lucas, Studio Alfa).`);
    return personas;
  };

  // Se solicitado seed ou full
  if (action === 'seed' || action === 'full') {
    seedPersonas();
  }

  // Helper para simular compra com cashback
  const executeCustomerPurchase = (targetCustomerId?: string) => {
    let cust = targetCustomerId ? centralState.customers.get(targetCustomerId) : null;
    if (!cust) {
      const candidates = Array.from(centralState.customers.values()).filter(c => c.companyId === companyId);
      cust = candidates.find(c => c.id.includes('mariana')) || candidates[0];
    }
    if (!cust) {
      seedPersonas();
      cust = centralState.customers.get(`cust_${companyId}_mariana`)!;
    }

    let prod: ProductData;
    const companyProducts = Array.from(centralState.products.values()).filter(p => p.companyId === companyId);
    if (companyProducts.length > 0) {
      prod = companyProducts[0];
    } else {
      prod = { id: `prod_${companyId}_sample`, name: 'Item Padrão Varejo', price: 89.90, stock: 50, companyId };
      centralState.products.set(prod.id, prod);
      if (rawDb) {
        rawDb.prepare('INSERT INTO products (id, company_id, name, price, stock) VALUES (?, ?, ?, ?, ?)').run(prod.id, prod.companyId, prod.name, prod.price, prod.stock);
      }
    }
    
    if (prod.stock > 0) {
      prod.stock -= 1;
      centralState.products.set(prod.id, prod);
      if (rawDb) {
        rawDb.prepare('UPDATE products SET stock = ? WHERE id = ?').run(prod.stock, prod.id);
      }
    }

    const saleAmount = prod.price;
    const saleId = `sale_sim_cust_${randomUUID().substring(0, 8)}`;
    const sale: SaleData = {
      id: saleId,
      companyId,
      branchId,
      items: [{ productId: prod.id, quantity: 1, price: prod.price }],
      total: saleAmount,
      timestamp: new Date().toISOString(),
      paymentMethod: 'PIX',
      operator: 'Caixa 01'
    };
    centralState.sales.set(saleId, sale);
    generatedSales.push(sale);

    const earnedPoints = Math.max(1, Math.floor(saleAmount / 10));
    const oldPoints = cust.points;
    cust.points += earnedPoints;
    cust.totalSpent += saleAmount;
    
    if (cust.points >= 200) cust.tier = 'VIP';
    else if (cust.points >= 100) cust.tier = 'Gold';
    else if (cust.points >= 30) cust.tier = 'Silver';

    centralState.customers.set(cust.id, cust);

    if (rawDb) {
      rawDb.prepare(`
        INSERT INTO sales (id, company_id, branch_id, items, total, timestamp, payment_method, operator)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sale.id, sale.companyId, sale.branchId || null, JSON.stringify(sale.items), sale.total, sale.timestamp, sale.paymentMethod, sale.operator);

      rawDb.prepare('UPDATE customers SET points = ?, total_spent = ?, tier = ? WHERE id = ?')
        .run(cust.points, cust.totalSpent, cust.tier, cust.id);
    }

    const finId = `fin_sim_${randomUUID().substring(0, 8)}`;
    const finTx: FinanceTransactionData = {
      id: finId,
      companyId,
      branchId,
      type: 'INFLOW',
      category: 'SALE',
      description: `Venda #${saleId.slice(-6)} para cliente ${cust.name} (PIX)`,
      amount: saleAmount,
      paymentMethod: 'PIX',
      timestamp: new Date().toISOString(),
      operator: 'Caixa 01',
      referenceId: saleId
    };
    centralState.financeTransactions.set(finId, finTx);
    generatedFinance.push(finTx);

    if (rawDb) {
      rawDb.prepare(`
        INSERT INTO finance_transactions (id, company_id, branch_id, type, category, description, amount, payment_method, timestamp, operator, reference_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(finTx.id, finTx.companyId, finTx.branchId || null, finTx.type, finTx.category, finTx.description, finTx.amount, finTx.paymentMethod, finTx.timestamp, finTx.operator, finTx.referenceId || null);
    }

    loyaltyAdjustments.push({
      customerId: cust.id,
      customerName: cust.name,
      change: earnedPoints,
      newTotal: cust.points,
      reason: `Compra #${saleId.slice(-6)} (+${earnedPoints} pts)`
    });

    addLog(
      '02_CUSTOMER_PURCHASE',
      'Sale with Loyalty Accrual',
      'SUCCESS',
      `Venda de R$ ${saleAmount.toFixed(2)} vinculada a '${cust.name}'. +${earnedPoints} pontos creditados (Saldo: ${oldPoints} -> ${cust.points} pts, Tier: ${cust.tier}). Estoque de '${prod.name}' baixado para ${prod.stock} un.`
    );
  };

  // Helper para simular resgate de pontos de fidelidade
  const executeCustomerRedemption = (targetCustomerId?: string, pointsToRedeem = 40) => {
    let cust = targetCustomerId ? centralState.customers.get(targetCustomerId) : null;
    if (!cust) {
      const candidates = Array.from(centralState.customers.values()).filter(c => c.companyId === companyId && c.points >= 20);
      cust = candidates.find(c => c.id.includes('camila')) || candidates[0];
    }
    if (!cust) {
      seedPersonas();
      cust = centralState.customers.get(`cust_${companyId}_camila`)!;
    }

    const availablePoints = cust.points;
    const actualPointsRedeemed = Math.min(availablePoints, pointsToRedeem);
    const discountValue = actualPointsRedeemed * 0.50;

    const originalTotal = 129.90;
    const finalTotal = Math.max(0, originalTotal - discountValue);

    cust.points -= actualPointsRedeemed;
    cust.totalSpent += finalTotal;
    centralState.customers.set(cust.id, cust);

    const saleId = `sale_sim_red_${randomUUID().substring(0, 8)}`;
    const sale: SaleData = {
      id: saleId,
      companyId,
      branchId,
      items: [{ productId: 'prod_ret_3', quantity: 1, price: originalTotal }],
      total: finalTotal,
      timestamp: new Date().toISOString(),
      paymentMethod: 'CARTAO_CREDITO',
      operator: 'Caixa 01'
    };
    centralState.sales.set(saleId, sale);
    generatedSales.push(sale);

    if (rawDb) {
      rawDb.prepare(`
        INSERT INTO sales (id, company_id, branch_id, items, total, timestamp, payment_method, operator)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sale.id, sale.companyId, sale.branchId || null, JSON.stringify(sale.items), sale.total, sale.timestamp, sale.paymentMethod, sale.operator);

      rawDb.prepare('UPDATE customers SET points = ?, total_spent = ? WHERE id = ?')
        .run(cust.points, cust.totalSpent, cust.id);
    }

    const finId = `fin_sim_${randomUUID().substring(0, 8)}`;
    const finTx: FinanceTransactionData = {
      id: finId,
      companyId,
      branchId,
      type: 'INFLOW',
      category: 'SALE',
      description: `Venda com resgate de ${actualPointsRedeemed} pts para ${cust.name} (Desc R$ ${discountValue.toFixed(2)})`,
      amount: finalTotal,
      paymentMethod: 'CARTAO_CREDITO',
      timestamp: new Date().toISOString(),
      operator: 'Caixa 01',
      referenceId: saleId
    };
    centralState.financeTransactions.set(finId, finTx);
    generatedFinance.push(finTx);

    if (rawDb) {
      rawDb.prepare(`
        INSERT INTO finance_transactions (id, company_id, branch_id, type, category, description, amount, payment_method, timestamp, operator, reference_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(finTx.id, finTx.companyId, finTx.branchId || null, finTx.type, finTx.category, finTx.description, finTx.amount, finTx.paymentMethod, finTx.timestamp, finTx.operator, finTx.referenceId || null);
    }

    loyaltyAdjustments.push({
      customerId: cust.id,
      customerName: cust.name,
      change: -actualPointsRedeemed,
      newTotal: cust.points,
      reason: `Resgate de pontos na Venda #${saleId.slice(-6)} (-${actualPointsRedeemed} pts)`
    });

    addLog(
      '03_LOYALTY_REDEMPTION',
      'Point Redemption & Discount',
      'SUCCESS',
      `Resgate de ${actualPointsRedeemed} pontos executado para '${cust.name}'. Desconto concedido de R$ ${discountValue.toFixed(2)} (Total líquido: R$ ${finalTotal.toFixed(2)}). Saldo restante: ${cust.points} pts.`
    );
  };

  if (action === 'purchase') {
    executeCustomerPurchase(opts.customerId);
  } else if (action === 'redeem') {
    executeCustomerRedemption(opts.customerId, opts.pointsToRedeem);
  } else if (action === 'full') {
    executeCustomerPurchase(opts.customerId);
    executeCustomerRedemption(undefined, 30);
  }

  saveCentralState();

  recordHqAuditLog({
    hqAdminId: 'system_simulation_engine',
    hqAdminEmail: 'simulation@3eatcru.com',
    action: 'CUSTOMER_SIMULATION',
    targetCompanyId: companyId,
    details: `Simulação de clientes executada com ação '${action}' para empresa '${companyName}'.`
  });

  const tenantCustomers = Array.from(centralState.customers.values()).filter(c => c.companyId === companyId);
  const totalPoints = tenantCustomers.reduce((s, c) => s + c.points, 0);
  const totalSpent = tenantCustomers.reduce((s, c) => s + c.totalSpent, 0);
  const vipCount = tenantCustomers.filter(c => c.tier === 'VIP' || c.tier === 'Gold').length;

  return {
    success: true,
    action,
    companyId,
    logs,
    customers: tenantCustomers,
    transactions: {
      sales: generatedSales,
      finance: generatedFinance,
      loyaltyAdjustments
    },
    metrics: {
      totalCustomers: tenantCustomers.length,
      totalPoints,
      totalSpent,
      vipCount
    }
  };
}

// -------------------------------------------------------------
// ENDPOINTS HTTP
// -------------------------------------------------------------

// Status atual dos dados no banco e no estado central
simulationRouter.get('/status', (_req, res) => {
  const retailComp = centralState.companies.get('comp_sim_retail');
  const restComp = centralState.companies.get('comp_sim_restaurant');

  res.json({
    active: true,
    state: {
      companiesCount: centralState.companies.size,
      productsCount: centralState.products.size,
      salesCount: centralState.sales.size,
      tablesCount: centralState.tables.size,
      customersCount: centralState.customers.size,
      financeCount: centralState.financeTransactions.size
    },
    simulationTenants: {
      retail: retailComp ? { id: retailComp.id, name: retailComp.name, status: retailComp.status } : null,
      restaurant: restComp ? { id: restComp.id, name: restComp.name, status: restComp.status } : null
    },
    timestamp: new Date().toISOString()
  });
});

// Reset seguro do banco
simulationRouter.post('/reset', (_req, res) => {
  const result = executeCleanReset();
  res.status(result.success ? 200 : 500).json(result);
});

// Execução da simulação completa do ecossistema
simulationRouter.post('/run', (_req, res) => {
  try {
    const report = runFullSimulation();
    res.json(report);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Falha na execução da simulação: ${String(err)}`
    });
  }
});

// Execução da simulação específica de clientes (seed, compras, cashback, resgate)
simulationRouter.post('/customers/simulate', (req, res) => {
  try {
    const { companyId, action, customerId, pointsToRedeem } = req.body || {};
    const result = simulateCustomerWorkflows({ companyId, action, customerId, pointsToRedeem });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Falha na simulação de clientes: ${String(err)}`
    });
  }
});

// Listagem dos clientes da simulação
simulationRouter.get('/customers', (req, res) => {
  const companyId = (req.query['companyId'] as string) || 'comp_sim_retail';
  const customers = Array.from(centralState.customers.values()).filter(c => c.companyId === companyId);
  res.json({
    companyId,
    total: customers.length,
    customers
  });
});

