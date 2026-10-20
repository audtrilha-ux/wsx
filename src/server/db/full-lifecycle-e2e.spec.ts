// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { CentralDatabaseEngine } from './central-db.js';

describe('P1.4 — Full Ecosystem Lifecycle E2E Suite (HQ -> Tenant -> Client -> App -> Billing -> Persistence -> Restart)', () => {
  const TEST_DB_FILE = join(process.cwd(), 'data', 'test_full_lifecycle_e2e.db');

  const cleanupTestDb = () => {
    try {
      if (existsSync(TEST_DB_FILE)) {
        unlinkSync(TEST_DB_FILE);
      }
    } catch {
      // Ignored
    }
  };

  afterAll(() => {
    cleanupTestDb();
  });

  it('should execute full lifecycle: tenant provisioning, user creation, branch, device registration, app entitlement & install, sales operation, billing ledger settlement, persistence, restart and complete state recovery', () => {
    cleanupTestDb();

    // ----------------------------------------------------
    // PHASE 1: Boot from clean SQLite DB and run migrations
    // ----------------------------------------------------
    const engine1 = new CentralDatabaseEngine(TEST_DB_FILE);
    expect(engine1.hasData()).toBe(false);

    const tenantId = 'comp_enterprise_alpha';
    const branchId = 'br_matriz_01';
    const deviceId = 'dev_pos_front_01';
    const appId = 'app_pos_restaurant';
    const userId = 'usr_admin_alpha';

    // ----------------------------------------------------
    // PHASE 2 & 3: Provision Tenant & Corporate Admin User
    // ----------------------------------------------------
    const company = {
      id: tenantId,
      name: 'Alpha Gastronomia S/A',
      document: '12.345.678/0001-90',
      email: 'admin@alphagastro.com.br',
      phone: '+5511999998888',
      status: 'active',
      plan: 'enterprise',
      balance: 1000,
      createdAt: new Date().toISOString(),
      installedApps: [appId],
      branches: [
        {
          id: branchId,
          name: 'Filial Matriz - Jardins',
          code: 'MAT-01',
          active: true,
          isHeadquarters: true,
          phone: '+5511999998888',
          settings: { taxId: '12.345.678/0001-90' }
        }
      ]
    };

    const companyUser = {
      id: userId,
      companyId: tenantId,
      name: 'Diretor Operacional',
      email: 'diretor@alphagastro.com.br',
      role: 'admin',
      password: 'scrypt:salt_hash_secure_token',
      active: true,
      pin: '8899'
    };

    // ----------------------------------------------------
    // PHASE 4: Register Physical Device linked to Tenant & Branch
    // ----------------------------------------------------
    const device = {
      id: deviceId,
      companyId: tenantId,
      branchId: branchId,
      hardwareId: 'HW-UUID-998877-POS',
      name: 'Terminal Caixa 01',
      model: 'Sunmi V2 PRO',
      status: 'active',
      registeredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      osVersion: '2.1.0'
    };

    // ----------------------------------------------------
    // PHASE 5: App Catalog Entitlement and Terminal Installation
    // ----------------------------------------------------
    const entitlementKey = `${tenantId}:${appId}`;
    const entitlement = {
      id: entitlementKey,
      companyId: tenantId,
      appId: appId,
      status: 'ACTIVE',
      grantedAt: new Date().toISOString(),
      pricingModel: 'SUBSCRIPTION_MONTHLY'
    };

    const installationKey = `${tenantId}:${deviceId}:${appId}`;
    const installation = {
      id: installationKey,
      companyId: tenantId,
      deviceId: deviceId,
      appId: appId,
      version: '1.4.0',
      status: 'INSTALLED',
      installedAt: new Date().toISOString()
    };

    // ----------------------------------------------------
    // PHASE 6: App Operation (Product Catalog & Sales Transaction)
    // ----------------------------------------------------
    const product = {
      id: 'prod_gourmet_burger',
      companyId: tenantId,
      branchId: branchId,
      name: 'Burger Angus Prime',
      price: 48.50,
      costPrice: 18.00,
      category: 'Alimentação',
      sku: 'BUR-ANG-01',
      stock: 50,
      active: true
    };

    const sale = {
      id: 'sale_tx_1001',
      companyId: tenantId,
      branchId: branchId,
      deviceId: deviceId,
      total: 48.50,
      paymentMethod: 'PIX',
      status: 'completed',
      createdAt: new Date().toISOString(),
      items: [
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          price: 48.50
        }
      ]
    };

    // ----------------------------------------------------
    // PHASE 7: Billing Order & Ledger Double-Entry Transaction
    // ----------------------------------------------------
    const invoiceId = 'inv_oct_2026_01';
    const invoice = {
      id: invoiceId,
      companyId: tenantId,
      amount: 199.00,
      status: 'PENDING',
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      description: 'Mensalidade Plano Enterprise + Addon POS'
    };

    const paymentOrderId = 'po_webhook_gateway_9988';
    const paymentOrder = {
      id: paymentOrderId,
      invoiceId: invoiceId,
      companyId: tenantId,
      amount: 199.00,
      status: 'PENDING',
      gateway: 'asaas_pix',
      gatewayTransactionId: 'gw_tx_pix_443322',
      createdAt: new Date().toISOString()
    };

    const ledgerEntry = {
      id: 'led_entry_001',
      companyId: tenantId,
      type: 'PLAN_CHARGE',
      amount: -199.00,
      balanceAfter: 801.00,
      referenceId: invoiceId,
      description: 'Liquidação de Fatura inv_oct_2026_01',
      createdAt: new Date().toISOString()
    };

    // ----------------------------------------------------
    // PHASE 8: Persist Full State via Central Database Engine
    // ----------------------------------------------------
    const fullState = {
      companies: new Map([[tenantId, company]]),
      companyUsers: new Map([[tenantId, [companyUser]]]),
      products: new Map([[product.id, product]]),
      sales: new Map([[sale.id, sale]]),
      customers: new Map(),
      tables: new Map(),
      financeTransactions: new Map(),
      publicSpaces: new Map(),
      devices: new Map([[deviceId, device]]),
      invoices: new Map([[tenantId, [invoice]]]),
      appEntitlements: new Map([[entitlementKey, entitlement]]),
      appInstallations: new Map([[installationKey, installation]]),
      paymentOrders: new Map([[paymentOrderId, paymentOrder]]),
      companyLedger: new Map([[tenantId, [ledgerEntry]]]),
      hqAuditLogs: [
        {
          id: 'aud_001',
          action: 'TENANT_PROVISIONED',
          actor: 'HQ_ADMIN',
          companyId: tenantId,
          timestamp: new Date().toISOString(),
          details: { plan: 'enterprise' }
        }
      ]
    };

    engine1.persistState(fullState as unknown as Parameters<typeof engine1.persistState>[0]);
    expect(engine1.hasData()).toBe(true);

    // Confirm payment atomically using ACID transaction in engine1
    const confirmResult = engine1.confirmPaymentOrderTransaction(
      tenantId,
      paymentOrderId,
      'evt_webhook_asaas_unique_1'
    );
    expect(confirmResult.success).toBe(true);

    // ----------------------------------------------------
    // PHASE 9: Close Instance 1 (Simulate Server Crash / Restart)
    // ----------------------------------------------------
    engine1.close();

    // ----------------------------------------------------
    // PHASE 10: Boot Instance 2 (Cold Boot on Existing SQLite DB)
    // ----------------------------------------------------
    const engine2 = new CentralDatabaseEngine(TEST_DB_FILE);
    expect(engine2.hasData()).toBe(true);

    const recovered = engine2.loadFromDatabase();
    expect(recovered).toBeDefined();

    // ----------------------------------------------------
    // PHASE 11: Assert Full Integrity of Every Subsystem
    // ----------------------------------------------------

    // 1. Tenant & Branches
    const loadedCompanyEntry = recovered?.companies?.find(([id]) => id === tenantId);
    expect(loadedCompanyEntry).toBeDefined();
    const loadedCompany = loadedCompanyEntry?.[1] as typeof company;
    expect(loadedCompany.name).toBe('Alpha Gastronomia S/A');
    expect(loadedCompany.cnpj).toBe('12.345.678/0001-90');
    expect(loadedCompany.branches).toHaveLength(1);
    expect(loadedCompany.branches[0].name).toBe('Filial Matriz - Jardins');
    // Balance is 1000 (deposit 199 + invoice settlement 199)
    expect(loadedCompany.balance).toBe(1000);

    // 2. Corporate Admin User
    const loadedUsersEntry = recovered?.companyUsers?.find(([id]) => id === tenantId);
    expect(loadedUsersEntry).toBeDefined();
    const loadedUser = (loadedUsersEntry?.[1] as typeof companyUser[])?.[0];
    expect(loadedUser.email).toBe('diretor@alphagastro.com.br');
    expect(loadedUser.role).toBe('admin');
    expect(loadedUser.pin).toBe('8899');

    // 3. Physical Device
    const loadedDeviceEntry = recovered?.devices?.find(([id]) => id === deviceId);
    expect(loadedDeviceEntry).toBeDefined();
    const loadedDevice = loadedDeviceEntry?.[1] as typeof device;
    expect(loadedDevice.deviceId).toBe(deviceId);
    expect(loadedDevice.branchId).toBe(branchId);
    expect(loadedDevice.osVersion).toBe('2.1.0');

    // 4. App Entitlement & Installation (Decoupled Platform First)
    const loadedEntitlement = recovered?.appEntitlements?.find(([id]) => id === entitlementKey);
    expect(loadedEntitlement).toBeDefined();
    expect((loadedEntitlement?.[1] as typeof entitlement).status).toBe('ACTIVE');

    const loadedInstallation = recovered?.appInstallations?.find(([id]) => id === installationKey);
    expect(loadedInstallation).toBeDefined();
    expect((loadedInstallation?.[1] as typeof installation).status).toBe('INSTALLED');
    expect((loadedInstallation?.[1] as typeof installation).installedVersion).toBe('1.4.0');

    // 5. Products and Sales Transaction
    const loadedProduct = recovered?.products?.find(([id]) => id === product.id);
    expect(loadedProduct).toBeDefined();
    expect((loadedProduct?.[1] as typeof product).name).toBe('Burger Angus Prime');

    const loadedSale = recovered?.sales?.find(([id]) => id === sale.id);
    expect(loadedSale).toBeDefined();
    expect((loadedSale?.[1] as typeof sale).total).toBe(48.50);
    expect((loadedSale?.[1] as typeof sale).items[0].productId).toBe(product.id);

    // 6. Invoices & Billing Ledger
    const loadedInvoicesEntry = recovered?.invoices?.find(([id]) => id === tenantId);
    expect(loadedInvoicesEntry).toBeDefined();
    const loadedInvoice = (loadedInvoicesEntry?.[1] as typeof invoice[])?.find(i => i.id === invoiceId);
    expect(loadedInvoice).toBeDefined();
    expect(loadedInvoice?.status).toBe('PAID');

    const loadedPaymentOrder = recovered?.paymentOrders?.find(([id]) => id === paymentOrderId);
    expect(loadedPaymentOrder).toBeDefined();
    expect((loadedPaymentOrder?.[1] as typeof paymentOrder).status).toBe('CONFIRMED');

    const loadedLedgerEntry = recovered?.companyLedger?.find(([id]) => id === tenantId);
    expect(loadedLedgerEntry).toBeDefined();
    const ledgerList = loadedLedgerEntry?.[1] as typeof ledgerEntry[];
    expect(ledgerList.length).toBeGreaterThanOrEqual(1);

    // 7. Audit Trail
    expect(recovered?.hqAuditLogs?.length).toBeGreaterThanOrEqual(1);

    engine2.close();
  });
});
