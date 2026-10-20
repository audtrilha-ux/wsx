// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import express from 'express';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  centralState,
  centralDatabase,
  CompanyData
} from '../state.js';
import { signJwt } from '../config.js';
import { authRouter } from '../routes/auth.js';
import { companiesRouter } from '../routes/companies.js';
import { hqAppsRouter } from '../routes/hq-apps.js';
import { telemetryRouter } from '../routes/telemetry.js';
import { productsRouter } from '../routes/products.js';

describe('3eatcru OS — Suite de Auditoria Completa do Centro de Comando HQ (Camada B)', () => {
  const TEST_DB = join(process.cwd(), 'data', 'test_hq_complete_audit.db');
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

    // Limpa rigorosamente todo o estado em memória para evitar orfãos entre testes
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
    centralState.invoices.clear();
    centralState.billingIdempotencyLog.clear();
    centralState.hqAuditLogs = [];
    centralState.apps = [];
    centralState.osReleases = [];

    const rawDb = centralDatabase.getRawDatabase();
    if (rawDb) {
      try {
        rawDb.prepare('DELETE FROM hq_audit_logs').run();
        rawDb.prepare('DELETE FROM company_ledger').run();
        rawDb.prepare('DELETE FROM invoices').run();
        rawDb.prepare('DELETE FROM app_releases').run();
        rawDb.prepare('DELETE FROM app_catalog').run();
        rawDb.prepare('DELETE FROM products').run();
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
    api.use('/hq/apps', hqAppsRouter);
    api.use('/', companiesRouter);
    api.use('/', productsRouter);
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

  it('TEST-HQ-01: Autenticação com credencial inexistente é rejeitada (401 Unauthorized)', async () => {
    const res = await fetch(`${baseUrl}/auth/hq-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invasor@desconhecido.com',
        password: 'senha_incorreta_total'
      })
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error?: string };
    expect(body.error).toBeDefined();
  });

  it('TEST-HQ-02: Superadmin autenticado com token HQ possui acesso garantido às rotas de governança', async () => {
    const hqToken = signJwt({
      id: 'superadmin_audit',
      name: 'Superadmin Plataforma',
      email: 'superadmin@3eatcru.com.br',
      role: 'hq_admin',
      authPlane: 'HQ'
    });

    const res = await fetch(`${baseUrl}/companies`, {
      headers: { Authorization: `Bearer ${hqToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json() as CompanyData[] | { items: CompanyData[] };
    const items = Array.isArray(body) ? body : body.items;
    expect(Array.isArray(items)).toBe(true);
  });

  it('TEST-HQ-03: Operador de loja (Role COMPANY) é terminantemente bloqueado de chamar rotas restritas da HQ', async () => {
    const operatorToken = signJwt({
      id: 'operator_loja',
      name: 'Caixa de Loja',
      email: 'caixa@loja.com.br',
      companyId: 'comp_qualquer',
      role: 'operator',
      authPlane: 'COMPANY'
    });

    const res = await fetch(`${baseUrl}/companies`, {
      headers: { Authorization: `Bearer ${operatorToken}` }
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/exclusivo do HQ Control Plane/i);
  });

  it('TEST-HQ-04: Sessão de suporte (isImpersonating: true) é impedida de invocar rotas globais da HQ', async () => {
    const supportToken = signJwt({
      id: 'suporte_agente_01',
      name: 'Analista de Suporte',
      email: 'suporte@3eatcru.com.br',
      role: 'hq_admin',
      authPlane: 'SUPPORT',
      isImpersonating: true,
      actingAs: 'comp_cliente_atendido'
    });

    const res = await fetch(`${baseUrl}/companies`, {
      headers: { Authorization: `Bearer ${supportToken}` }
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/Sessões de suporte não possuem acesso a rotas globais/i);
  });

  it('TEST-HQ-05: Provisionamento de nova empresa via HQ gera atomicamente tenant, filial e usuário admin', async () => {
    const hqToken = signJwt({
      id: 'superadmin_master',
      name: 'Diretor de Operações',
      email: 'diretor@3eatcru.com.br',
      role: 'hq_admin',
      authPlane: 'HQ'
    });

    const provisionPayload = {
      name: 'Restaurante Auditado Londrina',
      document: '99888777000166',
      plan: 'pro',
      adminName: 'Chef Gestor',
      adminEmail: 'gestor@bistrolondrina.com',
      trialDays: 14
    };

    const res = await fetch(`${baseUrl}/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`
      },
      body: JSON.stringify(provisionPayload)
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { success?: boolean; id?: string; company?: CompanyData };
    expect(body.success).toBe(true);
    expect(body.id).toBeDefined();
    const createdId = body.id!;

    // Valida persistência atômica no SQLite
    const rawDb = centralDatabase.getRawDatabase();
    const companyRow = rawDb?.prepare('SELECT * FROM companies WHERE id = ?').get(createdId) as { id?: string; name?: string; status?: string } | undefined;
    expect(companyRow).toBeDefined();
    expect(companyRow?.name).toBe('Restaurante Auditado Londrina');
    expect(companyRow?.status).toBe('active');

    const userRow = rawDb?.prepare('SELECT * FROM company_users WHERE company_id = ?').get(createdId) as { email?: string; role?: string } | undefined;
    expect(userRow).toBeDefined();
    expect(userRow?.email).toBe('gestor@bistrolondrina.com');
    expect(userRow?.role).toBe('admin');
  });

  it('TEST-HQ-06: Suspensão de inquilino via HQ (/tenants/:id/suspend) bloqueia imediatamente rotas do inquilino', async () => {
    const hqToken = signJwt({
      id: 'superadmin_master',
      name: 'Superadmin',
      email: 'admin@3eatcru.com',
      role: 'hq_admin',
      authPlane: 'HQ'
    });

    const comp: CompanyData = {
      id: 'comp_para_suspender',
      name: 'Loja Teste Suspensão',
      document: '77665544000122',
      status: 'active',
      createdAt: new Date().toISOString()
    };
    centralState.companies.set(comp.id, comp);

    const rawDb = centralDatabase.getRawDatabase();
    rawDb?.prepare(`
      INSERT OR REPLACE INTO companies (id, name, slug, balance, status, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(comp.id, comp.name, 'loja-suspensao', 0, 'active', 'pro');

    // 1. HQ suspende o inquilino
    const suspendRes = await fetch(`${baseUrl}/tenants/${comp.id}/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`
      },
      body: JSON.stringify({ status: 'suspended' })
    });
    expect(suspendRes.status).toBe(200);

    // 2. Operador da empresa tenta acessar /products
    const tokenLoja = signJwt({
      id: 'operador_suspenso',
      name: 'Operador',
      email: 'op@loja.com',
      companyId: comp.id,
      role: 'operator',
      authPlane: 'COMPANY'
    });

    const productsRes = await fetch(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer ${tokenLoja}` }
    });
    expect(productsRes.status).toBe(403);
    const prodBody = await productsRes.json() as { error?: string };
    expect(prodBody.error).toMatch(/licença corporativa está suspensa/i);
  });

  it('TEST-HQ-07: Injeção de crédito via HQ (/companies/:id/credit) atualiza saldo e gera lançamento no company_ledger', async () => {
    const hqToken = signJwt({
      id: 'superadmin_master',
      name: 'Superadmin',
      email: 'admin@3eatcru.com',
      role: 'hq_admin',
      authPlane: 'HQ'
    });

    const comp: CompanyData = {
      id: 'comp_para_credito',
      name: 'Loja Crédito',
      document: '88776655000133',
      balance: 50.00,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    centralState.companies.set(comp.id, comp);

    const rawDb = centralDatabase.getRawDatabase();
    rawDb?.prepare(`
      INSERT OR REPLACE INTO companies (id, name, slug, balance, status, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(comp.id, comp.name, 'loja-credito', 50.00, 'active', 'pro');

    const res = await fetch(`${baseUrl}/companies/${comp.id}/credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`
      },
      body: JSON.stringify({
        amount: 150.00,
        description: 'Bônus de implantação de franquia'
      })
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success?: boolean; newBalance?: number };
    expect(body.success).toBe(true);
    expect(body.newBalance).toBe(200.00);

    // Valida persistência atômica no SQLite
    const companyRow = rawDb?.prepare('SELECT balance FROM companies WHERE id = ?').get(comp.id) as { balance?: number } | undefined;
    expect(companyRow?.balance).toBe(200.00);

    const ledgerRows = rawDb?.prepare('SELECT * FROM company_ledger WHERE company_id = ?').all(comp.id) as { amount?: number; type?: string }[];
    expect(ledgerRows.length).toBeGreaterThanOrEqual(1);
    expect(ledgerRows.some(r => r.amount === 150.00)).toBe(true);
  });

  it('TEST-HQ-08: Ciclo de faturamento recorrente SaaS (/companies/run-billing) é idempotente por competência mensal', async () => {
    const hqToken = signJwt({
      id: 'superadmin_master',
      name: 'Superadmin',
      email: 'admin@3eatcru.com',
      role: 'hq_admin',
      authPlane: 'HQ'
    });

    const comp: CompanyData = {
      id: 'comp_billing_teste',
      name: 'Loja Faturamento Recorrente',
      document: '99112233000144',
      balance: 500.00,
      plan: 'pro',
      status: 'active',
      createdAt: new Date().toISOString(),
      installedApps: []
    };
    centralState.companies.set(comp.id, comp);

    const rawDb = centralDatabase.getRawDatabase();
    rawDb?.prepare(`
      INSERT OR REPLACE INTO companies (id, name, slug, balance, status, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(comp.id, comp.name, 'loja-faturamento', 500.00, 'active', 'pro');

    // 1º Ciclo de Billing
    const res1 = await fetch(`${baseUrl}/companies/run-billing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hqToken}` }
    });
    expect(res1.status).toBe(200);

    const balanceAfterRun1 = centralState.companies.get(comp.id)?.balance ?? 500;

    // 2º Ciclo de Billing (Mesmo mês/competência corrente)
    const res2 = await fetch(`${baseUrl}/companies/run-billing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hqToken}` }
    });
    expect(res2.status).toBe(200);

    const balanceAfterRun2 = centralState.companies.get(comp.id)?.balance ?? 0;
    // O saldo deve se manter inalterado entre execuções na mesma competência
    expect(balanceAfterRun2).toBe(balanceAfterRun1);
  });

  it('TEST-HQ-09: Gestão de catálogo na HQ (/hq/catalog) persiste aplicativos e rejeita payloads inválidos', async () => {
    const hqToken = signJwt({
      id: 'superadmin_master',
      name: 'Superadmin',
      email: 'admin@3eatcru.com',
      role: 'hq_admin',
      authPlane: 'HQ'
    });

    // 1. Cadastra novo app no catálogo
    const appPayload = {
      id: 'app_teste_kpi',
      name: 'Painel KPI Executivo',
      description: 'Analytics em tempo real para tomada de decisão',
      category: 'Analytics',
      icon: 'insights',
      pricing: { model: 'FREE' },
      lifecycle: { status: 'DRAFT' }
    };

    const res = await fetch(`${baseUrl}/hq/apps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`
      },
      body: JSON.stringify(appPayload)
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id?: string; name?: string };
    expect(body.id).toBe('app_teste_kpi');

    // 2. Tenta cadastrar com payload inválido (sem nome)
    const invalidRes = await fetch(`${baseUrl}/hq/apps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`
      },
      body: JSON.stringify({ id: 'app_invalido' })
    });
    expect(invalidRes.status).toBe(400);
  });

  it('TEST-HQ-10: Snapshot de integridade e diagnósticos do banco SQLite na HQ operam com sucesso', async () => {
    const hqToken = signJwt({
      id: 'superadmin_master',
      name: 'Superadmin',
      email: 'admin@3eatcru.com',
      role: 'hq_admin',
      authPlane: 'HQ'
    });

    const res = await fetch(`${baseUrl}/hq/store/backup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hqToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success?: boolean; snapshotFile?: string };
    expect(body.success).toBe(true);
    expect(body.snapshotFile).toBeDefined();
  });
});
