// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CentralDatabaseEngine } from './central-db.js';

describe('HQ & Marketplace Governance Cross-Module Integration Suite', () => {
  let dbEngine: CentralDatabaseEngine;

  beforeEach(() => {
    dbEngine = new CentralDatabaseEngine(':memory:');

    // 1. Seed Company
    dbEngine.getRawDatabase()?.prepare(`
      INSERT INTO companies (id, name, slug, balance, status, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `)?.run('comp_hq_mkt_1', 'Boulangerie Gourmet', 'boulangerie-gourmet', 1200, 'active', 'pro');

    // 2. Seed Public Space
    dbEngine.getRawDatabase()?.prepare(`
      INSERT INTO public_spaces (
        company_id, company_slug, title, description, logo, template_id, theme_color,
        status, published_at, phone, email, address, hours, products
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)?.run(
      'comp_hq_mkt_1',
      'boulangerie-gourmet',
      'Boulangerie Gourmet & Café',
      'Pães artesanais de fermentação natural',
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=150',
      'retail',
      '#d97706',
      'published',
      new Date().toISOString(),
      '(11) 97777-6666',
      'contato@boulangerie.com',
      'Rua Oscar Freire, 950 - Cerqueira César, São Paulo - SP',
      'Seg a Sáb 07h às 20h',
      JSON.stringify([
        { id: 'prod_croissant', name: 'Croissant Tradicional', price: 16.50, description: 'Manteiga francesa' },
        { id: 'prod_baguette', name: 'Baguette Tradicional', price: 12.00, description: 'Fermentação longa' }
      ])
    );

    // 3. Seed Products with initial stock
    const prodStmt = dbEngine.getRawDatabase()?.prepare(`
      INSERT INTO products (id, company_id, name, price, stock)
      VALUES (?, ?, ?, ?, ?)
    `);
    prodStmt?.run('prod_croissant', 'comp_hq_mkt_1', 'Croissant Tradicional', 16.50, 40);
    prodStmt?.run('prod_baguette', 'comp_hq_mkt_1', 'Baguette Tradicional', 12.00, 30);
  });

  afterEach(() => {
    dbEngine.close();
  });

  it('should process marketplace order transaction and store tracking token for customer and HQ', () => {
    const orderData = {
      id: 'ord_mkt_hq_101',
      publicTrackingToken: 'token_safe_track_991',
      customerAccountId: 'cust_account_444',
      companyId: 'comp_hq_mkt_1',
      companyName: 'Boulangerie Gourmet & Café',
      customerName: 'Carolina Mendez',
      customerPhone: '(11) 98888-2222',
      customerAddress: 'Alameda Lorena, 1500 - Jardins',
      items: [
        { name: 'Croissant Tradicional', quantity: 2, unitPrice: 16.50, total: 33.00, productId: 'prod_croissant' },
        { name: 'Baguette Tradicional', quantity: 1, unitPrice: 12.00, total: 12.00, productId: 'prod_baguette' }
      ],
      total: 45.00,
      notes: 'Por favor, embalar separados',
      paymentMethod: 'PIX',
      status: 'RECEIVED' as const,
      channel: 'MARKETPLACE' as const,
      createdAt: new Date().toISOString()
    };

    const stockDeductions = [
      { productId: 'prod_croissant', quantity: 2 },
      { productId: 'prod_baguette', quantity: 1 }
    ];

    const result = dbEngine.saveMarketplaceOrderTransaction(orderData, stockDeductions, false);
    expect(result.success).toBe(true);
    expect(result.orderId).toBe('ord_mkt_hq_101');

    // Verify order in database
    const orderInDb = dbEngine.getRawDatabase()?.prepare('SELECT * FROM orders WHERE id = ?').get('ord_mkt_hq_101') as Record<string, unknown>;
    expect(orderInDb).toBeDefined();
    expect(orderInDb['total']).toBe(45.00);
    expect(orderInDb['status']).toBe('RECEIVED');
    expect(orderInDb['public_tracking_token']).toBe('token_safe_track_991');

    // Verify stock deduction
    const pCroissant = dbEngine.getRawDatabase()?.prepare('SELECT stock FROM products WHERE id = ?').get('prod_croissant') as { stock: number };
    expect(pCroissant.stock).toBe(38); // 40 - 2
  });

  it('should transition order status to COMPLETED and generate sale record visible to HQ governance', () => {
    const orderData = {
      id: 'ord_flow_hq_202',
      publicTrackingToken: 'token_flow_hq_202',
      companyId: 'comp_hq_mkt_1',
      companyName: 'Boulangerie Gourmet',
      customerName: 'Eduardo Guimarães',
      customerPhone: '11999998888',
      items: [
        { name: 'Croissant Tradicional', quantity: 1, unitPrice: 16.50, total: 16.50, productId: 'prod_croissant' }
      ],
      total: 16.50,
      paymentMethod: 'CARTAO_CREDITO',
      status: 'RECEIVED' as const,
      channel: 'MARKETPLACE' as const,
      createdAt: new Date().toISOString()
    };

    dbEngine.saveMarketplaceOrderTransaction(orderData, [{ productId: 'prod_croissant', quantity: 1 }], false);

    // Step 1: PREPARING
    dbEngine.updateMarketplaceOrderStatusTransaction('ord_flow_hq_202', 'PREPARING');

    // Step 2: READY
    dbEngine.updateMarketplaceOrderStatusTransaction('ord_flow_hq_202', 'READY');

    // Step 3: COMPLETED
    const completion = dbEngine.updateMarketplaceOrderStatusTransaction('ord_flow_hq_202', 'COMPLETED');
    expect(completion.success).toBe(true);

    // Order must be COMPLETED
    const orderInDb = dbEngine.getRawDatabase()?.prepare('SELECT status FROM orders WHERE id = ?').get('ord_flow_hq_202') as { status: string };
    expect(orderInDb.status).toBe('COMPLETED');

    // Sale record must exist in sales table
    const saleInDb = dbEngine.getRawDatabase()?.prepare('SELECT * FROM sales WHERE id = ?').get('sale_ord_flow_hq_202') as Record<string, unknown>;
    expect(saleInDb).toBeDefined();
    expect(saleInDb['total']).toBe(16.50);
  });

  it('should allow HQ admin audit log recording during store moderation action', () => {
    dbEngine.getRawDatabase()?.prepare(`
      INSERT INTO hq_audit_logs (id, timestamp, admin_id, admin_name, action, target_tenant_id, target_tenant_name, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)?.run(
      'log_mkt_mod_001',
      new Date().toISOString(),
      'hq_superadmin_01',
      'Superadmin HQ',
      'MARKETPLACE_STORE_SUSPEND',
      'comp_hq_mkt_1',
      'Boulangerie Gourmet',
      'Vitrine suspensa temporariamente para verificação sanitária do cardápio.',
      '192.168.1.100'
    );

    // Verify audit log persisted in SQLite
    const logInDb = dbEngine.getRawDatabase()?.prepare('SELECT * FROM hq_audit_logs WHERE id = ?').get('log_mkt_mod_001') as Record<string, unknown>;
    expect(logInDb).toBeDefined();
    expect(logInDb['action']).toBe('MARKETPLACE_STORE_SUSPEND');
    expect(logInDb['target_tenant_id']).toBe('comp_hq_mkt_1');
    expect(logInDb['admin_name']).toBe('Superadmin HQ');
  });
});
