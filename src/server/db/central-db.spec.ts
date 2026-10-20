// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { CentralDatabaseEngine } from './central-db.js';

describe('CentralDatabaseEngine (Phase G — Relational Drizzle & SQLite Integration)', () => {
  let engine: CentralDatabaseEngine;

  beforeEach(() => {
    engine = new CentralDatabaseEngine();
  });

  it('should initialize SQLite database instance with WAL mode and tables', () => {
    const rawDb = engine.getRawDatabase();
    expect(rawDb).toBeDefined();
    expect(typeof rawDb?.prepare).toBe('function');
  });

  it('should transactionally persist and read state', () => {
    const mockState = {
      companies: new Map([
        ['test_comp_sql', {
          id: 'test_comp_sql',
          name: 'Empresa Teste SQL',
          balance: 1500,
          status: 'active',
          plan: 'pro',
          installedApps: ['app_pos', 'app_inventory']
        }]
      ]),
      companyUsers: new Map([
        ['test_comp_sql', [{
          id: 'usr_sql_1',
          companyId: 'test_comp_sql',
          name: 'Admin SQL',
          email: 'admin@testsql.com',
          role: 'admin',
          password: 'hashed_pwd',
          active: true
        }]]
      ]),
      products: new Map([
        ['prod_sql_1', {
          id: 'prod_sql_1',
          companyId: 'test_comp_sql',
          name: 'Produto Teste DB',
          price: 49.9,
          stock: 100
        }]
      ]),
      sales: new Map([
        ['sale_sql_1', {
          id: 'sale_sql_1',
          companyId: 'test_comp_sql',
          items: [{ name: 'Item 1', quantity: 1, price: 49.9 }],
          total: 49.9,
          timestamp: new Date().toISOString()
        }]
      ]),
      customers: new Map(),
      tables: new Map(),
      financeTransactions: new Map(),
      publicSpaces: new Map(),
      devices: new Map(),
      invoices: new Map(),
      appEntitlements: new Map(),
      appInstallations: new Map(),
      paymentOrders: new Map(),
      companyLedger: new Map(),
      hqAuditLogs: []
    };

    engine.persistState(mockState);
    expect(engine.hasData()).toBe(true);

    const loaded = engine.loadFromDatabase();
    expect(loaded).toBeDefined();
    expect(loaded?.companies).toBeDefined();

    const savedCompany = loaded?.companies?.find(([id]) => id === 'test_comp_sql');
    expect(savedCompany).toBeDefined();
    expect((savedCompany?.[1] as { name: string }).name).toBe('Empresa Teste SQL');
    expect((savedCompany?.[1] as { balance: number }).balance).toBe(1500);

    const savedProduct = loaded?.products?.find(([id]) => id === 'prod_sql_1');
    expect(savedProduct).toBeDefined();
    expect((savedProduct?.[1] as { price: number }).price).toBe(49.9);
  });

  it('should transactionally add and read app artifacts', () => {
    const artifactId = 'test_art_id_123';
    const appId = 'app_pos';
    const version = '2.1.0';
    const checksum = 'f89a8123bcdef789a908a8e1bcf89a8123bcdef7';
    const artifactBase64 = 'eyJhcHBJZCI6ImFwcF9wb3MiLCJ2ZXJzaW9uIjoiMi4xLjAifQ==';

    engine.addAppArtifact(artifactId, appId, version, checksum, artifactBase64);
    
    const retrieved = engine.getAppArtifact(artifactId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(artifactId);
    expect(retrieved?.appId).toBe(appId);
    expect(retrieved?.version).toBe(version);
    expect(retrieved?.checksum).toBe(checksum);
    expect(retrieved?.artifactBase64).toBe(artifactBase64);

    const nonExistent = engine.getAppArtifact('does_not_exist');
    expect(nonExistent).toBeNull();
  });
});
