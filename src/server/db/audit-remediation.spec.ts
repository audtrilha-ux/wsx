// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import {
  centralState,
  centralDatabase,
  CustomerData,
  ProductData,
  CompanyData,
  CustomerAccountData,
  PublicOrderData
} from '../state.js';
import { hashPassword, signJwt } from '../config.js';
import { authRouter } from '../routes/auth.js';
import { customerRouter } from '../routes/customer.js';
import { syncRouter } from '../routes/sync.js';

describe('Audit Remediation Suite (SEC-001, SEC-002, SEC-003, DATA-001)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
    app.use('/customer', customerRouter);
    app.use('/sync', syncRouter);

    // Setup base state
    centralState.companies.clear();
    centralState.companyUsers.clear();
    centralState.customerAccounts.clear();
    centralState.customers.clear();
    centralState.orders.clear();
    centralState.sales.clear();
    centralState.products.clear();
    centralState.syncIdempotencyLog.clear();
    centralState.financeTransactions.clear();
    centralState.companyLedger.clear();
    centralState.publicSpaces.clear();
    centralState.appEntitlements.clear();
    centralState.appInstallations.clear();
    centralState.invoices.clear();
    centralState.paymentOrders.clear();
    centralState.devices.clear();
    centralState.tables.clear();
    centralState.telemetry.clear();
    centralState.hqAuditLogs = [];

    const db = centralDatabase.getRawDatabase();
    if (db) {
      try {
        db.prepare('DELETE FROM rate_limits').run();
        db.prepare('DELETE FROM idempotency_log').run();
        db.prepare('DELETE FROM company_ledger').run();
        db.prepare('DELETE FROM public_spaces').run();
        db.prepare("DELETE FROM sales WHERE id LIKE 'sale_pos_%'").run();
        db.prepare("DELETE FROM products WHERE id LIKE 'prod_%'").run();
      } catch {
        // Table might be clean
      }
    }
  });

  // --------------------------------------------------------------------------
  // SEC-001: Desbloqueio de operadores
  // --------------------------------------------------------------------------
  describe('SEC-001 — Desbloqueio de operadores', () => {
    const companyId = 'comp_pizzaria_01';
    const operatorId = 'op_joao_01';
    const pin = '1234';

    beforeEach(() => {
      const company: CompanyData = {
        id: companyId,
        name: 'Pizzaria Bella',
        slug: 'pizzaria-bella',
        cnpj: '12345678000199',
        balance: 1000,
        installedApps: ['app_pos'],
        status: 'active',
        plan: 'pro',
        maxTerminals: 5,
        maxBranches: 2,
        activeTerminals: 1,
        channel: 'stable',
        branches: [
          { id: 'branch_matriz', name: 'Matriz Centro', isActive: true },
          { id: 'branch_filial', name: 'Filial Sul', isActive: true }
        ]
      };
      centralState.companies.set(companyId, company);

      centralState.companyUsers.set(companyId, [
        {
          id: operatorId,
          companyId,
          branchId: 'branch_matriz',
          branchIds: ['branch_matriz'], // Strictly assigned to Matriz
          name: 'João Operador',
          email: 'joao@pizzaria.com',
          role: 'operator',
          password: hashPassword('pass123'),
          pin: hashPassword(pin),
          active: true
        }
      ]);
    });

    it('should reject unlock attempts from non-operational tokens (e.g. CUSTOMER plane)', async () => {
      const customerToken = signJwt({
        id: 'cust_99',
        email: 'consumer@email.com',
        role: 'customer',
        authPlane: 'CUSTOMER'
      });

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/auth/operator-unlock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${customerToken}`
          },
          body: JSON.stringify({
            companyId,
            userId: operatorId,
            pin
          })
        });

        const data = await response.json();
        expect(response.status).toBe(403);
        expect(data.error).toContain('Sessão operacional inválida');
      } finally {
        server.close();
      }
    });

    it('should reject unlock when token companyId does not match requested company', async () => {
      const clientTokenOtherCompany = signJwt({
        id: 'op_other',
        role: 'operator',
        authPlane: 'CLIENT',
        companyId: 'comp_other_company'
      });

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/auth/operator-unlock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${clientTokenOtherCompany}`
          },
          body: JSON.stringify({
            companyId,
            userId: operatorId,
            pin
          })
        });

        const data = await response.json();
        expect(response.status).toBe(403);
        expect(data.error).toContain('Acesso não autorizado para esta empresa');
      } finally {
        server.close();
      }
    });

    it('should reject unlock when operator does not have access to the terminal session branch', async () => {
      // Terminal is running on Filial Sul, but operator only has access to Matriz Centro
      const terminalTokenFilial = signJwt({
        id: 'terminal_02',
        role: 'operator',
        authPlane: 'CLIENT',
        companyId,
        branchId: 'branch_filial'
      });

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/auth/operator-unlock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${terminalTokenFilial}`
          },
          body: JSON.stringify({
            companyId,
            userId: operatorId,
            pin
          })
        });

        const data = await response.json();
        expect(response.status).toBe(403);
        expect(data.error).toContain('não possui permissão para atuar na unidade/filial');
      } finally {
        server.close();
      }
    });

    it('should permit unlock for authorized operator on authorized branch with correct PIN', async () => {
      const validTerminalToken = signJwt({
        id: 'terminal_01',
        role: 'operator',
        authPlane: 'CLIENT',
        companyId,
        branchId: 'branch_matriz'
      });

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/auth/operator-unlock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${validTerminalToken}`
          },
          body: JSON.stringify({
            companyId,
            userId: operatorId,
            pin
          })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.operator.name).toBe('João Operador');
      } finally {
        server.close();
      }
    });
  });

  // --------------------------------------------------------------------------
  // SEC-002: Exposição de histórico de consumidores
  // --------------------------------------------------------------------------
  describe('SEC-002 — Exposição de histórico de consumidores', () => {
    it('should isolate activity strictly by customerAccountId and prevent phone-spoofing leakage', async () => {
      // Victim Account (Customer B)
      const victimAccountId = 'cust_victim_01';
      const victimAccount: CustomerAccountData = {
        id: victimAccountId,
        name: 'Vítima Silva',
        email: 'vitima@email.com',
        phone: '11999990001',
        password: hashPassword('vitimaPass'),
        addresses: [],
        preferences: {},
        favorites: [],
        status: 'active',
        createdAt: new Date().toISOString()
      };
      centralState.customerAccounts.set(victimAccountId, victimAccount);

      // Victim has orders
      const victimOrder: PublicOrderData = {
        id: 'ord_victim_secret_01',
        companyId: 'comp_1',
        companyName: 'Pizzaria Parceira',
        customerAccountId: victimAccountId,
        customerName: 'Vítima Silva',
        customerPhone: '11999990001',
        items: [{ productId: 'p1', name: 'Pizza Secreta', quantity: 2, unitPrice: 50 }],
        total: 100,
        status: 'COMPLETED',
        paymentMethod: 'PIX',
        channel: 'DIRECT',
        createdAt: new Date().toISOString()
      };
      centralState.orders.set(victimOrder.id, victimOrder);

      // Victim has CRM points
      const victimCrm: CustomerData = {
        id: 'crm_victim_01',
        companyId: 'comp_1',
        customerAccountId: victimAccountId,
        name: 'Vítima Silva',
        email: 'vitima@email.com',
        phone: '11999990001',
        points: 500,
        totalSpent: 1000,
        tier: 'Gold',
        createdAt: new Date().toISOString()
      };
      centralState.customers.set(victimCrm.id, victimCrm);

      // Attacker Account (Customer A)
      const attackerAccountId = 'cust_attacker_02';
      const attackerAccount: CustomerAccountData = {
        id: attackerAccountId,
        name: 'Atacante Oliveira',
        email: 'attacker@email.com',
        phone: '11988880002',
        password: hashPassword('attackerPass'),
        addresses: [],
        preferences: {},
        favorites: [],
        status: 'active',
        createdAt: new Date().toISOString()
      };
      centralState.customerAccounts.set(attackerAccountId, attackerAccount);

      // Attacker authenticates
      const attackerToken = signJwt({
        id: attackerAccountId,
        email: attackerAccount.email,
        role: 'customer',
        authPlane: 'CUSTOMER',
        customerAccountId: attackerAccountId
      });

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        // Step 1: Attacker changes their phone number to victim's phone number
        attackerAccount.phone = '11999990001'; // spoof victim's phone
        centralState.customerAccounts.set(attackerAccountId, attackerAccount);

        // Step 2: Attacker queries /customer/activity
        const response = await fetch(`http://127.0.0.1:${port}/customer/activity`, {
          headers: {
            Authorization: `Bearer ${attackerToken}`
          }
        });

        const data = await response.json();
        expect(response.status).toBe(200);

        // SEC-002: Attacker MUST NOT receive victim's orders despite phone collision!
        const returnedOrders = data.orders || [];
        expect(returnedOrders.some((o: { id: string }) => o.id === victimOrder.id)).toBe(false);

        // Attacker MUST NOT receive victim's CRM relationship/loyalty points!
        const returnedRelationships = data.companyRelationships || [];
        expect(returnedRelationships.some((r: { points: number }) => r.points === 500)).toBe(false);
      } finally {
        server.close();
      }
    });

    it('should return a sanitized projection of customer orders, avoiding internal operational exposure', async () => {
      const accountId = 'cust_project_01';
      const account: CustomerAccountData = {
        id: accountId,
        name: 'Maria Santos',
        email: 'maria@test.com',
        phone: '11911112222',
        password: hashPassword('pass'),
        addresses: [],
        preferences: {},
        favorites: [],
        status: 'active',
        createdAt: new Date().toISOString()
      };
      centralState.customerAccounts.set(accountId, account);

      const order: PublicOrderData = {
        id: 'ord_maria_01',
        companyId: 'comp_1',
        companyName: 'Restaurante Central',
        customerAccountId: accountId,
        customerName: 'Maria Santos',
        customerPhone: '11911112222',
        items: [{ productId: 'p1', name: 'Suco Natural', quantity: 1, unitPrice: 12 }],
        total: 12,
        status: 'RECEIVED',
        paymentMethod: 'CARTAO_DEBITO',
        channel: 'DIRECT',
        createdAt: new Date().toISOString()
      };
      centralState.orders.set(order.id, order);

      const token = signJwt({
        id: accountId,
        role: 'customer',
        authPlane: 'CUSTOMER',
        customerAccountId: accountId
      });

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/customer/activity`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.orders).toBeDefined();
        expect(data.orders.length).toBe(1);

        const projected = data.orders[0];
        expect(projected.id).toBe('ord_maria_01');
        expect(projected.total).toBe(12);
        expect(projected.status).toBe('RECEIVED');
        expect(projected.items[0].name).toBe('Suco Natural');
      } finally {
        server.close();
      }
    });
  });

  // --------------------------------------------------------------------------
  // SEC-003: Associação automática de clientes ao CRM
  // --------------------------------------------------------------------------
  describe('SEC-003 — Associação automática de clientes ao CRM', () => {
    it('should NOT automatically link pre-existing CRM records on customer self-registration', async () => {
      // Existing CRM record from Company A with private points and loyalty
      const testEmail = `carlos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@email.com`;
      const testPhone = `119777${Math.floor(1000 + Math.random() * 9000)}`;

      const preExistingCrm: CustomerData = {
        id: 'crm_existing_carlos',
        companyId: 'comp_loja_a',
        name: 'Carlos Antigo',
        email: testEmail,
        phone: testPhone,
        points: 800,
        tier: 'VIP',
        createdAt: new Date().toISOString()
      };
      centralState.customers.set(preExistingCrm.id, preExistingCrm);

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        // A new user registers using the same email
        const registerResponse = await fetch(`http://127.0.0.1:${port}/customer/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Carlos Novo',
            email: testEmail,
            phone: testPhone,
            password: 'SecurePassword123!'
          })
        });

        expect(registerResponse.status).toBe(201);
        const registerData = await registerResponse.json();
        const newAccountId = registerData.customer.id;

        // SEC-003: Pre-existing CRM record MUST NOT have been hijacked with customerAccountId
        const crmAfterRegister = centralState.customers.get(preExistingCrm.id);
        expect(crmAfterRegister?.customerAccountId).toBeUndefined();
        expect(crmAfterRegister?.customerAccountId).not.toBe(newAccountId);
      } finally {
        server.close();
      }
    });
  });

  // --------------------------------------------------------------------------
  // DATA-001: Reenvio de venda e desconto duplicado de estoque
  // --------------------------------------------------------------------------
  describe('DATA-001 — Reenvio de venda e desconto duplicado de estoque', () => {
    const companyId = 'comp_varejo_01';
    const productId = 'prod_camiseta_01';

    beforeEach(() => {
      const company: CompanyData = {
        id: companyId,
        name: 'Moda Varejo',
        slug: 'moda-varejo',
        cnpj: '11222333000144',
        balance: 500,
        installedApps: ['app_pos', 'app_inventory', 'app_finance'],
        status: 'active',
        plan: 'starter',
        maxTerminals: 2,
        maxBranches: 1,
        activeTerminals: 1,
        channel: 'stable',
        allowNegativeStock: false
      };
      centralState.companies.set(companyId, company);

      // Entitlements
      centralState.appEntitlements.set(`${companyId}:app_pos`, {
        id: `${companyId}:app_pos`,
        companyId,
        appId: 'app_pos',
        status: 'ACTIVE',
        pricingModel: 'FREE',
        amount: 0,
        currency: 'BRL',
        createdAt: new Date().toISOString()
      });
      centralState.appEntitlements.set(`${companyId}:app_inventory`, {
        id: `${companyId}:app_inventory`,
        companyId,
        appId: 'app_inventory',
        status: 'ACTIVE',
        pricingModel: 'FREE',
        amount: 0,
        currency: 'BRL',
        createdAt: new Date().toISOString()
      });
      centralState.appEntitlements.set(`${companyId}:app_finance`, {
        id: `${companyId}:app_finance`,
        companyId,
        appId: 'app_finance',
        status: 'ACTIVE',
        pricingModel: 'FREE',
        amount: 0,
        currency: 'BRL',
        createdAt: new Date().toISOString()
      });

      // Product with initial stock of 10
      const product: ProductData = {
        id: productId,
        companyId,
        name: 'Camiseta Básica Preta',
        price: 50.00,
        stock: 10
      };
      centralState.products.set(productId, product);

      // Ensure company and product exist in SQLite for foreign key constraints
      const rawDb = centralDatabase.getRawDatabase();
      if (rawDb) {
        rawDb.prepare(`
          INSERT OR REPLACE INTO companies (id, name, slug, balance, status, plan)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(company.id, company.name, company.slug, company.balance, company.status, company.plan);

        rawDb.prepare(`
          INSERT OR REPLACE INTO products (id, company_id, name, price, stock)
          VALUES (?, ?, ?, ?, ?)
        `).run(product.id, product.companyId, product.name, product.price, product.stock);
      }
    });

    it('should decrement stock once on initial sale, and return DUPLICATE without double decrement on replay', async () => {
      const operatorToken = signJwt({
        id: 'op_01',
        name: 'Operador Varejo',
        email: 'op@varejo.com',
        role: 'operator',
        authPlane: 'CLIENT',
        companyId
      });

      const saleId = `sale_pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const opId = `op_batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const salePayload = {
        id: saleId,
        items: [
          {
            productId,
            name: 'Camiseta Básica Preta',
            quantity: 3,
            price: 50.00,
            total: 150.00
          }
        ],
        total: 150.00,
        paymentMethod: 'DINHEIRO',
        timestamp: new Date().toISOString(),
        operator: 'Operador Varejo'
      };

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        // FIRST SUBMISSION: initial sale
        const firstRes = await fetch(`http://127.0.0.1:${port}/sync/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${operatorToken}`
          },
          body: JSON.stringify({
            companyId,
            operations: [
              {
                id: opId,
                tenantId: companyId,
                action: 'sale.create',
                payload: salePayload
              }
            ]
          })
        });

        const rawText = await firstRes.text();
        let firstData: { acks: { status: string }[] };
        try {
          firstData = JSON.parse(rawText);
        } catch {
          console.error('firstRes failed with non-json:', firstRes.status, rawText);
          throw new Error(`firstRes status ${firstRes.status}: ${rawText}`);
        }
        expect(firstRes.status).toBe(200);
        expect(firstData.acks[0].status).toBe('ACK');

        // Stock must have decremented by 3: 10 - 3 = 7
        const prodAfterFirst = centralState.products.get(productId);
        expect(prodAfterFirst?.stock).toBe(7);

        // SECOND SUBMISSION: network retry / re-send with same saleId (even without explicit idempotencyKey)
        const secondRes = await fetch(`http://127.0.0.1:${port}/sync/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${operatorToken}`
          },
          body: JSON.stringify({
            companyId,
            operations: [
              {
                id: 'op_batch_sync_retry_1002', // different op ID or same sale ID
                tenantId: companyId,
                action: 'sale.create',
                payload: salePayload // same sale ID
              }
            ]
          })
        });

        const secondData = await secondRes.json();
        expect(secondRes.status).toBe(200);
        // DATA-001: Must return DUPLICATE!
        expect(secondData.acks[0].status).toBe('DUPLICATE');

        // DATA-001: Stock MUST REMAIN 7! No double deduction!
        const prodAfterSecond = centralState.products.get(productId);
        expect(prodAfterSecond?.stock).toBe(7);
      } finally {
        server.close();
      }
    });
  });
});
