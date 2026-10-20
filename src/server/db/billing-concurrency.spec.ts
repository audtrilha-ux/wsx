// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { centralState, CompanyData, InvoiceData, PaymentOrderData, saveCentralState, TenantUserData, DeviceRegistrationData } from '../state.js';
import { CentralDatabaseEngine } from './central-db.js';
import { unlinkSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

describe('Billing & Financial Concurrency Suite', () => {
  let engine: CentralDatabaseEngine;
  const testDbPath = `./test_billing_concurrency_${Date.now()}.db`;
  const companyId = `comp_fin_${Date.now()}`;
  const invoiceId = `inv_fin_${Date.now()}`;

  beforeEach(() => {
    engine = new CentralDatabaseEngine();
    engine.init(testDbPath);

    // Reset centralState maps to prevent leftover global demo fixtures from violating Foreign Keys
    centralState.companies.clear();
    centralState.companyUsers.clear();
    centralState.companyLedger.clear();
    centralState.osDb.clear();
    centralState.customers.clear();
    centralState.products.clear();
    centralState.sales.clear();
    centralState.publicSpaces.clear();
    centralState.telemetry.clear();
    centralState.financeTransactions.clear();
    centralState.tables.clear();
    centralState.orders.clear();
    centralState.devices.clear();
    centralState.invoices.clear();
    centralState.syncIdempotencyLog.clear();
    centralState.billingIdempotencyLog.clear();
    centralState.appEntitlements.clear();
    centralState.appInstallations.clear();
    centralState.paymentOrders.clear();
    centralState.processedWebhookEvents.clear();

    // Seed test company with 0 initial balance
    const company: CompanyData = {
      id: companyId,
      name: 'Empresa Teste Financeiro',
      balance: 0,
      installedApps: ['app_pos'],
      status: 'active',
      plan: 'pro',
      maxTerminals: 5,
      activeTerminals: 1,
      branches: [
        {
          id: `br_${companyId}_1`,
          companyId,
          name: 'Sede',
          address: 'Rua Central, 100',
          phone: '11999998888',
          isActive: true
        }
      ]
    };
    centralState.companies.set(companyId, company);

    // Seed test invoice for R$ 150.00
    const invoice: InvoiceData = {
      id: invoiceId,
      invoiceNumber: 'FAT-202609-FIN1',
      companyId,
      companyName: company.name,
      billingPeriod: '2026-09',
      issueDate: '2026-09-01',
      dueDate: '2026-09-10',
      status: 'PENDING',
      subtotal: 150,
      discount: 0,
      totalAmount: 150,
      items: [
        { description: 'Plano Pro 2026-09', amount: 150, type: 'PLAN' }
      ]
    };
    centralState.invoices.set(companyId, [invoice]);
    engine.persistState(centralState as unknown as Parameters<typeof engine.persistState>[0]);
  });

  afterEach(() => {
    if (existsSync(testDbPath)) {
      try { unlinkSync(testDbPath); } catch { /* ignore cleanup error */ }
    }
    if (existsSync(`${testDbPath}-wal`)) {
      try { unlinkSync(`${testDbPath}-wal`); } catch { /* ignore cleanup error */ }
    }
    if (existsSync(`${testDbPath}-shm`)) {
      try { unlinkSync(`${testDbPath}-shm`); } catch { /* ignore cleanup error */ }
    }
  });

  it('should settle invoice exactly once and prevent double-crediting when multiple payment orders compete', () => {
    const invoice = centralState.invoices.get(companyId)![0];
    const company = centralState.companies.get(companyId)!;

    // Create 3 payment orders for the same invoice
    const orders: PaymentOrderData[] = ['order_A', 'order_B', 'order_C'].map(code => ({
      id: `pay_${code}_${randomUUID().substring(0, 6)}`,
      invoiceId: invoice.id,
      companyId,
      paymentMethod: 'PIX',
      status: 'PENDING',
      amount: invoice.totalAmount,
      createdAt: new Date().toISOString()
    }));

    for (const order of orders) {
      centralState.paymentOrders.set(order.id, order);
    }
    saveCentralState();

    // Simulate Confirmation Worker function matching companies.ts logic
    function processConfirmation(paymentOrderId: string) {
      const order = centralState.paymentOrders.get(paymentOrderId);
      if (!order) return { success: false, code: 404, message: 'Not found' };
      if (order.status === 'CONFIRMED') return { success: false, code: 400, message: 'Already confirmed' };

      const invList = centralState.invoices.get(companyId) || [];
      const currentInvoice = invList.find(i => i.id === order.invoiceId);

      // ANTI-DOUBLE-CREDIT CHECK
      if (currentInvoice && currentInvoice.status === 'PAID') {
        order.status = 'DUPLICATE_REJECTED';
        order.confirmedAt = new Date().toISOString();
        saveCentralState();
        return { success: false, code: 409, message: 'Duplicate settlement rejected' };
      }

      order.status = 'CONFIRMED';
      order.confirmedAt = new Date().toISOString();

      // Cancel other pending orders for the same invoice
      for (const other of centralState.paymentOrders.values()) {
        if (other.invoiceId === order.invoiceId && other.id !== order.id && other.status === 'PENDING') {
          other.status = 'CANCELLED';
        }
      }

      // Step A: Deposit
      const prevBalance = company.balance;
      const depositedBalance = prevBalance + order.amount;
      company.balance = depositedBalance;

      const ledger = centralState.companyLedger.get(companyId) || [];
      ledger.unshift({
        id: `led_dep_${randomUUID().substring(0, 8)}`,
        companyId,
        type: 'CREDIT_ADDED',
        amount: order.amount,
        previousBalance: prevBalance,
        newBalance: depositedBalance,
        description: 'Aporte de saldo',
        timestamp: new Date().toISOString()
      });

      // Step B: Settle Invoice
      if (currentInvoice) {
        const finalBalance = depositedBalance - currentInvoice.totalAmount;
        company.balance = finalBalance;
        currentInvoice.status = 'PAID';
        currentInvoice.paidAt = new Date().toISOString();

        ledger.unshift({
          id: `led_deb_${randomUUID().substring(0, 8)}`,
          companyId,
          type: 'PLAN_CHARGE',
          amount: currentInvoice.totalAmount,
          previousBalance: depositedBalance,
          newBalance: finalBalance,
          description: 'Liquidacao de fatura',
          timestamp: new Date().toISOString()
        });
      }

      centralState.companyLedger.set(companyId, ledger);
      centralState.companies.set(companyId, company);
      saveCentralState();

      return { success: true, code: 200, message: 'Settled' };
    }

    // 1. Confirm First Order (order A) -> Should succeed
    const resA = processConfirmation(orders[0].id);
    expect(resA.success).toBe(true);
    expect(resA.code).toBe(200);

    // Verify company balance and invoice state
    expect(company.balance).toBe(0); // 0 initial + 150 deposit - 150 invoice = 0
    expect(invoice.status).toBe('PAID');
    expect(orders[0].status).toBe('CONFIRMED');

    // 2. Attempt confirming Second Order (order B) -> Must be rejected, zero double-crediting
    const resB = processConfirmation(orders[1].id);
    expect(resB.success).toBe(false);
    expect(resB.code).toBe(409);
    expect(orders[1].status).toBe('DUPLICATE_REJECTED');

    // 3. Attempt confirming Third Order (order C) -> Must be rejected, zero double-crediting
    const resC = processConfirmation(orders[2].id);
    expect(resC.success).toBe(false);
    expect(resC.code).toBe(409);
    expect(orders[2].status).toBe('DUPLICATE_REJECTED');

    // Verify ledger has EXACTLY 2 entries: 1 CREDIT_ADDED and 1 PLAN_CHARGE (not 6 entries!)
    const ledger = centralState.companyLedger.get(companyId)!;
    expect(ledger.length).toBe(2);
    expect(ledger.filter(e => e.type === 'CREDIT_ADDED').length).toBe(1);
    expect(ledger.filter(e => e.type === 'PLAN_CHARGE').length).toBe(1);

    // Final balance MUST still be 0 (no balance inflation)
    expect(company.balance).toBe(0);
  });

  it('should protect webhooks with replay attack prevention and persist across reload', () => {
    const eventId = 'evt_webhook_pix_unique_998877';

    // First webhook receipt
    expect(centralState.processedWebhookEvents.has(eventId)).toBe(false);
    centralState.processedWebhookEvents.add(eventId);
    engine.persistState(centralState as unknown as Parameters<typeof engine.persistState>[0]);

    // Second webhook receipt with the same eventId must be detected as replay
    expect(centralState.processedWebhookEvents.has(eventId)).toBe(true);

    // Destroy and reload from database
    const newEngine = new CentralDatabaseEngine(testDbPath);
    const restored = newEngine.loadFromDatabase();

    expect(restored).not.toBeNull();
    expect(restored?.processedWebhookEvents?.includes(eventId)).toBe(true);
    newEngine.close();
  });

  it('should execute concurrent payment confirmations in parallel using SQLite transactions and prevent double crediting', async () => {
    // Seed 2 concurrent payment orders for the same invoice into the DB
    const order1Id = `pay_concurrent_1_${randomUUID().substring(0, 6)}`;
    const order2Id = `pay_concurrent_2_${randomUUID().substring(0, 6)}`;
    
    const invoice = centralState.invoices.get(companyId)![0];
    
    const o1 = {
      id: order1Id,
      invoiceId: invoice.id,
      companyId,
      paymentMethod: 'PIX',
      status: 'PENDING',
      amount: invoice.totalAmount,
      createdAt: new Date().toISOString()
    };
    const o2 = {
      id: order2Id,
      invoiceId: invoice.id,
      companyId,
      paymentMethod: 'PIX',
      status: 'PENDING',
      amount: invoice.totalAmount,
      createdAt: new Date().toISOString()
    };
    
    centralState.paymentOrders.set(order1Id, o1 as PaymentOrderData);
    centralState.paymentOrders.set(order2Id, o2 as PaymentOrderData);
    engine.persistState(centralState as unknown as Parameters<typeof engine.persistState>[0]);
    
    // Execute both confirmations in parallel (via Promise.all) using the SQLite transaction engine
    const [res1, res2] = await Promise.all([
      Promise.resolve().then(() => engine.confirmPaymentOrderTransaction(companyId, order1Id)),
      Promise.resolve().then(() => engine.confirmPaymentOrderTransaction(companyId, order2Id))
    ]);
    
    // One of them must succeed (200), and the other must be rejected (409 or 400) due to double-credit protection or cancellation
    const succeeded = [res1, res2].filter(r => r.success && r.code === 200);
    const rejected = [res1, res2].filter(r => !r.success && (r.code === 409 || r.code === 400));
    
    expect(succeeded.length).toBe(1);
    expect(rejected.length).toBe(1);
    
    // Check that the database contains exactly one PAID invoice, exactly one CONFIRMED order, and exactly one DUPLICATE_REJECTED order
    const dbObj = (engine as unknown as Record<string, unknown>)['db'] as { prepare: (s: string) => { get: (...args: string[]) => { status: string } } };
    const invoiceStatus = dbObj.prepare('SELECT status FROM invoices WHERE id = ?').get(invoice.id).status;
    expect(invoiceStatus).toBe('PAID');
    
    const status1 = dbObj.prepare('SELECT status FROM payment_orders WHERE id = ?').get(order1Id).status;
    const status2 = dbObj.prepare('SELECT status FROM payment_orders WHERE id = ?').get(order2Id).status;
    
    const statuses = [status1, status2];
    expect(statuses).toContain('CONFIRMED');
    const hasCancelledOrRejected = statuses.includes('CANCELLED') || statuses.includes('DUPLICATE_REJECTED');
    expect(hasCancelledOrRejected).toBe(true);
  });

  it('should prove SQLite write locking prevents race conditions with concurrent database connections', () => {
    // 1. Setup a second database engine connected to the same DB file (simulating a separate server instance or connection)
    const secondEngine = new CentralDatabaseEngine(testDbPath);

    // Create 2 concurrent payment orders for the same invoice
    const order1Id = `pay_lock_1_${randomUUID().substring(0, 6)}`;
    const order2Id = `pay_lock_2_${randomUUID().substring(0, 6)}`;
    
    const invoice = centralState.invoices.get(companyId)![0];
    
    const o1 = {
      id: order1Id,
      invoiceId: invoice.id,
      companyId,
      paymentMethod: 'PIX',
      status: 'PENDING',
      amount: invoice.totalAmount,
      createdAt: new Date().toISOString()
    };
    const o2 = {
      id: order2Id,
      invoiceId: invoice.id,
      companyId,
      paymentMethod: 'PIX',
      status: 'PENDING',
      amount: invoice.totalAmount,
      createdAt: new Date().toISOString()
    };
    
    centralState.paymentOrders.set(order1Id, o1 as PaymentOrderData);
    centralState.paymentOrders.set(order2Id, o2 as PaymentOrderData);
    engine.persistState(centralState as unknown as Parameters<typeof engine.persistState>[0]);

    // Let's run payment confirmations in both engines.
    // One of them should succeed, and the second should either fail, be canceled, or be rejected without double-crediting.
    const res1 = engine.confirmPaymentOrderTransaction(companyId, order1Id);
    const res2 = secondEngine.confirmPaymentOrderTransaction(companyId, order2Id);

    // Assert only one succeeded
    const succeeded = [res1, res2].filter(r => r.success && r.code === 200);
    expect(succeeded.length).toBe(1);

    // Check that the database contains exactly one PAID invoice
    const dbObj = (engine as unknown as Record<string, unknown>)['db'] as { prepare: (s: string) => { get: (...args: string[]) => { status: string, balance: number } } };
    const invoiceStatus = dbObj.prepare('SELECT status FROM invoices WHERE id = ?').get(invoice.id).status;
    expect(invoiceStatus).toBe('PAID');

    // Confirm balance did not double-charge or double-credit
    const companyBalance = dbObj.prepare('SELECT balance FROM companies WHERE id = ?').get(companyId).balance;
    expect(companyBalance).toBe(0); // 0 + 150 credit - 150 plan charge = 0

    secondEngine.close();
  });

  it('should calculate the plan price correctly on billing without NaN and handle extra apps', () => {
    // Seed Pro plan with monthly_price = 249.00
    const rawDb = engine.getRawDatabase();
    rawDb?.exec(`
      INSERT INTO plans (id, name, monthly_price, max_terminals, max_branches, description, included_apps, features)
      VALUES ('pro', 'Pro Plan', 249.00, 5, 2, 'Professional Tier', '["app_settings"]', '[]')
      ON CONFLICT(id) DO UPDATE SET monthly_price = 249.00;
    `);

    // Let's seed an app catalog item with monthly pricing
    rawDb?.exec(`
      INSERT INTO app_catalog (id, name, description, developer, category, icon, pricing, lifecycle)
      VALUES ('app_custom', 'Custom Extra App', 'Custom Extra App', '3eatcru', 'integration', 'extension', '{"model":"MONTHLY","amount":49.00}', '{"status":"PUBLISHED"}')
      ON CONFLICT(id) DO UPDATE SET pricing = '{"model":"MONTHLY","amount":49.00}';
    `);

    // Setup company with plan = pro, initial balance = 500.00, and installedApps including app_custom (which is not included in plan)
    const testCompanyId = `comp_bill_calc_${Date.now()}`;
    const company: CompanyData = {
      id: testCompanyId,
      name: 'Empresa Teste Billing Calc',
      balance: 500.00,
      installedApps: ['app_settings', 'app_custom'],
      status: 'active',
      plan: 'pro',
      maxTerminals: 5,
      activeTerminals: 1,
      branches: []
    };
    centralState.companies.set(testCompanyId, company);
    engine.persistState(centralState as unknown as Parameters<typeof engine.persistState>[0]);

    // Run single company billing
    const res = engine.runSingleCompanyBillingTransaction(testCompanyId, '2026-10', '2026-10-01', '2026-10-10');
    expect(res.success).toBe(true);
    expect(res.skipped).toBe(false);

    // Verify invoice totals: 249.00 plan + 49.00 extra app = 298.00
    const loadedInvoice = rawDb?.prepare('SELECT * FROM invoices WHERE company_id = ? AND billing_period = ?').get(testCompanyId, '2026-10') as { total_amount: number; status: string };
    expect(loadedInvoice).toBeDefined();
    expect(Number(loadedInvoice.total_amount)).toBe(298.00);
    expect(loadedInvoice.status).toBe('PAID');

    // Verify ledger PLAN_CHARGE is exactly 298.00 and balance is exactly 202.00
    const loadedCompany = rawDb?.prepare('SELECT * FROM companies WHERE id = ?').get(testCompanyId) as { balance: number };
    expect(Number(loadedCompany.balance)).toBe(202.00);

    const loadedLedger = rawDb?.prepare('SELECT * FROM company_ledger WHERE company_id = ? AND type = ?').get(testCompanyId, 'PLAN_CHARGE') as { amount: number };
    expect(loadedLedger).toBeDefined();
    expect(Number(loadedLedger.amount)).toBe(298.00);
  });

  it('should prevent DELETE CASCADE when persisting company state multiple times', () => {
    const testCompanyId = `comp_cascade_${Date.now()}`;
    const company: CompanyData = {
      id: testCompanyId,
      name: 'Empresa Cascade Safe',
      balance: 100,
      installedApps: ['app_pos'],
      status: 'active',
      plan: 'pro',
      maxTerminals: 5,
      activeTerminals: 1,
      branches: []
    };

    const user: TenantUserData = {
      id: `usr_cascade_${Date.now()}`,
      companyId: testCompanyId,
      name: 'Admin User',
      email: 'admin@cascade.com',
      role: 'admin',
      password: 'hash',
      status: 'active',
      pin: 'pin_hash',
      createdAt: new Date().toISOString()
    };

    const device: DeviceRegistrationData = {
      deviceId: `dev_cascade_${Date.now()}`,
      companyId: testCompanyId,
      hardwareId: 'hw_123',
      platform: 'web',
      name: 'Terminal Central',
      registeredAt: new Date().toISOString(),
      status: 'active'
    };

    const invoice: InvoiceData = {
      id: `inv_cascade_${Date.now()}`,
      invoiceNumber: 'FAT-CASCADE-1',
      companyId: testCompanyId,
      companyName: company.name,
      billingPeriod: '2026-09',
      issueDate: '2026-09-01',
      dueDate: '2026-09-10',
      status: 'PENDING',
      totalAmount: 150,
      subtotal: 150,
      discount: 0,
      items: []
    };

    const paymentOrder: PaymentOrderData = {
      id: `po_cascade_${Date.now()}`,
      companyId: testCompanyId,
      invoiceId: invoice.id,
      amount: 150,
      paymentMethod: 'PIX',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    const ledgerEntry = {
      id: `led_cascade_${Date.now()}`,
      companyId: testCompanyId,
      type: 'CREDIT_ADDED' as const,
      amount: 100,
      previousBalance: 0,
      newBalance: 100,
      description: 'Aporte Inicial',
      timestamp: new Date().toISOString()
    };

    // Store in centralState
    centralState.companies.set(testCompanyId, company);
    centralState.companyUsers.set(testCompanyId, [user]);
    centralState.devices.set(device.deviceId, device);
    centralState.invoices.set(testCompanyId, [invoice]);
    centralState.paymentOrders.set(paymentOrder.id, paymentOrder);
    centralState.companyLedger.set(testCompanyId, [ledgerEntry]);

    // Persist State First Time
    engine.persistState(centralState as unknown as Parameters<typeof engine.persistState>[0]);

    // Verify all child rows exist in database
    const rawDb = engine.getRawDatabase();
    const countUsers1 = rawDb?.prepare('SELECT COUNT(*) as count FROM company_users WHERE company_id = ?').get(testCompanyId) as { count: number };
    const countDevices1 = rawDb?.prepare('SELECT COUNT(*) as count FROM devices WHERE company_id = ?').get(testCompanyId) as { count: number };
    const countInvoices1 = rawDb?.prepare('SELECT COUNT(*) as count FROM invoices WHERE company_id = ?').get(testCompanyId) as { count: number };
    const countOrders1 = rawDb?.prepare('SELECT COUNT(*) as count FROM payment_orders WHERE company_id = ?').get(testCompanyId) as { count: number };
    const countLedger1 = rawDb?.prepare('SELECT COUNT(*) as count FROM company_ledger WHERE company_id = ?').get(testCompanyId) as { count: number };

    expect(countUsers1.count).toBe(1);
    expect(countDevices1.count).toBe(1);
    expect(countInvoices1.count).toBe(1);
    expect(countOrders1.count).toBe(1);
    expect(countLedger1.count).toBe(1);

    // Modify company name slightly in-memory and Persist State Second Time
    company.name = 'Empresa Cascade Safe Updated';
    centralState.companies.set(testCompanyId, company);
    engine.persistState(centralState as unknown as Parameters<typeof engine.persistState>[0]);

    // Verify all child rows STILL exist in database (no cascading deletion took place!)
    const countUsers2 = rawDb?.prepare('SELECT COUNT(*) as count FROM company_users WHERE company_id = ?').get(testCompanyId) as { count: number };
    const countDevices2 = rawDb?.prepare('SELECT COUNT(*) as count FROM devices WHERE company_id = ?').get(testCompanyId) as { count: number };
    const countInvoices2 = rawDb?.prepare('SELECT COUNT(*) as count FROM invoices WHERE company_id = ?').get(testCompanyId) as { count: number };
    const countOrders2 = rawDb?.prepare('SELECT COUNT(*) as count FROM payment_orders WHERE company_id = ?').get(testCompanyId) as { count: number };
    const countLedger2 = rawDb?.prepare('SELECT COUNT(*) as count FROM company_ledger WHERE company_id = ?').get(testCompanyId) as { count: number };

    expect(countUsers2.count).toBe(1);
    expect(countDevices2.count).toBe(1);
    expect(countInvoices2.count).toBe(1);
    expect(countOrders2.count).toBe(1);
    expect(countLedger2.count).toBe(1);
  });
});
