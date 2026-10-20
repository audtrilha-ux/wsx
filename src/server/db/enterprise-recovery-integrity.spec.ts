// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { CentralDatabaseEngine } from './central-db.js';

describe('Enterprise Recovery Integrity (WRITE → CRASH → RESTART → RECOVERY)', () => {
  let engine: CentralDatabaseEngine;

  beforeEach(() => {
    engine = new CentralDatabaseEngine();
  });

  it('should survive full write, simulated crash, restart, and recovery with zero divergence', () => {
    // 1. Initial complex enterprise state
    const enterpriseState = {
      plans: [
        {
          id: 'enterprise',
          name: 'Enterprise Plan',
          monthlyPrice: 299.9,
          maxTerminals: 50,
          maxBranches: 10,
          description: 'Plano ilimitado para redes de lojas',
          includedApps: ['app_pos', 'app_inventory', 'app_crm', 'app_tables', 'app_finance'],
          features: ['Multi-filial', 'Conciliação bancária', 'Auditoria total']
        }
      ],
      hqAdmins: [
        {
          id: 'admin_ent_1',
          name: 'Master Security Officer',
          email: 'secops@3eatcru.com.br',
          role: 'hq_admin',
          password: 'hashed_super_secure_pass',
          mfaEnabled: true,
          mfaSecret: 'JBSWY3DPEHPK3PXP'
        }
      ],
      companies: new Map([
        ['comp_enterprise_01', {
          id: 'comp_enterprise_01',
          name: 'Grupo Gastronômico Brasil S.A.',
          slug: 'grupo-gastronomico',
          cnpj: '12.345.678/0001-90',
          logoUrl: 'https://example.com/logo.png',
          balance: 15420.50,
          installedApps: ['app_pos', 'app_inventory', 'app_tables', 'app_finance'],
          status: 'active',
          plan: 'enterprise',
          maxTerminals: 50,
          maxBranches: 10,
          activeTerminals: 8,
          channel: 'stable',
          osTargetVersion: '1.1.0-lts',
          licenseExpiresAt: '2027-12-31T23:59:59.000Z',
          branches: [
            {
              id: 'branch_matriz',
              companyId: 'comp_enterprise_01',
              name: 'Matriz Jardins',
              address: 'Av. Paulista, 1000',
              phone: '11988887777',
              isActive: true,
              isMain: true
            },
            {
              id: 'branch_filial_01',
              companyId: 'comp_enterprise_01',
              name: 'Filial Itaim',
              address: 'R. Funchal, 500',
              phone: '11977776666',
              isActive: true,
              isMain: false
            }
          ],
          allowNegativeStock: false,
          isDemo: false
        }]
      ]),
      companyUsers: new Map([
        ['comp_enterprise_01', [
          {
            id: 'usr_mgr_1',
            companyId: 'comp_enterprise_01',
            branchId: 'branch_matriz',
            name: 'Gerente Geral Jardins',
            email: 'gerente.jardins@grupo.com.br',
            role: 'manager',
            password: 'hashed_manager_pwd',
            pin: '4321',
            active: true,
            lastLogin: '2026-09-15T10:00:00.000Z'
          },
          {
            id: 'usr_op_1',
            companyId: 'comp_enterprise_01',
            branchId: 'branch_filial_01',
            name: 'Operador Caixa Itaim',
            email: 'caixa.itaim@grupo.com.br',
            role: 'operator',
            password: 'hashed_op_pwd',
            pin: '1122',
            active: true,
            lastLogin: '2026-09-15T11:30:00.000Z'
          }
        ]]
      ]),
      products: new Map([
        ['prod_wagyu_steak', {
          id: 'prod_wagyu_steak',
          companyId: 'comp_enterprise_01',
          branchId: 'branch_matriz',
          name: 'Wagyu A5 Steak 300g',
          price: 380.00,
          stock: 45
        }],
        ['prod_truffle_pasta', {
          id: 'prod_truffle_pasta',
          companyId: 'comp_enterprise_01',
          branchId: 'branch_matriz',
          name: 'Massa Trufada Artesanal',
          price: 145.00,
          stock: 90
        }]
      ]),
      sales: new Map([
        ['sale_ent_001', {
          id: 'sale_ent_001',
          companyId: 'comp_enterprise_01',
          branchId: 'branch_matriz',
          items: [
            { productId: 'prod_wagyu_steak', quantity: 2, unitPrice: 380.00 },
            { productId: 'prod_truffle_pasta', quantity: 1, unitPrice: 145.00 }
          ],
          total: 905.00,
          timestamp: '2026-09-15T13:45:00.000Z',
          paymentMethod: 'CREDIT_CARD',
          operator: 'Gerente Geral Jardins'
        }]
      ]),
      customers: new Map([
        ['cust_vip_01', {
          id: 'cust_vip_01',
          companyId: 'comp_enterprise_01',
          branchId: 'branch_matriz',
          name: 'Doutor Rogério Miranda',
          phone: '11999990000',
          email: 'rogerio.miranda@adv.com.br',
          points: 1500,
          totalSpent: 12850.00,
          tier: 'Diamond',
          createdAt: '2026-01-10T00:00:00.000Z'
        }]
      ]),
      tables: new Map([
        ['table_jardins_01', {
          id: 'table_jardins_01',
          companyId: 'comp_enterprise_01',
          branchId: 'branch_matriz',
          number: 12,
          name: 'Mesa Varanda VIP 12',
          capacity: 6,
          status: 'OCCUPIED',
          currentOrder: {
            id: 'order_tbl_99',
            tableId: 'table_jardins_01',
            companyId: 'comp_enterprise_01',
            items: [
              {
                id: 'item_tbl_1',
                productId: 'prod_wagyu_steak',
                name: 'Wagyu A5 Steak 300g',
                quantity: 2,
                unitPrice: 380,
                status: 'IN_PREPARATION',
                orderedAt: '2026-09-15T13:00:00.000Z'
              }
            ],
            customerCount: 4,
            status: 'OPEN',
            openedAt: '2026-09-15T12:50:00.000Z',
            waiterName: 'Carlos Silva'
          }
        }]
      ]),
      financeTransactions: new Map([
        ['fin_tx_001', {
          id: 'fin_tx_001',
          companyId: 'comp_enterprise_01',
          branchId: 'branch_matriz',
          type: 'INFLOW',
          category: 'SALE',
          description: 'Recebimento Venda #sale_ent_001',
          amount: 905.00,
          paymentMethod: 'CREDIT_CARD',
          timestamp: '2026-09-15T13:45:00.000Z',
          operator: 'Gerente Geral Jardins',
          referenceId: 'sale_ent_001'
        }]
      ]),
      publicSpaces: new Map([
        ['comp_enterprise_01', {
          companyId: 'comp_enterprise_01',
          companySlug: 'grupo-gastronomico',
          title: 'Grupo Gastronômico Jardins & Itaim',
          description: 'Alta gastronomia contemporânea.',
          logo: 'https://example.com/logo-public.png',
          templateId: 'fine-dining',
          themeColor: '#0f172a',
          status: 'PUBLISHED',
          publishedAt: '2026-08-01T12:00:00.000Z',
          phone: '1130004000',
          email: 'contato@grupogastronomico.com.br',
          address: 'Av. Paulista, 1000 - Jardins, SP',
          hours: 'Terça a Domingo das 12h às 23h',
          products: [
            { name: 'Wagyu A5 Steak', price: 380, desc: 'Corte nobre com legumes grelhados' }
          ]
        }]
      ]),
      orders: new Map([
        ['ord_pub_998', {
          id: 'ord_pub_998',
          publicTrackingToken: 'trk_token_alpha_998',
          companyId: 'comp_enterprise_01',
          branchId: 'branch_matriz',
          companyName: 'Grupo Gastronômico Jardins & Itaim',
          customerName: 'Beatriz Vasconcelos',
          customerPhone: '11988880011',
          customerAddress: 'Al. Lorena, 450 - Apto 82',
          items: [{ name: 'Wagyu A5 Steak', quantity: 1, unitPrice: 380 }],
          total: 380.00,
          notes: 'Ponto da carne: ao ponto menos.',
          paymentMethod: 'PIX',
          status: 'PREPARING',
          channel: 'MARKETPLACE',
          createdAt: '2026-09-15T19:20:00.000Z',
          updatedAt: '2026-09-15T19:22:00.000Z'
        }]
      ]),
      telemetry: new Map([
        ['comp_enterprise_01', {
          companyId: 'comp_enterprise_01',
          companyName: 'Grupo Gastronômico Brasil S.A.',
          deviceId: 'dev_terminal_matriz_pos1',
          timestamp: '2026-09-15T19:25:00.000Z',
          overallStatus: 'healthy',
          clientReportedStatus: 'healthy',
          centralCalculatedHealth: 'healthy',
          checks: [
            { subsystem: 'sqlite_local', status: 'healthy', details: 'Database responsive in 1.2ms' },
            { subsystem: 'outbox_sync', status: 'healthy', details: '0 pending records in queue' },
            { subsystem: 'thermal_printer', status: 'healthy', details: 'Paper roll 85% full' }
          ],
          platform: 'windows',
          version: '1.1.0-lts'
        }]
      ]),
      processedWebhookEvents: new Set(['evt_pix_gateway_987654321', 'evt_pix_gateway_987654322']),
      osReleases: [
        {
          version: '1.1.0-lts',
          channel: 'stable',
          releaseDate: '2026-09-01',
          status: 'active',
          changelog: 'LTS Estável: SQLite-First nativo.',
          minRequiredByApps: '1.0.0'
        }
      ],
      apps: [
        {
          id: 'app_pos',
          name: 'Ponto de Venda Enterprise',
          description: 'PDV robusto e transacional.',
          developer: '3eatcru',
          publisher: '3eatcru HQ',
          category: 'sales',
          icon: 'point_of_sale',
          pricing: { model: 'MONTHLY', amount: 59.90, currency: 'BRL' },
          lifecycle: { status: 'PUBLISHED' },
          permissions: ['storage', 'printers'],
          capabilities: ['pos_checkout', 'offline_mode'],
          dependencies: [],
          isSystemApp: false
        }
      ],
      billingIdempotencyLog: new Map([
        ['2026-09:comp_enterprise_01', 'inv_ent_2026_09']
      ]),
      devices: new Map([
        ['dev_terminal_matriz_pos1', {
          deviceId: 'dev_terminal_matriz_pos1',
          companyId: 'comp_enterprise_01',
          branchId: 'branch_matriz',
          hardwareId: 'HW-UUID-9988-7766-5544',
          platform: 'windows',
          name: 'Terminal Caixa Principal 01',
          registeredAt: '2026-08-10T14:00:00.000Z',
          status: 'active',
          ipAddress: '192.168.1.150'
        }]
      ]),
      invoices: new Map([
        ['comp_enterprise_01', [
          {
            id: 'inv_ent_2026_09',
            invoiceNumber: 'INV-2026-00098',
            companyId: 'comp_enterprise_01',
            companyName: 'Grupo Gastronômico Brasil S.A.',
            billingPeriod: '2026-09',
            issueDate: '2026-09-01T00:00:00.000Z',
            dueDate: '2026-09-10T23:59:59.000Z',
            paidAt: '2026-09-02T10:15:00.000Z',
            status: 'PAID',
            subtotal: 299.90,
            discount: 0,
            totalAmount: 299.90,
            items: [
              { description: 'Plano Enterprise Mensal', amount: 299.90, type: 'PLAN' }
            ]
          }
        ]]
      ]),
      appEntitlements: new Map([
        ['comp_enterprise_01:app_pos', {
          id: 'comp_enterprise_01:app_pos',
          companyId: 'comp_enterprise_01',
          appId: 'app_pos',
          status: 'ACTIVE',
          pricingModel: 'MONTHLY',
          amount: 59.90,
          currency: 'BRL',
          createdAt: '2026-08-01T00:00:00.000Z',
          expiresAt: '2027-08-01T00:00:00.000Z',
          licenseKey: 'LIC-ENTERPRISE-POS-2026'
        }]
      ]),
      appInstallations: new Map([
        ['comp_enterprise_01:app_pos', {
          id: 'comp_enterprise_01:app_pos',
          companyId: 'comp_enterprise_01',
          deviceId: 'dev_terminal_matriz_pos1',
          appId: 'app_pos',
          installedVersion: '1.1.0',
          status: 'INSTALLED',
          installedAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-09-01T10:00:00.000Z'
        }]
      ]),
      paymentOrders: new Map([
        ['pay_ord_998811', {
          id: 'pay_ord_998811',
          invoiceId: 'inv_ent_2026_09',
          companyId: 'comp_enterprise_01',
          paymentMethod: 'PIX',
          gatewayReference: 'GW-PIX-REF-998811',
          qrCode: 'data:image/png;base64,mockQrCode',
          qrCodeCopyPaste: '00020126580014br.gov.bcb.pix...',
          status: 'CONFIRMED',
          amount: 299.90,
          createdAt: '2026-09-02T10:00:00.000Z',
          confirmedAt: '2026-09-02T10:15:00.000Z'
        }]
      ]),
      companyLedger: new Map([
        ['comp_enterprise_01', [
          {
            id: 'ledg_ent_001',
            companyId: 'comp_enterprise_01',
            type: 'CREDIT_ADDED',
            amount: 20000.00,
            previousBalance: 0,
            newBalance: 20000.00,
            description: 'Recarga Inicial de Crédito Enterprise via TED',
            referenceId: 'ted_bank_990123',
            timestamp: '2026-08-01T08:00:00.000Z'
          },
          {
            id: 'ledg_ent_002',
            companyId: 'comp_enterprise_01',
            type: 'PLAN_CHARGE',
            amount: 299.90,
            previousBalance: 20000.00,
            newBalance: 19700.10,
            description: 'Cobrança do Plano Enterprise Setembro/2026',
            referenceId: 'inv_ent_2026_09',
            timestamp: '2026-09-02T10:15:00.000Z'
          }
        ]]
      ]),
      hqAuditLogs: [
        {
          id: 'log_audit_master_001',
          timestamp: '2026-09-01T09:00:00.000Z',
          adminId: 'admin_ent_1',
          adminName: 'Master Security Officer',
          action: 'TENANT_UPGRADED_ENTERPRISE',
          targetTenantId: 'comp_enterprise_01',
          targetTenantName: 'Grupo Gastronômico Brasil S.A.',
          details: { previousPlan: 'pro', newPlan: 'enterprise', discount: 0 },
          ipAddress: '10.0.0.1'
        }
      ]
    };

    // --- PHASE 1: WRITE ---
    engine.persistState(enterpriseState);
    expect(engine.hasData()).toBe(true);

    // --- PHASE 2: CRASH SIMULATION (destroy engine instance) ---
    const freshEngine = new CentralDatabaseEngine();

    // --- PHASE 3: RESTART & RECOVERY ---
    const recovered = freshEngine.loadFromDatabase();
    expect(recovered).toBeDefined();
    expect(recovered).not.toBeNull();

    // --- PHASE 4: ZERO DIVERGENCE ASSERTIONS ---
    
    // Plans
    const recoveredPlan = recovered?.plans?.find(p => p['id'] === 'enterprise');
    expect(recoveredPlan).toBeDefined();
    expect(recoveredPlan?.['monthlyPrice']).toBe(299.9);
    expect(recoveredPlan?.['maxTerminals']).toBe(50);

    // Admins
    const recoveredAdmin = recovered?.hqAdmins?.find(a => a['id'] === 'admin_ent_1');
    expect(recoveredAdmin).toBeDefined();
    expect(recoveredAdmin?.['email']).toBe('secops@3eatcru.com.br');
    expect(recoveredAdmin?.['mfaEnabled']).toBe(true);

    // Companies & Multi-branch
    const recoveredCompanyEntry = recovered?.companies?.find(([id]) => id === 'comp_enterprise_01');
    expect(recoveredCompanyEntry).toBeDefined();
    const compData = recoveredCompanyEntry![1] as Record<string, unknown>;
    expect(compData['name']).toBe('Grupo Gastronômico Brasil S.A.');
    expect(compData['balance']).toBe(15420.50);
    expect(compData['plan']).toBe('enterprise');
    const branches = compData['branches'] as Record<string, unknown>[];
    expect(branches.length).toBe(2);
    expect(branches[0]['name']).toBe('Matriz Jardins');
    expect(branches[1]['name']).toBe('Filial Itaim');

    // Users with roles and branch associations
    const userEntries = recovered?.companyUsers?.find(([compId]) => compId === 'comp_enterprise_01');
    expect(userEntries).toBeDefined();
    const users = userEntries![1] as Record<string, unknown>[];
    expect(users.length).toBe(2);
    expect(users[0]['role']).toBe('manager');
    expect(users[0]['branchId']).toBe('branch_matriz');
    expect(users[1]['role']).toBe('operator');
    expect(users[1]['branchId']).toBe('branch_filial_01');

    // Products
    const prodWagyu = recovered?.products?.find(([id]) => id === 'prod_wagyu_steak');
    expect(prodWagyu).toBeDefined();
    expect((prodWagyu![1] as { price: number }).price).toBe(380.00);
    expect((prodWagyu![1] as { stock: number }).stock).toBe(45);

    // Sales
    const saleEntry = recovered?.sales?.find(([id]) => id === 'sale_ent_001');
    expect(saleEntry).toBeDefined();
    expect((saleEntry![1] as { total: number }).total).toBe(905.00);

    // Customers
    const custEntry = recovered?.customers?.find(([id]) => id === 'cust_vip_01');
    expect(custEntry).toBeDefined();
    expect((custEntry![1] as { tier: string }).tier).toBe('Diamond');
    expect((custEntry![1] as { totalSpent: number }).totalSpent).toBe(12850.00);

    // Tables & Nested Orders
    const tableEntry = recovered?.tables?.find(([id]) => id === 'table_jardins_01');
    expect(tableEntry).toBeDefined();
    const tableData = tableEntry![1] as Record<string, unknown>;
    expect(tableData['status']).toBe('OCCUPIED');
    expect(tableData['currentOrder']).toBeDefined();
    expect((tableData['currentOrder'] as Record<string, unknown>)['waiterName']).toBe('Carlos Silva');

    // Finance Transactions
    const ftEntry = recovered?.financeTransactions?.find(([id]) => id === 'fin_tx_001');
    expect(ftEntry).toBeDefined();
    expect((ftEntry![1] as { amount: number }).amount).toBe(905.00);
    expect((ftEntry![1] as { referenceId: string }).referenceId).toBe('sale_ent_001');

    // Public Spaces
    const psEntry = recovered?.publicSpaces?.find(([id]) => id === 'comp_enterprise_01');
    expect(psEntry).toBeDefined();
    expect((psEntry![1] as { themeColor: string }).themeColor).toBe('#0f172a');

    // Orders & Tracking Tokens
    const ordEntry = recovered?.orders?.find(([id]) => id === 'ord_pub_998');
    expect(ordEntry).toBeDefined();
    expect((ordEntry![1] as { publicTrackingToken: string }).publicTrackingToken).toBe('trk_token_alpha_998');
    expect((ordEntry![1] as { total: number }).total).toBe(380.00);

    // Telemetry
    const telEntry = recovered?.telemetry?.find(([id]) => id === 'comp_enterprise_01');
    expect(telEntry).toBeDefined();
    expect((telEntry![1] as { overallStatus: string }).overallStatus).toBe('healthy');

    // Webhooks
    expect(recovered?.processedWebhookEvents).toContain('evt_pix_gateway_987654321');
    expect(recovered?.processedWebhookEvents).toContain('evt_pix_gateway_987654322');

    // Devices
    const devEntry = recovered?.devices?.find(([id]) => id === 'dev_terminal_matriz_pos1');
    expect(devEntry).toBeDefined();
    expect((devEntry![1] as { hardwareId: string }).hardwareId).toBe('HW-UUID-9988-7766-5544');

    // Invoices & Billing Idempotency
    const invEntries = recovered?.invoices?.find(([compId]) => compId === 'comp_enterprise_01');
    expect(invEntries).toBeDefined();
    const invList = invEntries![1] as Record<string, unknown>[];
    expect(invList.length).toBe(1);
    expect(invList[0]['invoiceNumber']).toBe('INV-2026-00098');
    expect(invList[0]['status']).toBe('PAID');

    const billLog = recovered?.billingIdempotencyLog?.find(([k]) => k === '2026-09:comp_enterprise_01');
    expect(billLog).toBeDefined();
    expect(billLog![1]).toBe('inv_ent_2026_09');

    // Ledger (Double-entry accounting verification)
    const ledgerEntries = recovered?.companyLedger?.find(([compId]) => compId === 'comp_enterprise_01');
    expect(ledgerEntries).toBeDefined();
    const ledgerList = ledgerEntries![1] as Record<string, unknown>[];
    expect(ledgerList.length).toBe(2);
    expect(ledgerList[0]['type']).toBe('CREDIT_ADDED');
    expect(ledgerList[0]['newBalance']).toBe(20000.00);
    expect(ledgerList[1]['type']).toBe('PLAN_CHARGE');
    expect(ledgerList[1]['newBalance']).toBe(19700.10);

    // HQ Audit Logs
    expect(recovered?.hqAuditLogs?.length).toBeGreaterThan(0);
    const auditLog = recovered?.hqAuditLogs?.find(l => l['id'] === 'log_audit_master_001');
    expect(auditLog).toBeDefined();
    expect(auditLog?.['action']).toBe('TENANT_UPGRADED_ENTERPRISE');
  });

  it('should reconcile deletions across restarts without ghost records', () => {
    // Setup initial state with 2 products and 2 companies
    const stateA = {
      companies: new Map([
        ['comp_del_1', { id: 'comp_del_1', name: 'Empresa A', balance: 100, status: 'active', plan: 'starter' }],
        ['comp_del_2', { id: 'comp_del_2', name: 'Empresa B', balance: 200, status: 'active', plan: 'pro' }]
      ]),
      companyUsers: new Map(),
      products: new Map([
        ['prod_del_1', { id: 'prod_del_1', companyId: 'comp_del_1', name: 'Produto 1', price: 10, stock: 5 }],
        ['prod_del_2', { id: 'prod_del_2', companyId: 'comp_del_2', name: 'Produto 2', price: 20, stock: 10 }]
      ]),
      sales: new Map(),
      customers: new Map(),
      tables: new Map(),
      financeTransactions: new Map(),
      publicSpaces: new Map(),
      devices: new Map(),
      invoices: new Map(),
      appEntitlements: new Map(),
      companyLedger: new Map()
    };

    engine.persistState(stateA, true);

    // Delete Empresa A and Produto 1 from state
    const stateB = {
      companies: new Map([
        ['comp_del_2', { id: 'comp_del_2', name: 'Empresa B', balance: 200, status: 'active', plan: 'pro' }]
      ]),
      companyUsers: new Map(),
      products: new Map([
        ['prod_del_2', { id: 'prod_del_2', companyId: 'comp_del_2', name: 'Produto 2', price: 20, stock: 10 }]
      ]),
      sales: new Map(),
      customers: new Map(),
      tables: new Map(),
      financeTransactions: new Map(),
      publicSpaces: new Map(),
      devices: new Map(),
      invoices: new Map(),
      appEntitlements: new Map(),
      companyLedger: new Map()
    };

    engine.persistState(stateB, true);

    // Recover with fresh instance
    const freshEngine = new CentralDatabaseEngine();
    const recovered = freshEngine.loadFromDatabase();

    expect(recovered?.companies?.some(([id]) => id === 'comp_del_1')).toBe(false);
    expect(recovered?.companies?.some(([id]) => id === 'comp_del_2')).toBe(true);

    expect(recovered?.products?.some(([id]) => id === 'prod_del_1')).toBe(false);
    expect(recovered?.products?.some(([id]) => id === 'prod_del_2')).toBe(true);
  });
});
