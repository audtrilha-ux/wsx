// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CentralDatabaseEngine } from './central-db.js';

describe('Marketplace & Ecosystem Cross-Module Integration Suite', () => {
  let dbEngine: CentralDatabaseEngine;

  beforeEach(() => {
    // Isolated in-memory database
    dbEngine = new CentralDatabaseEngine(':memory:');

    // 1. Seed Company
    const compStmt = dbEngine.getRawDatabase()?.prepare(`
      INSERT INTO companies (id, name, slug, balance, status, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    compStmt?.run('comp_mkt_1', 'Cantina do Beco', 'cantina-do-beco', 500, 'active', 'enterprise');

    // 2. Seed Public Space
    const spaceStmt = dbEngine.getRawDatabase()?.prepare(`
      INSERT INTO public_spaces (company_id, company_slug, title, description, logo, template_id, theme_color, status, published_at, phone, email, address, hours, products)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    spaceStmt?.run(
      'comp_mkt_1',
      'cantina-do-beco',
      'Cantina do Beco & Trattoria',
      'Massas artesanais e vinhos finos no coração da cidade',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150',
      'restaurant',
      '#e11d48',
      'published',
      new Date().toISOString(),
      '(11) 98765-4321',
      'contato@cantinadobeco.com',
      'Rua Augusta, 1500 - Consolação, São Paulo - SP',
      'Terça a Domingo: 18h00 às 23h30',
      JSON.stringify([
        { id: 'prod_1', name: 'Fettuccine Alfredo', price: 68.0, description: 'Massa fresca aos quatro queijos' },
        { id: 'prod_2', name: 'Tiramisù Tradicional', price: 28.0, description: 'Receita clássica com mascarpone e café' }
      ])
    );

    // 3. Seed Products with initial stock
    const prodStmt = dbEngine.getRawDatabase()?.prepare(`
      INSERT INTO products (id, company_id, name, price, stock)
      VALUES (?, ?, ?, ?, ?)
    `);
    prodStmt?.run('prod_1', 'comp_mkt_1', 'Fettuccine Alfredo', 68.0, 20);
    prodStmt?.run('prod_2', 'comp_mkt_1', 'Tiramisù Tradicional', 28.0, 15);
  });

  afterEach(() => {
    dbEngine.close();
  });

  it('should process marketplace order transaction and deduct stock server-authoritatively', () => {
    const orderData = {
      id: 'ord_test_001',
      publicTrackingToken: 'token_sec_128_abc',
      customerAccountId: 'cust_3id_999',
      companyId: 'comp_mkt_1',
      companyName: 'Cantina do Beco & Trattoria',
      customerName: 'Renato Silveira',
      customerPhone: '(11) 98888-7777',
      customerAddress: 'Alameda Santos, 1200 - Apto 42',
      items: [
        { name: 'Fettuccine Alfredo', quantity: 2, unitPrice: 68.0, total: 136.0, productId: 'prod_1' },
        { name: 'Tiramisù Tradicional', quantity: 1, unitPrice: 28.0, total: 28.0, productId: 'prod_2' }
      ],
      total: 164.0,
      notes: 'Sem queijo ralado adicional, por favor.',
      paymentMethod: 'PIX',
      status: 'RECEIVED' as const,
      channel: 'MARKETPLACE' as const,
      createdAt: new Date().toISOString()
    };

    const stockDeductions = [
      { productId: 'prod_1', quantity: 2 },
      { productId: 'prod_2', quantity: 1 }
    ];

    const result = dbEngine.saveMarketplaceOrderTransaction(orderData, stockDeductions, false);
    expect(result.success).toBe(true);
    expect(result.orderId).toBe('ord_test_001');

    // Verify stock decremented accurately
    const p1 = dbEngine.getRawDatabase()?.prepare('SELECT stock FROM products WHERE id = ?').get('prod_1') as { stock: number };
    const p2 = dbEngine.getRawDatabase()?.prepare('SELECT stock FROM products WHERE id = ?').get('prod_2') as { stock: number };
    expect(p1.stock).toBe(18); // 20 - 2
    expect(p2.stock).toBe(14); // 15 - 1

    // Verify order persisted with unguessable token
    const savedOrder = dbEngine.getRawDatabase()?.prepare('SELECT * FROM orders WHERE id = ?').get('ord_test_001') as Record<string, unknown>;
    expect(savedOrder).toBeDefined();
    expect(savedOrder['public_tracking_token']).toBe('token_sec_128_abc');
    expect(savedOrder['status']).toBe('RECEIVED');
    expect(savedOrder['total']).toBe(164.0);
    expect(savedOrder['customer_account_id']).toBe('cust_3id_999');
  });

  it('should prevent order placement if stock is insufficient and allowNegativeStock is false', () => {
    const orderData = {
      id: 'ord_test_insufficient',
      publicTrackingToken: 'token_insufficient',
      companyId: 'comp_mkt_1',
      companyName: 'Cantina do Beco',
      customerName: 'Cliente Teste',
      customerPhone: '11999999999',
      customerAddress: 'Rua Teste, 10',
      items: [{ name: 'Fettuccine Alfredo', quantity: 50, unitPrice: 68.0, total: 3400.0, productId: 'prod_1' }],
      total: 3400.0,
      notes: '',
      paymentMethod: 'PIX',
      status: 'RECEIVED' as const,
      channel: 'MARKETPLACE' as const,
      createdAt: new Date().toISOString()
    };

    const stockDeductions = [{ productId: 'prod_1', quantity: 50 }]; // Available is only 20

    expect(() => {
      dbEngine.saveMarketplaceOrderTransaction(orderData, stockDeductions, false);
    }).toThrow(/INSUFFICIENT_STOCK/);

    // Stock must remain unchanged at 20
    const p1 = dbEngine.getRawDatabase()?.prepare('SELECT stock FROM products WHERE id = ?').get('prod_1') as { stock: number };
    expect(p1.stock).toBe(20);
  });

  it('should transition order lifecycle and automatically create sale and finance records upon COMPLETED', () => {
    const orderData = {
      id: 'ord_flow_01',
      publicTrackingToken: 'token_flow_01',
      customerAccountId: 'cust_3id_123',
      companyId: 'comp_mkt_1',
      companyName: 'Cantina do Beco',
      customerName: 'Mariana Lima',
      customerPhone: '11977778888',
      customerAddress: 'Av Paulista, 500',
      items: [{ name: 'Fettuccine Alfredo', quantity: 1, unitPrice: 68.0, total: 68.0, productId: 'prod_1' }],
      total: 68.0,
      notes: '',
      paymentMethod: 'CARTAO_CREDITO',
      status: 'RECEIVED' as const,
      channel: 'MARKETPLACE' as const,
      createdAt: new Date().toISOString()
    };

    dbEngine.saveMarketplaceOrderTransaction(orderData, [{ productId: 'prod_1', quantity: 1 }], false);

    // 1. Advance to PREPARING
    const prepResult = dbEngine.updateMarketplaceOrderStatusTransaction('ord_flow_01', 'PREPARING');
    expect(prepResult.success).toBe(true);
    expect(prepResult.order?.status).toBe('PREPARING');

    // 2. Advance to READY
    const readyResult = dbEngine.updateMarketplaceOrderStatusTransaction('ord_flow_01', 'READY');
    expect(readyResult.success).toBe(true);
    expect(readyResult.order?.status).toBe('READY');

    // 3. Advance to DELIVERING
    const delivResult = dbEngine.updateMarketplaceOrderStatusTransaction('ord_flow_01', 'DELIVERING');
    expect(delivResult.success).toBe(true);
    expect(delivResult.order?.status).toBe('DELIVERING');

    // 4. Advance to COMPLETED (Cross-module side effect: Sale & Finance transaction created)
    const completeResult = dbEngine.updateMarketplaceOrderStatusTransaction('ord_flow_01', 'COMPLETED');
    expect(completeResult.success).toBe(true);
    expect(completeResult.order?.status).toBe('COMPLETED');
    expect(completeResult.sale).toBeDefined();
    expect(completeResult.sale?.total).toBe(68.0);
    expect(completeResult.financeTransaction).toBeDefined();
    expect(completeResult.financeTransaction?.amount).toBe(68.0);
    expect(completeResult.financeTransaction?.type).toBe('INFLOW');

    // Verify sale row in database
    const saleRow = dbEngine.getRawDatabase()?.prepare('SELECT * FROM sales WHERE id = ?').get(completeResult.sale!.id);
    expect(saleRow).toBeDefined();

    // Verify finance transaction row in database
    const finRow = dbEngine.getRawDatabase()?.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(completeResult.financeTransaction!.id);
    expect(finRow).toBeDefined();
  });

  it('should refund stock atomically if an in-progress marketplace order is CANCELLED', () => {
    const orderData = {
      id: 'ord_cancel_01',
      publicTrackingToken: 'token_cancel_01',
      companyId: 'comp_mkt_1',
      companyName: 'Cantina do Beco',
      customerName: 'Lucas Pedrosa',
      customerPhone: '11966665555',
      customerAddress: 'Rua Bela Cintra, 800',
      items: [{ name: 'Fettuccine Alfredo', quantity: 3, unitPrice: 68.0, total: 204.0, productId: 'prod_1' }],
      total: 204.0,
      notes: '',
      paymentMethod: 'PIX',
      status: 'RECEIVED' as const,
      channel: 'MARKETPLACE' as const,
      createdAt: new Date().toISOString()
    };

    // Place order: stock goes from 20 to 17
    dbEngine.saveMarketplaceOrderTransaction(orderData, [{ productId: 'prod_1', quantity: 3 }], false);
    let p1 = dbEngine.getRawDatabase()?.prepare('SELECT stock FROM products WHERE id = ?').get('prod_1') as { stock: number };
    expect(p1.stock).toBe(17);

    // Cancel order: stock must be restored to 20
    const cancelResult = dbEngine.updateMarketplaceOrderStatusTransaction('ord_cancel_01', 'CANCELLED');
    expect(cancelResult.success).toBe(true);
    expect(cancelResult.stockRefunds).toBeDefined();
    expect(cancelResult.stockRefunds?.length).toBe(1);
    expect(cancelResult.stockRefunds?.[0].quantity).toBe(3);

    p1 = dbEngine.getRawDatabase()?.prepare('SELECT stock FROM products WHERE id = ?').get('prod_1') as { stock: number };
    expect(p1.stock).toBe(20);
  });
});
