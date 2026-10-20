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
  PublicSpaceData
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
import { hqAppsRouter } from '../routes/hq-apps.js';

describe('3eatcru OS — Matriz de Regressão Transversal do Ecossistema (Camadas A até H)', () => {
  const TEST_DB = join(process.cwd(), 'data', 'test_ecosystem_regression.db');
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

    // Reset clean state
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
        // Ignored
      }
    }

    app = express();
    app.set('trust proxy', 1);
    app.use(express.json());

    const api = express.Router();
    api.use('/auth', authRouter);
    api.use('/customer', customerRouter);
    api.use('/sync', syncRouter);
    api.use('/hq', hqAppsRouter);
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

  it('CENÁRIO 01 & 04 (Camadas B, C, D): HQ Admin gerencia empresas e auditoria; Operador de loja é proibido de acessar plano HQ', async () => {
    // 1. Criar empresa na base
    const testCompany: CompanyData = {
      id: 'comp_londrina_01',
      name: 'Bistrô Londrina Centro',
      document: '12345678000199',
      status: 'active',
      createdAt: new Date().toISOString()
    };
    centralState.companies.set(testCompany.id, testCompany);

    // 2. Token HQ Admin
    const hqToken = signJwt({
      id: 'superadmin_hq',
      name: 'Superadmin Plataforma',
      email: 'admin@3eatcru.com.br',
      role: 'hq_admin',
      authPlane: 'HQ'
    });

    // 3. Token Operador de Loja
    const operatorToken = signJwt({
      id: 'user_operator_01',
      name: 'Operador de Caixa',
      email: 'caixa@bistro.com.br',
      companyId: 'comp_londrina_01',
      role: 'operator',
      authPlane: 'COMPANY'
    });

    // 4. HQ Admin lista empresas com sucesso
    const hqRes = await fetch(`${baseUrl}/companies`, {
      headers: { Authorization: `Bearer ${hqToken}` }
    });
    expect(hqRes.status).toBe(200);
    const hqData = await hqRes.json() as { items?: CompanyData[] } | CompanyData[];
    const items = Array.isArray(hqData) ? hqData : hqData.items;
    expect(items?.some((c: CompanyData) => c.id === 'comp_londrina_01')).toBe(true);

    // 5. Operador de Loja tenta acessar lista global de empresas na HQ -> 403 Forbidden
    const deniedRes = await fetch(`${baseUrl}/companies`, {
      headers: { Authorization: `Bearer ${operatorToken}` }
    });
    expect(deniedRes.status).toBe(403);
  });

  it('CENÁRIO 02 (Camadas C, D, E): Isolamento de Tenant — Empresa A não enxerga dados da Empresa B', async () => {
    // Setup das duas empresas
    const compA: CompanyData = { id: 'comp_alpha', name: 'Alpha Modas', document: '11111111000111', status: 'active', createdAt: new Date().toISOString() };
    const compB: CompanyData = { id: 'comp_beta', name: 'Beta Burger', document: '22222222000122', status: 'active', createdAt: new Date().toISOString() };
    centralState.companies.set(compA.id, compA);
    centralState.companies.set(compB.id, compB);

    // Produtos de cada empresa
    const prodA: ProductData = { id: 'prod_alpha_1', companyId: 'comp_alpha', name: 'Vestido Floral', price: 150, category: 'Moda' };
    const prodB: ProductData = { id: 'prod_beta_1', companyId: 'comp_beta', name: 'X-Bacon Artesanal', price: 38, category: 'Lanches' };
    centralState.products.set(prodA.id, prodA);
    centralState.products.set(prodB.id, prodB);

    // Token do operador da Empresa Alpha
    const tokenAlpha = signJwt({
      id: 'user_alpha',
      name: 'Gerente Alpha',
      email: 'gerente@alpha.com',
      companyId: 'comp_alpha',
      role: 'manager',
      authPlane: 'COMPANY'
    });

    // Consulta de produtos pelo operador Alpha
    const res = await fetch(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer ${tokenAlpha}` }
    });
    expect(res.status).toBe(200);
    const data = await res.json() as ProductData[];
    expect(data.some(p => p.id === 'prod_alpha_1')).toBe(true);
    // Verificação estrita de vazamento: produto da Empresa Beta NUNCA pode estar presente
    expect(data.some(p => p.id === 'prod_beta_1')).toBe(false);
  });

  it('CENÁRIO 07 (Camadas E, F): Espaço Público — Produtos expostos aos clientes não vazam custos ou margens internas', async () => {
    const comp: CompanyData = { id: 'comp_cafe', name: 'Café Londrina Imperial', document: '33333333000133', status: 'active', createdAt: new Date().toISOString() };
    centralState.companies.set(comp.id, comp);

    const publicSpace: PublicSpaceData = {
      companyId: 'comp_cafe',
      companySlug: 'cafe-londrina-imperial',
      title: 'Café Londrina Imperial',
      status: 'published',
      products: [
        {
          id: 'prod_cafe_01',
          name: 'Café Espresso Catuaí',
          description: 'Grãos selecionados do norte do Paraná',
          price: 9.50,
          category: 'Bebidas',
          available: true
        }
      ]
    };
    centralState.publicSpaces.set(comp.id, publicSpace);

    // Requisição pública e desautenticada
    const res = await fetch(`${baseUrl}/public-space/slug/cafe-londrina-imperial`);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      products?: {
        name: string;
        price: number;
        costPrice?: unknown;
        margin?: unknown;
        supplier?: unknown;
        internalNotes?: unknown;
      }[];
    };

    expect(body.products).toBeDefined();
    expect(body.products?.length).toBe(1);
    const item = body.products![0];
    expect(item.name).toBe('Café Espresso Catuaí');
    expect(item.price).toBe(9.50);

    // Garantia estrita de privacidade contra vazamento de margem interna
    expect(item.costPrice).toBeUndefined();
    expect(item.margin).toBeUndefined();
    expect(item.supplier).toBeUndefined();
    expect(item.internalNotes).toBeUndefined();
  });

  it('CENÁRIO 10 (Camadas E, H, A): Operação e Sync Offline — Reenvio com mesmo ID é idempotente e não duplica venda', async () => {
    const comp: CompanyData = { id: 'comp_pizzaria', name: 'Pizzaria Napolitana', document: '44444444000144', status: 'active', createdAt: new Date().toISOString() };
    centralState.companies.set(comp.id, comp);

    // Persistir empresa e produto no SQLite para satisfazer integridade referencial das FKs
    const db = centralDatabase.getRawDatabase();
    db?.prepare(`
      INSERT OR REPLACE INTO companies (id, name, slug, balance, status, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(comp.id, comp.name, 'pizzaria-napolitana', 0, 'active', 'pro');

    db?.prepare(`
      INSERT OR REPLACE INTO products (id, company_id, name, price, stock)
      VALUES (?, ?, ?, ?, ?)
    `).run('prod_pizza_01', comp.id, 'Pizza Margherita', 75.00, 50);

    // Entitlement de licença do PDV
    centralState.appEntitlements.set(`${comp.id}:app_pos`, {
      id: 'ent_pizzaria_pos',
      companyId: comp.id,
      appId: 'app_pos',
      status: 'ACTIVE',
      entitledAt: new Date().toISOString()
    });

    // Produto no catálogo mestre em memória
    centralState.products.set('prod_pizza_01', {
      id: 'prod_pizza_01',
      companyId: comp.id,
      name: 'Pizza Margherita',
      price: 75.00,
      stock: 50,
      category: 'Pizzas'
    });

    const token = signJwt({
      id: 'cashier_pizzaria',
      name: 'Operador Caixa',
      email: 'caixa@pizzaria.com',
      companyId: 'comp_pizzaria',
      role: 'operator',
      authPlane: 'COMPANY'
    });

    const syncPayload = {
      companyId: 'comp_pizzaria',
      operations: [
        {
          id: 'op_sync_venda_offline_001',
          idempotencyKey: 'tx-offline-e2e-001',
          tenantId: 'comp_pizzaria',
          action: 'sale.create',
          payload: {
            id: 'venda_offline_uuid_1001',
            companyId: 'comp_pizzaria',
            total: 75.00,
            paymentMethod: 'DINHEIRO',
            timestamp: new Date().toISOString(),
            items: [
              {
                productId: 'prod_pizza_01',
                name: 'Pizza Margherita',
                quantity: 1,
                price: 75.00
              }
            ]
          }
        }
      ]
    };

    // 1º Envio
    const res1 = await fetch(`${baseUrl}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(syncPayload)
    });
    expect(res1.status).toBe(200);
    const body1 = await res1.json() as { acks?: { status: string }[] };
    expect(body1.acks?.[0]?.status).toBe('ACK');

    const salesCountBeforeRetry = Array.from(centralState.sales.values()).filter(s => s.companyId === 'comp_pizzaria').length;
    expect(salesCountBeforeRetry).toBe(1);

    // 2º Envio (Simulando repetição acidental de rede/retry do cliente offline)
    const res2 = await fetch(`${baseUrl}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(syncPayload)
    });
    expect(res2.status).toBe(200);
    const body2 = await res2.json() as { acks?: { status: string }[] };
    expect(body2.acks?.[0]?.status).toBe('DUPLICATE');

    // O total de vendas gravadas não pode ser duplicado
    const salesCountAfterRetry = Array.from(centralState.sales.values()).filter(s => s.companyId === 'comp_pizzaria').length;
    expect(salesCountAfterRetry).toBe(1);
  });

  it('CENÁRIO 03 (Camadas C, D): Proprietário administra funcionários de sua empresa e é bloqueado ao tentar acessar outra empresa (Anti-IDOR)', async () => {
    const compA: CompanyData = { id: 'comp_gestao_a', name: 'Comércio A', document: '11111111000199', status: 'active', createdAt: new Date().toISOString() };
    const compB: CompanyData = { id: 'comp_gestao_b', name: 'Comércio B', document: '22222222000199', status: 'active', createdAt: new Date().toISOString() };
    centralState.companies.set(compA.id, compA);
    centralState.companies.set(compB.id, compB);

    const db = centralDatabase.getRawDatabase();
    db?.prepare(`
      INSERT OR REPLACE INTO companies (id, name, slug, balance, status, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(compA.id, compA.name, 'comercio-a', 0, 'active', 'pro');

    db?.prepare(`
      INSERT OR REPLACE INTO companies (id, name, slug, balance, status, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(compB.id, compB.name, 'comercio-b', 0, 'active', 'pro');

    const tokenAdminA = signJwt({
      id: 'admin_a',
      name: 'Proprietário A',
      email: 'dono@a.com',
      companyId: 'comp_gestao_a',
      role: 'admin',
      authPlane: 'COMPANY'
    });

    // 1. Admin A cadastra funcionário para a sua própria empresa -> 201 Created
    const createRes = await fetch(`${baseUrl}/companies/comp_gestao_a/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`
      },
      body: JSON.stringify({
        name: 'Operador de Frente A',
        email: 'operador@a.com',
        pin: '1234',
        role: 'operator'
      })
    });
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json() as { success?: boolean; user?: { id: string; name: string } };
    expect(createBody.success).toBe(true);
    expect(createBody.user?.name).toBe('Operador de Frente A');

    // 2. Admin A tenta cadastrar funcionário para o Comércio B -> 403 Forbidden (Anti-IDOR)
    const idorRes = await fetch(`${baseUrl}/companies/comp_gestao_b/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`
      },
      body: JSON.stringify({
        name: 'Invasor Tentativa',
        email: 'invasor@a.com',
        pin: '9999',
        role: 'operator'
      })
    });
    expect(idorRes.status).toBe(403);
    const idorBody = await idorRes.json() as { error?: string };
    expect(idorBody.error).toMatch(/violação de limite de tenant/i);
  });

  it('CENÁRIO 09 (Camadas C, D, H): Rejeição de lote de sincronização offline quando há divergência de tenant (Tenant Mismatch)', async () => {
    const compA: CompanyData = { id: 'comp_sync_a', name: 'Loja Sync A', document: '33333333000199', status: 'active', createdAt: new Date().toISOString() };
    centralState.companies.set(compA.id, compA);

    const tokenA = signJwt({
      id: 'cashier_a',
      name: 'Operador Caixa A',
      email: 'caixa@sync-a.com',
      companyId: 'comp_sync_a',
      role: 'operator',
      authPlane: 'COMPANY'
    });

    // Lote adulterado contendo tenantId diferente da sessão
    const mismatchPayload = {
      companyId: 'comp_sync_a',
      operations: [
        {
          id: 'op_mismatch_001',
          tenantId: 'comp_sync_b', // Discrepância proposital
          action: 'sale.create',
          payload: {
            id: 'venda_mismatch_001',
            companyId: 'comp_sync_b',
            total: 50.00,
            paymentMethod: 'DINHEIRO',
            items: []
          }
        }
      ]
    };

    const res = await fetch(`${baseUrl}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify(mismatchPayload)
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { acks?: { status: string; error?: string }[] };
    expect(body.acks?.[0]?.status).toBe('FAILED');
    expect(body.acks?.[0]?.error).toMatch(/Acesso negado: A operação pertence ao tenant/i);
  });

  it('CENÁRIO 12 (Camadas B, C, E, F): Empresa suspensa pela HQ é bloqueada no espaço público e nas rotas de negócio', async () => {
    const comp: CompanyData = {
      id: 'comp_inadimplente',
      name: 'Mercadinho Inadimplente',
      document: '55555555000155',
      status: 'suspended',
      createdAt: new Date().toISOString()
    };
    centralState.companies.set(comp.id, comp);

    const publicSpace: PublicSpaceData = {
      companyId: 'comp_inadimplente',
      companySlug: 'mercadinho-inadimplente',
      title: 'Mercadinho Inadimplente',
      status: 'published',
      products: []
    };
    centralState.publicSpaces.set(comp.id, publicSpace);

    // 1. Tentativa de acesso à vitrine pública de empresa suspensa -> 403 Forbidden
    const res = await fetch(`${baseUrl}/public-space/slug/mercadinho-inadimplente`);
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/indisponível ou suspenso/i);

    // 2. Operador de empresa suspensa tenta acessar rotas operacionais restritas -> 403 Forbidden
    const tokenSuspended = signJwt({
      id: 'user_suspended',
      name: 'Operador Suspenso',
      email: 'caixa@inadimplente.com',
      companyId: 'comp_inadimplente',
      role: 'operator',
      authPlane: 'COMPANY'
    });

    const productsRes = await fetch(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer ${tokenSuspended}` }
    });
    expect(productsRes.status).toBe(403);
    const prodBody = await productsRes.json() as { error?: string };
    expect(prodBody.error).toMatch(/licença corporativa está suspensa/i);
  });
});
