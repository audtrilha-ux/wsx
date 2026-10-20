// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { CentralDatabaseEngine } from './central-db.js';

describe('Central Platform E2E Boot & Restart Integrity', () => {
  const TEST_DB_FILE = join(process.cwd(), 'data', 'test_boot_restart_e2e.db');

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

  it('P0.4 — Teste de boot limpo: should initialize tables, run migrations, and bootstrap cleanly on an empty database in-memory', () => {
    // 1. Boot on clean in-memory database
    const engine = new CentralDatabaseEngine(':memory:');
    
    // 2. Validate tables have been created by querying schema_migrations
    const rawDb = engine.getRawDatabase();
    expect(rawDb).toBeDefined();

    const migrations = rawDb?.prepare('SELECT version, migrated_at FROM schema_migrations ORDER BY version').all() as { version: number }[];
    expect(migrations).toBeDefined();
    expect(migrations.length).toBe(8);
    expect(migrations[0].version).toBe(1);
    expect(migrations[1].version).toBe(2);
    expect(migrations[2].version).toBe(3);
    expect(migrations[3].version).toBe(4);
    expect(migrations[4].version).toBe(5);
    expect(migrations[5].version).toBe(6);
    expect(migrations[6].version).toBe(7);
    expect(migrations[7].version).toBe(8);

    // 3. Verify that we can query companies table (should be empty but existing)
    const companies = rawDb?.prepare('SELECT count(*) as count FROM companies').get() as { count: number };
    expect(companies.count).toBe(0);

    engine.close();
  });

  it('P0.5 — Teste de restart: should persist a newly created tenant across physical database restarts without losing state', () => {
    cleanupTestDb();

    const mockState = (companyId: string, companyName: string) => ({
      companies: new Map([
        [companyId, {
          id: companyId,
          name: companyName,
          balance: 2500,
          status: 'active',
          plan: 'enterprise',
          installedApps: ['app_pos', 'app_public_space']
        }]
      ]),
      companyUsers: new Map([
        [companyId, [{
          id: `usr_${companyId}`,
          companyId: companyId,
          name: 'Manager User',
          email: 'manager@restart.com',
          role: 'manager',
          password: 'scrypt:hashed',
          active: true
        }]]
      ]),
      products: new Map(),
      sales: new Map(),
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
    });

    // --- INSTANCE 1: Clean boot from file, create a tenant, close ---
    const engine1 = new CentralDatabaseEngine(TEST_DB_FILE);
    expect(engine1.hasData()).toBe(false);

    // Persist our newly created tenant
    const testTenantId = 'company_restart_test_99';
    engine1.persistState(mockState(testTenantId, 'Empresa de Restart E2E') as unknown as Parameters<typeof engine1.persistState>[0]);
    expect(engine1.hasData()).toBe(true);

    // Verify Instance 1 sees the data
    const dbState1 = engine1.loadFromDatabase();
    expect(dbState1).toBeDefined();
    const loadedComp1 = dbState1?.companies?.find(([id]) => id === testTenantId);
    expect(loadedComp1).toBeDefined();
    expect((loadedComp1?.[1] as { name?: string }).name).toBe('Empresa de Restart E2E');

    // Close instance 1 (simulating server shutdown)
    engine1.close();

    // --- INSTANCE 2: Start new instance pointing to the SAME database file ---
    const engine2 = new CentralDatabaseEngine(TEST_DB_FILE);
    expect(engine2.hasData()).toBe(true);

    // Verify legacy detection and migration skip log has executed and we can load data directly
    const dbState2 = engine2.loadFromDatabase();
    expect(dbState2).toBeDefined();
    const loadedComp2 = dbState2?.companies?.find(([id]) => id === testTenantId);
    
    // Assert tenant survived restart fully intact
    expect(loadedComp2).toBeDefined();
    expect((loadedComp2?.[1] as { name?: string }).name).toBe('Empresa de Restart E2E');
    expect((loadedComp2?.[1] as { balance?: number }).balance).toBe(2500);

    const loadedUsers2 = dbState2?.companyUsers?.find(([compId]) => compId === testTenantId);
    expect(loadedUsers2).toBeDefined();
    expect((loadedUsers2?.[1] as { email?: string }[])[0]?.email).toBe('manager@restart.com');

    engine2.close();
  });
});
