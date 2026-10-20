// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CentralDatabaseEngine } from './central-db.js';
import { centralState, saveCentralState } from '../state.js';
import { hashPassword, verifyPassword } from '../config.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Security & Credential Leakage Prevention (P0.3)', () => {
  const TEST_BACKUP_PATH = path.join(process.cwd(), 'data', 'central_store.json');
  const engine = new CentralDatabaseEngine();

  it('should strictly hash operator and user PINs with salt and prevent plaintext persistence', () => {
    const rawPin = '987654';
    const hashedPin = hashPassword(rawPin);

    expect(hashedPin).not.toBe(rawPin);
    expect(hashedPin.length).toBeGreaterThan(20);
    expect(verifyPassword(rawPin, hashedPin)).toBe(true);
    expect(verifyPassword('123456', hashedPin)).toBe(false);
  });

  it('should not contain raw passwords, PINs or MFA secrets in JSON backup files', () => {
    const tenantId = 'tenant_leak_check_' + Date.now();
    const rawPassword = 'SuperSecretPassword!123';
    const rawPin = '849201';
    const rawMfaSecret = 'JBSWY3DPEHPK3PXP_AUDIT_SECRET';

    const hashedPassword = hashPassword(rawPassword);
    const hashedPin = hashPassword(rawPin);

    centralState.companyUsers.set('user_leak_check', {
      id: 'user_leak_check',
      companyId: tenantId,
      name: 'Audit User',
      email: 'audit@tenant.com',
      role: 'operator',
      password: hashedPassword,
      pin: hashedPin,
      active: true,
      lastLogin: new Date().toISOString()
    });

    centralState.hqAdmins.push({
      id: 'admin_leak_check',
      name: 'Audit HQ Admin',
      email: 'hq_mfa_check@3eatcru.com',
      password: hashedPassword,
      role: 'hq_admin',
      mfaEnabled: true,
      mfaSecret: rawMfaSecret
    });

    saveCentralState();

    expect(fs.existsSync(TEST_BACKUP_PATH)).toBe(true);
    const backupContent = fs.readFileSync(TEST_BACKUP_PATH, 'utf-8');
    
    expect(backupContent).not.toContain(rawPassword);
    expect(backupContent).not.toContain(`"${rawPin}"`);
    expect(backupContent).not.toContain(`: ${rawPin}`);
    expect(backupContent).not.toContain(rawMfaSecret);
    expect(backupContent).not.toContain('mfaSecret');
  });

  it('should verify that SQLite company_users table contains only hashed credentials', () => {
    const rawPassword = 'SecretPassword99!';
    const rawPin = '654321';
    const userId = 'usr_db_check_' + Date.now();
    const companyId = 'comp_db_check_' + Date.now();

    const mockState = {
      companies: new Map([
        [companyId, {
          id: companyId,
          name: 'DB Leak Check Ltda',
          balance: 100,
          status: 'active',
          plan: 'pro'
        }]
      ]),
      companyUsers: new Map([
        [companyId, [{
          id: userId,
          companyId,
          name: 'Operator Security Check',
          email: 'security@op.com',
          role: 'operator',
          password: hashPassword(rawPassword),
          pin: hashPassword(rawPin),
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
      companyLedger: new Map()
    };

    engine.persistState(mockState);

    const rawDb = engine.getRawDatabase();
    const userInDb = rawDb?.prepare('SELECT * FROM company_users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;

    expect(userInDb).toBeDefined();
    expect(userInDb?.['password']).not.toBe(rawPassword);
    expect(userInDb?.['pin']).not.toBe(rawPin);
    expect(verifyPassword(rawPassword, String(userInDb!['password']))).toBe(true);
    expect(verifyPassword(rawPin, String(userInDb!['pin']))).toBe(true);
  });

  it('should verify that audit logs sanitize sensitive operations', () => {
    const sensitiveLog = {
      id: 'log_leak_test_' + Date.now(),
      timestamp: new Date().toISOString(),
      adminId: 'admin_audit',
      adminName: 'Super Admin',
      action: 'TENANT_ONBOARDED',
      targetTenantId: 'comp_leak_check',
      targetTenantName: 'Tenant Check',
      details: JSON.stringify({
        email: 'tenant@admin.com',
        action: 'Provisioning completed successfully',
      }),
      ipAddress: '127.0.0.1'
    };

    const mockState = {
      companies: new Map(),
      companyUsers: new Map(),
      products: new Map(),
      sales: new Map(),
      customers: new Map(),
      tables: new Map(),
      financeTransactions: new Map(),
      publicSpaces: new Map(),
      devices: new Map(),
      invoices: new Map(),
      appEntitlements: new Map(),
      companyLedger: new Map(),
      hqAuditLogs: [sensitiveLog]
    };

    engine.persistState(mockState);

    const rawDb = engine.getRawDatabase();
    const logged = rawDb?.prepare('SELECT * FROM hq_audit_logs WHERE id = ?').get(sensitiveLog.id) as Record<string, unknown> | undefined;

    expect(logged).toBeDefined();
    expect(logged?.['details']).not.toContain('password');
    expect(logged?.['details']).not.toContain('pin');
    expect(logged?.['details']).not.toContain('mfaSecret');
  });
});
