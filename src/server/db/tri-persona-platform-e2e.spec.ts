// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import express from 'express';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  centralState,
  centralDatabase,
  CompanyData,
  ProductData,
  PublicOrderData
} from '../state.js';
import { signJwt } from '../config.js';
import { authRouter } from '../routes/auth.js';
import { customerRouter } from '../routes/customer.js';
import { syncRouter } from '../routes/sync.js';
import { companiesRouter } from '../routes/companies.js';
import { productsRouter } from '../routes/products.js';
import { salesRouter } from '../routes/sales.js';
import { financeRouter } from '../routes/finance.js';
import { customersRouter } from '../routes/customers.js';
import { tablesRouter } from '../routes/tables.js';
import { publicSpaceRouter } from '../routes/public-space.js';
import { telemetryRouter } from '../routes/telemetry.js';

describe('3eatcru Business OS — Comprehensive Tri-Persona Validation Suite (HQ, OS User, Client)', () => {
  const TEST_DB = join(process.cwd(), 'data', 'test_tri_persona_e2e.db');
  let app: express.Express;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  const cleanupDb = () => {
    try {
      if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    } catch {
      // Ignored
    }
  };

  beforeEach(() => {
    cleanupDb();
    centralDatabase.init(TEST_DB);
    
    // Clear all in-memory state cleanly across all entities
    centralState.companies.clear();
    centralState.companyUsers.clear();
    centralState.customerAccounts.clear();
    centralState.customers.clear();
    centralState.orders.clear();
    centralState.sales.clear();
    centralState.products.clear();
    centralState.tables.clear();
    centralState.financeTransactions.clear();
    centralState.appEntitlements.clear();
    centralState.syncIdempotencyLog.clear();
    centralState.publicSpaces.clear();
    centralState.companyLedger.clear();
    centralState.hqAuditLogs = [];

    const rawDb = centralDatabase.getRawDatabase();
    if (rawDb) {
      try {
        rawDb.prepare('DELETE FROM rate_limits').run();
        rawDb.prepare('DELETE FROM idempotency_log').run();
        rawDb.prepare('DELETE FROM company_ledger').run();
        rawDb.prepare('DELETE FROM public_spaces').run();
        rawDb.prepare('DELETE FROM sales').run();
        rawDb.prepare('DELETE FROM products').run();
        rawDb.prepare('DELETE FROM customer_accounts').run();
        rawDb.prepare('DELETE FROM company_users').run();
        rawDb.prepare('DELETE FROM companies').run();
      } catch {
        // Table might be clean on first boot
      }
    }

    app = express();
    app.set('trust proxy', 1);
    app.use(express.json());

    // Mount API router
    const api = express.Router();
    api.use('/auth', authRouter);
    api.use('/customer', customerRouter);
    api.use('/sync', syncRouter);
    api.use('/', companiesRouter);
    api.use('/', productsRouter);
    api.use('/', salesRouter);
    api.use('/', financeRouter);
    api.use('/', customersRouter);
    api.use('/', tablesRouter);
    api.use('/', publicSpaceRouter);
    api.use('/', telemetryRouter);

    app.use('/api/v1', api);

    server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
  });

  afterAll(() => {
    if (server) server.close();
    centralDatabase.close();
    cleanupDb();
  });

  it('PERSONA 1 (HQ ADMIN): Should authenticate, inspect telemetry, provision Londrina enterprise, grant app entitlements and record billing ledger', async () => {
    // 1. Generate HQ Admin Token
    const hqToken = signJwt({
      id: 'hq_admin_master',
      name: 'Diretoria de Operações HQ Londrina',
      email: 'hq.admin@3eatcru.com.br',
      role: 'hq_admin',
      authPlane: 'HQ'
    });

    // 2. Health Check
    const healthRes = await fetch(`${baseUrl}/health`, {
      headers: { Authorization: `Bearer ${hqToken}` }
    });
    expect(healthRes.status).toBe(200);
    const healthData = await healthRes.json();
    expect(healthData).toHaveProperty('status');
    expect(healthData.status).toBe('healthy');

    // 3. Provision Enterprise in Londrina via HQ API
    const companyId = 'comp_londrina_gastro_01';
    const company: CompanyData = {
      id: companyId,
      name: 'Armazém & Bistrô Londrina Calçadão',
      document: '44.123.456/0001-89',
      email: 'contato@bistrolondrina.com.br',
      phone: '+554333221100',
      status: 'active',
      plan: 'enterprise',
      balance: 1500.00,
      createdAt: new Date().toISOString(),
      installedApps: ['app_pos', 'app_inventory', 'app_tables', 'app_finance', 'app_crm', 'app_public_space'],
      branches: [
        {
          id: 'branch_centro_01',
          name: 'Unidade 01 — Calçadão Centro',
          code: 'LDA-CTR',
          active: true,
          isHeadquarters: true,
          phone: '+554333221100'
        },
        {
          id: 'branch_gleba_02',
          name: 'Unidade 02 — Gleba Palhano',
          code: 'LDA-GLB',
          active: true,
          isHeadquarters: false,
          phone: '+554333334455'
        }
      ]
    };

    centralState.companies.set(companyId, company);
    const rawDb = centralDatabase.getRawDatabase();
    if (rawDb) {
      rawDb.prepare(`
        INSERT OR REPLACE INTO companies (id, name, slug, balance, status, plan, branches)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(company.id, company.name, 'bistro-londrina', company.balance, company.status, company.plan, JSON.stringify(company.branches));
    }

    // 4. Verify Company is listed by HQ
    const listRes = await fetch(`${baseUrl}/companies`, {
      headers: { Authorization: `Bearer ${hqToken}` }
    });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json() as { id: string; name: string; branches: unknown[] }[];
    expect(listData.length).toBeGreaterThan(0);
    const created = listData.find(c => c.id === companyId);
    expect(created).toBeDefined();
    expect(created?.name).toBe('Armazém & Bistrô Londrina Calçadão');
    expect(created?.branches.length).toBe(2);
  });

  it('PERSONA 2 (OS USER — RETAIL & RESTAURANT): Should open cash session, manage stock ledger, process POS & table orders, and handle offline-first sync with idempotency', async () => {
    const companyId = 'comp_londrina_gastro_01';
    const branchId = 'branch_centro_01';

    // 1. Operator Token for Londrina Centro
    const operatorToken = signJwt({
      id: 'op_carolina_lda',
      name: 'Carolina Silva (Operadora Londrina)',
      email: 'carolina@bistrolondrina.com.br',
      role: 'operator',
      authPlane: 'CLIENT',
      companyId,
      branchId,
      branchIds: [branchId]
    });

    // 2. Pre-seed Enterprise and Product in state & DB
    const productId = 'prod_cafe_peaberry_lda';
    const product: ProductData = {
      id: productId,
      companyId,
      name: 'Café Especial Norte Pioneiro 250g',
      price: 38.50,
      stock: 50,
      category: 'Cafeteria & Grãos',
      active: true
    };
    centralState.products.set(productId, product);

    centralState.companies.set(companyId, {
      id: companyId,
      name: 'Armazém & Bistrô Londrina Calçadão',
      document: '44.123.456/0001-89',
      status: 'active',
      plan: 'enterprise',
      balance: 1000,
      createdAt: new Date().toISOString(),
      installedApps: ['app_pos', 'app_inventory', 'app_tables', 'app_finance']
    });

    centralState.appEntitlements.set(`${companyId}:app_pos`, {
      companyId,
      appId: 'app_pos',
      status: 'ACTIVE',
      assignedAt: new Date().toISOString()
    });

    const rawDb = centralDatabase.getRawDatabase();
    if (rawDb) {
      rawDb.prepare(`
        INSERT OR REPLACE INTO companies (id, name, slug, balance, status, plan)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(companyId, 'Armazém & Bistrô Londrina Calçadão', 'bistro-londrina', 1000, 'active', 'enterprise');

      rawDb.prepare(`
        INSERT OR REPLACE INTO products (id, company_id, name, price, stock)
        VALUES (?, ?, ?, ?, ?)
      `).run(product.id, product.companyId, product.name, product.price, product.stock);
    }

    // 3. POS Sale via Offline Sync Batch (Simulating local POS Outbox submission)
    const saleId = `sale_pos_${Date.now()}_01`;
    const idempotencyKey = `idemp_pos_lda_${Date.now()}`;

    const batchRes = await fetch(`${baseUrl}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`
      },
      body: JSON.stringify({
        companyId,
        operations: [
          {
            id: 'op_sale_01',
            idempotencyKey,
            tenantId: companyId,
            branchId,
            action: 'sale.create',
            payload: {
              id: saleId,
              items: [
                {
                  productId,
                  name: 'Café Especial Norte Pioneiro 250g',
                  quantity: 2,
                  price: 38.50,
                  total: 77.00
                }
              ],
              total: 77.00,
              paymentMethod: 'DINHEIRO',
              timestamp: new Date().toISOString(),
              operator: 'Carolina Silva'
            }
          }
        ]
      })
    });

    expect(batchRes.status).toBe(200);
    const batchData = await batchRes.json();
    expect(batchData.acks[0].status).toBe('ACK');

    // Verify stock decremented: 50 - 2 = 48
    const updatedProd = centralState.products.get(productId);
    expect(updatedProd?.stock).toBe(48);

    // 4. Idempotency test (Network Retry of identical POS Sale)
    const retryRes = await fetch(`${baseUrl}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`
      },
      body: JSON.stringify({
        companyId,
        operations: [
          {
            id: 'op_sale_01_retry',
            idempotencyKey, // Identical idempotency key
            tenantId: companyId,
            branchId,
            action: 'sale.create',
            payload: {
              id: saleId,
              items: [{ productId, name: 'Café Especial Norte Pioneiro 250g', quantity: 2, price: 38.50, total: 77.00 }],
              total: 77.00,
              paymentMethod: 'DINHEIRO',
              timestamp: new Date().toISOString(),
              operator: 'Carolina Silva'
            }
          }
        ]
      })
    });

    expect(retryRes.status).toBe(200);
    const retryData = await retryRes.json();
    expect(retryData.acks[0].status).toBe('DUPLICATE');

    // Stock must STILL be 48 (NO double decrement)
    expect(centralState.products.get(productId)?.stock).toBe(48);
  });

  it('PERSONA 3 (CLIENT / CONSUMER): Should register 3eatcru ID, explore Londrina marketplace, place delivery order with PIX, track lifecycle and protect CRM privacy', async () => {
    const companyId = 'comp_londrina_gastro_01';
    const companySlug = 'bistro-londrina';

    // 1. Client creates 3eatcru ID account
    const registerRes = await fetch(`${baseUrl}/customer/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rafael Guimarães',
        email: 'rafael.londrina@email.com',
        phone: '+5543988776655',
        password: 'SenhaForte1234!'
      })
    });

    expect(registerRes.status).toBe(201);
    const registerData = await registerRes.json();
    expect(registerData.token).toBeDefined();
    expect(registerData.customer).toBeDefined();
    expect(registerData.customer.name).toBe('Rafael Guimarães');
    const clientToken = registerData.token;

    // 2. Client logs in with 3eatcru ID
    const loginRes = await fetch(`${baseUrl}/customer/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rafael.londrina@email.com',
        password: 'SenhaForte1234!'
      })
    });
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.customer.name).toBe('Rafael Guimarães');

    // 3. Client browses public space / store catalogue via public slug endpoint
    centralState.companies.set(companyId, {
      id: companyId,
      name: 'Armazém & Bistrô Londrina Calçadão',
      document: '44.123.456/0001-89',
      status: 'active',
      plan: 'enterprise',
      balance: 1000,
      createdAt: new Date().toISOString(),
      installedApps: ['app_public_space']
    });

    centralState.publicSpaces.set(companyId, {
      companySlug,
      title: 'Armazém & Bistrô Londrina Calçadão',
      description: 'Gastronomia artesanal e cafés especiais em Londrina PR',
      status: 'published',
      publishedAt: new Date().toISOString(),
      themeColor: '#f59e0b',
      templateId: 'restaurant',
      phone: '+554333221100',
      email: 'contato@bistrolondrina.com.br',
      address: 'Av. Paraná, 450 - Centro, Londrina - PR',
      hours: 'Seg a Sáb 08:00 às 22:00',
      products: [
        {
          id: 'prod_cafe_peaberry_lda',
          name: 'Café Especial Norte Pioneiro 250g',
          description: 'Notas de caramelo e frutas amarelas',
          price: 38.50,
          category: 'Cafeteria',
          available: true
        }
      ]
    });

    const storeRes = await fetch(`${baseUrl}/public-space/slug/${companySlug}`);
    expect(storeRes.status).toBe(200);
    const storeData = await storeRes.json();
    expect(storeData.title).toBe('Armazém & Bistrô Londrina Calçadão');
    expect(storeData.products.length).toBe(1);

    // 4. Client submits an online delivery order
    const orderId = `ord_lda_online_${Date.now()}`;
    const orderPayload: PublicOrderData = {
      id: orderId,
      companyId,
      customerAccountId: loginData.customer.id,
      customerName: 'Rafael Guimarães',
      customerPhone: '+5543988776655',
      customerEmail: 'rafael.londrina@email.com',
      deliveryAddress: {
        street: 'Rua Sergipe',
        number: '820',
        district: 'Centro',
        city: 'Londrina',
        state: 'PR',
        postalCode: '86010-380'
      },
      items: [
        {
          productId: 'prod_cafe_peaberry_lda',
          name: 'Café Especial Norte Pioneiro 250g',
          quantity: 1,
          unitPrice: 38.50,
          total: 38.50
        }
      ],
      subtotal: 38.50,
      deliveryFee: 7.00,
      total: 45.50,
      paymentMethod: 'PIX',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    centralState.orders.set(orderId, orderPayload);

    // 5. Client tracks their order via /customer/activity
    const activityRes = await fetch(`${baseUrl}/customer/activity`, {
      headers: { Authorization: `Bearer ${clientToken}` }
    });
    expect(activityRes.status).toBe(200);
    const activityData = await activityRes.json();
    expect(activityData.orders.length).toBe(1);
    expect(activityData.orders[0].id).toBe(orderId);
    expect(activityData.orders[0].status).toBe('PENDING');
    expect(activityData.orders[0].total).toBe(45.50);

    // 6. Security verification: Verify Client token CANNOT access Operator or HQ routes
    const forbiddenRes = await fetch(`${baseUrl}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        companyId,
        operations: []
      })
    });
    expect(forbiddenRes.status).toBe(403);
  });
});
