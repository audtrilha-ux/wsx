// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { CentralDatabaseEngine } from './central-db.js';

describe('Legacy Database Migration & Rollback Semantics (P0.1 / P0.2)', () => {
  const TEST_DB_PATH = path.join(process.cwd(), 'test_legacy_migration.db');

  const cleanTestFiles = () => {
    for (const f of [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`]) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // ignore busy during test teardown
        }
      }
    }
  };

  beforeEach(() => {
    cleanTestFiles();
  });

  afterEach(() => {
    cleanTestFiles();
  });

  it('should successfully upgrade a legacy, partial database schema applying all migrations v1-v5', () => {
    // 1. Create a raw legacy database with old schema structure and no schema_migrations table
    const legacyDb = new DatabaseSync(TEST_DB_PATH);
    
    legacyDb.exec(`
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        plan TEXT NOT NULL,
        installed_apps TEXT DEFAULT '["pos_retail", "tables_restaurant"]'
      );

      CREATE TABLE company_users (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        password TEXT NOT NULL
      );

      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL
      );

      CREATE TABLE devices (
        device_id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        registered_at TEXT NOT NULL
      );

      CREATE TABLE os_releases (
        version TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        release_date TEXT NOT NULL,
        status TEXT NOT NULL,
        changelog TEXT NOT NULL,
        min_required_by_apps TEXT
      );

      CREATE TABLE telemetry (
        company_id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        overall_status TEXT NOT NULL
      );

      INSERT INTO companies (id, name, balance, status, plan, installed_apps)
      VALUES ('comp_legacy_1', 'Legacy Store Ltda', 250, 'active', 'pro', '["pos_retail", "tables_restaurant"]');

      INSERT INTO company_users (id, company_id, name, email, role, password)
      VALUES ('user_legacy_1', 'comp_legacy_1', 'Legacy Admin', 'admin@legacy.com', 'admin', 'hashedpwd');

      INSERT INTO devices (device_id, company_id, name, platform, registered_at)
      VALUES ('dev_legacy_1', 'comp_legacy_1', 'Balcao 01', 'web', '2026-08-01T10:00:00.000Z');

      INSERT INTO os_releases (version, channel, release_date, status, changelog, min_required_by_apps)
      VALUES ('1.0.0-legacy', 'stable', '2026-06-01', 'active', 'Legacy OS baseline', '1.0.0');

      INSERT INTO telemetry (company_id, timestamp, overall_status)
      VALUES ('comp_legacy_1', '2026-08-01T12:00:00.000Z', 'healthy');
    `);
    legacyDb.close();

    // 2. Initialize CentralDatabaseEngine pointing to the legacy file (runs migrations on construct)
    const engine = new CentralDatabaseEngine(TEST_DB_PATH);

    const rawDb = engine.getRawDatabase();
    expect(rawDb).toBeDefined();

    // 3. Verify that schema_migrations table was created and contains versions 1 through 8
    const executedMigrations = rawDb!.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[];
    expect(executedMigrations.map(m => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // 4. Verify that missing columns were added to existing tables
    const companyCols = (rawDb!.prepare('PRAGMA table_info(companies)').all() as { name: string }[]).map(c => c.name);
    expect(companyCols).toContain('slug');
    expect(companyCols).toContain('max_terminals');
    expect(companyCols).toContain('max_branches');
    expect(companyCols).toContain('channel');
    expect(companyCols).toContain('license_expires_at');
    expect(companyCols).toContain('allow_negative_stock');

    const userCols = (rawDb!.prepare('PRAGMA table_info(company_users)').all() as { name: string }[]).map(c => c.name);
    expect(userCols).toContain('branch_id');
    expect(userCols).toContain('pin');

    const deviceCols = (rawDb!.prepare('PRAGMA table_info(devices)').all() as { name: string }[]).map(c => c.name);
    expect(deviceCols).toContain('branch_id');
    expect(deviceCols).toContain('fingerprint_hash');
    expect(deviceCols).toContain('installation_id');
    expect(deviceCols).toContain('hardware_id');

    // 5. Verify backfill of os_releases and telemetry
    const osRelease = rawDb!.prepare('SELECT * FROM os_releases WHERE version = ?').get('1.0.0-legacy') as Record<string, unknown>;
    expect(osRelease).toBeDefined();
    expect(osRelease['id']).toBeDefined();
    expect(typeof osRelease['checksum']).toBe('string');
    expect(String(osRelease['checksum']).length).toBe(64); // SHA-256 hash length

    const telemetry = rawDb!.prepare('SELECT * FROM telemetry WHERE company_id = ?').get('comp_legacy_1') as Record<string, unknown>;
    expect(telemetry).toBeDefined();
    expect(telemetry['id']).toBe('comp_legacy_1');

    // 6. Verify that backfill created app_entitlements and app_installations for the legacy company
    const entitlements = rawDb!.prepare('SELECT * FROM app_entitlements WHERE company_id = ?').all('comp_legacy_1') as Record<string, unknown>[];
    expect(entitlements.length).toBe(2);
    expect(entitlements.map(e => e['app_id'])).toContain('pos_retail');
    expect(entitlements.map(e => e['app_id'])).toContain('tables_restaurant');

    const installations = rawDb!.prepare('SELECT * FROM app_installations WHERE company_id = ?').all('comp_legacy_1') as Record<string, unknown>[];
    expect(installations.length).toBe(2);

    // 7. Verify pre-existing data integrity
    const savedCompany = rawDb!.prepare('SELECT * FROM companies WHERE id = ?').get('comp_legacy_1') as Record<string, unknown>;
    expect(savedCompany['name']).toBe('Legacy Store Ltda');
    expect(savedCompany['balance']).toBe(250);

    const savedUser = rawDb!.prepare('SELECT * FROM company_users WHERE id = ?').get('user_legacy_1') as Record<string, unknown>;
    expect(savedUser['name']).toBe('Legacy Admin');
    expect(savedUser['email']).toBe('admin@legacy.com');

    engine.close();
  });

  it('should abort transaction and NOT register migration if a migration step fails in CentralDatabaseEngine', () => {
    // 1. Setup a database where migrations 1, 2, 3 have run, but a required table for migration 4 is missing
    const rawDb = new DatabaseSync(TEST_DB_PATH);
    rawDb.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        migrated_at TEXT NOT NULL
      );
      INSERT INTO schema_migrations (version, migrated_at) VALUES (1, datetime('now'));
      INSERT INTO schema_migrations (version, migrated_at) VALUES (2, datetime('now'));
      INSERT INTO schema_migrations (version, migrated_at) VALUES (3, datetime('now'));
      
      -- We deliberately DO NOT create the 'companies' table or drop it, which will cause migration 4's ensureCol to fail
      CREATE TABLE dummy_table (id TEXT PRIMARY KEY);
    `);
    rawDb.close();

    // 2. Initializing CentralDatabaseEngine must fail on migration 4 and throw
    let engineThrew = false;
    let errorMessage = '';
    try {
      new CentralDatabaseEngine(TEST_DB_PATH);
    } catch (err: unknown) {
      engineThrew = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    expect(engineThrew).toBe(true);
    expect(errorMessage).toContain('Critical Migration Failure at version 4');

    // 3. Inspect database directly: verify migration 4 was NOT registered and transaction was rolled back
    const verifyDb = new DatabaseSync(TEST_DB_PATH);
    const versions = (verifyDb.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[]).map(v => v.version);
    expect(versions).toEqual([1, 2, 3]);
    expect(versions).not.toContain(4);
    expect(versions).not.toContain(5);

    verifyDb.close();
  });
});
