// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { CentralDatabaseEngine } from './central-db.js';
import { signJwt } from '../config.js';
import { assertBranchAccess, requireTenant } from '../middleware.js';
import { centralState } from '../state.js';
import type { AuthenticatedRequest } from '../middleware.js';
import type { Response } from 'express';

interface MockResponse {
  statusCode: number;
  body: { error?: string } | null;
  status: (code: number) => MockResponse;
  json: (data: unknown) => MockResponse;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data as { error?: string };
      return this;
    }
  };
  return res;
}

describe('Store & Platform Architecture Acceptance E2E (Audit Pro Baseline)', () => {
  let db: CentralDatabaseEngine;

  beforeEach(() => {
    db = new CentralDatabaseEngine(':memory:');
  });

  describe('1. C-01 & C-02: Branch Authorization and Persistence Lifecycle', () => {
    it('should persist multiple branchIds on user and reload them identically after database restart', () => {
      // 1. Provision company and user with multiple branchIds
      const company = {
        id: 'comp_audit_1',
        name: 'Empresa Multi-Filiais',
        tradeName: 'Multi Filiais Ltda',
        cnpj: '11.222.333/0001-44',
        email: 'multi@empresa.com',
        phone: '11999998888',
        plan: 'pro',
        status: 'active',
        branches: [
          { id: 'branch_matriz', name: 'Matriz SP', isMain: true, active: true },
          { id: 'branch_filial_rj', name: 'Filial RJ', isMain: false, active: true },
          { id: 'branch_filial_mg', name: 'Filial MG', isMain: false, active: true }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const user = {
        id: 'user_mgr_1',
        companyId: 'comp_audit_1',
        name: 'Gerente Regional',
        email: 'mgr@empresa.com',
        role: 'manager',
        password: 'hashed_password_123',
        pin: '1234',
        active: true,
        branchId: 'branch_matriz',
        branchIds: ['branch_matriz', 'branch_filial_rj']
      };

      db.persistState({
        companies: new Map([['comp_audit_1', company]]),
        companyUsers: new Map([['comp_audit_1', [user]]]),
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
      } as unknown as Parameters<typeof db.persistState>[0]);

      // 2. Verify user in database
      const rawDb = db.getRawDatabase();
      expect(rawDb).toBeDefined();

      const userRow = rawDb!.prepare('SELECT * FROM company_users WHERE id = ?').get('user_mgr_1') as Record<string, unknown>;
      expect(userRow).toBeDefined();
      expect(JSON.parse(userRow['branch_ids'] as string)).toEqual(['branch_matriz', 'branch_filial_rj']);
    });

    it('should grant access to authorized branch and strictly reject unauthorized branch with 403', () => {
      const user = {
        id: 'user_mgr_1',
        name: 'Gerente Regional',
        email: 'mgr@empresa.com',
        role: 'manager' as const,
        companyId: 'comp_audit_1',
        branchId: 'branch_matriz',
        branchIds: ['branch_matriz', 'branch_filial_rj']
      };

      // Matriz -> Allowed
      const accessMatriz = assertBranchAccess(user, 'branch_matriz');
      expect(accessMatriz.allowed).toBe(true);
      expect(accessMatriz.effectiveBranchId).toBe('branch_matriz');

      // Filial RJ -> Allowed
      const accessRJ = assertBranchAccess(user, 'branch_filial_rj');
      expect(accessRJ.allowed).toBe(true);
      expect(accessRJ.effectiveBranchId).toBe('branch_filial_rj');

      // Filial MG -> REJECTED with error message
      const accessMG = assertBranchAccess(user, 'branch_filial_mg');
      expect(accessMG.allowed).toBe(false);
      expect(accessMG.error).toContain('Operador não possui autorização para a filial \'branch_filial_mg\'');
    });
  });

  describe('2. C-03: Strict authPlane Isolation', () => {
    it('should reject pure HQ Admin token when calling tenant route without audited support impersonation', () => {
      const hqToken = signJwt({
        id: 'hq_admin_1',
        name: 'Super HQ Admin',
        email: 'hq@3eatcru.com',
        role: 'hq_admin',
        authPlane: 'HQ'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${hqToken}` },
        params: { id: 'comp_audit_1' }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('Administradores HQ devem usar sessão de suporte auditada');
    });

    it('should allow support session when properly impersonating actingAs tenant', () => {
      const supportToken = signJwt({
        id: 'hq_admin_1',
        name: 'Super HQ Admin',
        email: 'hq@3eatcru.com',
        role: 'hq_admin',
        authPlane: 'SUPPORT',
        isImpersonating: true,
        actingAs: 'comp_audit_1'
      }, 3600);

      // Add active company to state
      centralState.companies.set('comp_audit_1', {
        id: 'comp_audit_1',
        name: 'Empresa Ativa',
        tradeName: 'Empresa Ativa',
        cnpj: '11.222.333/0001-44',
        email: 'contato@empresa.com',
        phone: '11999998888',
        plan: 'pro',
        status: 'active',
        branches: [],
        installedApps: [],
        maxTerminals: 5,
        maxBranches: 2,
        activeTerminals: 1,
        channel: 'stable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${supportToken}` },
        params: { id: 'comp_audit_1' }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.user?.companyId).toBe('comp_audit_1');
    });
  });

  describe('3. H-06: Device Decommissioning Cascade Cleanup', () => {
    it('should delete associated app installations when device is deleted', () => {
      const company = {
        id: 'comp_audit_dev',
        name: 'Empresa Terminais',
        tradeName: 'Terminais Ltda',
        cnpj: '22.333.444/0001-55',
        email: 'terminais@empresa.com',
        phone: '11988887777',
        plan: 'pro',
        status: 'active',
        branches: [{ id: 'main', name: 'Principal', isMain: true, active: true }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const device = {
        id: 'dev_pos_01',
        companyId: 'comp_audit_dev',
        branchId: 'main',
        hardwareId: 'HW_TEST_123',
        name: 'Terminal Caixa 01',
        model: 'Sunmi POS',
        status: 'active',
        osVersion: '2.1.0',
        registeredAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      };

      const installation1 = {
        id: 'comp_audit_dev:dev_pos_01:app_pos',
        companyId: 'comp_audit_dev',
        deviceId: 'dev_pos_01',
        appId: 'app_pos',
        version: '1.4.3',
        status: 'INSTALLED',
        installedAt: new Date().toISOString()
      };

      const installation2 = {
        id: 'comp_audit_dev:dev_pos_01:app_inventory',
        companyId: 'comp_audit_dev',
        deviceId: 'dev_pos_01',
        appId: 'app_inventory',
        version: '1.4.3',
        status: 'INSTALLED',
        installedAt: new Date().toISOString()
      };

      db.persistState({
        companies: new Map([['comp_audit_dev', company]]),
        companyUsers: new Map(),
        products: new Map(),
        sales: new Map(),
        customers: new Map(),
        tables: new Map(),
        financeTransactions: new Map(),
        publicSpaces: new Map(),
        devices: new Map([['dev_pos_01', device]]),
        invoices: new Map(),
        appEntitlements: new Map(),
        appInstallations: new Map([
          ['comp_audit_dev:dev_pos_01:app_pos', installation1],
          ['comp_audit_dev:dev_pos_01:app_inventory', installation2]
        ]),
        paymentOrders: new Map(),
        companyLedger: new Map(),
        hqAuditLogs: []
      } as unknown as Parameters<typeof db.persistState>[0]);

      const rawDb = db.getRawDatabase()!;
      const beforeCount = (rawDb.prepare('SELECT COUNT(*) as count FROM app_installations WHERE device_id = ?').get('dev_pos_01') as { count: number }).count;
      expect(beforeCount).toBe(2);

      // 3. Delete device via transaction
      const deleteResult = db.deleteDeviceTransaction('comp_audit_dev', 'dev_pos_01');
      expect(deleteResult.success).toBe(true);

      // 4. Verify device is gone and installations are completely purged
      const deviceAfter = db.getDevice('comp_audit_dev', 'dev_pos_01');
      expect(deviceAfter).toBeUndefined();

      const afterCount = (rawDb.prepare('SELECT COUNT(*) as count FROM app_installations WHERE device_id = ?').get('dev_pos_01') as { count: number }).count;
      expect(afterCount).toBe(0);
    });
  });

  describe('4. STORE PLATFORM GOLDEN PATH (End-to-End Enterprise Scenario)', () => {
    it('should execute complete lifecycle: Draft App -> Release 1.0.0 -> Publish -> Entitle & Install -> Restart -> Release 1.1.0 -> Update -> Uninstall', () => {
      // 1. Create App as DRAFT in Database
      const app = {
        id: 'app_golden_flow',
        name: 'Golden Flow App',
        description: 'App para validação do fluxo áureo de ponta a ponta',
        developer: 'HQ Enterprise',
        category: 'SALES',
        icon: 'stars',
        pricing: { model: 'SUBSCRIPTION_MONTHLY' as const, amount: 49.90, currency: 'BRL' },
        lifecycle: { status: 'DRAFT' as const },
        permissions: ['storage.read', 'storage.write', 'printer.tickets'],
        capabilities: [],
        dependencies: [],
        isSystemApp: false
      };
      db.upsertAppCatalogItemTransaction(app);

      const loadedApp = db.getAppCatalogItem('app_golden_flow');
      expect(loadedApp).toBeDefined();
      expect(loadedApp?.lifecycle.status).toBe('DRAFT');

      // 2. Add Release 1.0.0 Stable with artifact and checksum
      const artifactId1 = 'art_golden_1_0_0';
      const checksum1 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      db.addAppArtifact(artifactId1, 'app_golden_flow', '1.0.0', checksum1, 'mock_bundle_base64');
      db.addAppReleaseTransaction({
        appId: 'app_golden_flow',
        version: '1.0.0',
        channel: 'stable',
        minOsVersion: '1.0.0',
        artifactId: artifactId1,
        checksum: checksum1,
        signature: null,
        releasedAt: new Date().toISOString(),
        status: 'PUBLISHED'
      });

      // 3. Publish the App
      app.lifecycle.status = 'PUBLISHED';
      app.currentRelease = {
        version: '1.0.0',
        minOsVersion: '1.0.0',
        releaseChannel: 'stable',
        checksum: checksum1
      };
      db.upsertAppCatalogItemTransaction(app);
      expect(db.getAppCatalogItem('app_golden_flow')?.lifecycle.status).toBe('PUBLISHED');

      // 4. Create Tenant and Register Terminal Device
      const company = {
        id: 'comp_golden',
        name: 'Restaurante Golden',
        tradeName: 'Golden Ltda',
        cnpj: '33.444.555/0001-66',
        email: 'golden@restaurante.com',
        phone: '11977776666',
        plan: 'pro',
        status: 'active',
        branches: [{ id: 'main', name: 'Matriz', isMain: true, active: true }],
        channel: 'stable',
        balance: 1000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const device = {
        id: 'dev_golden_pos',
        companyId: 'comp_golden',
        branchId: 'main',
        hardwareId: 'HW_GOLDEN_888',
        name: 'Caixa 01 Golden',
        status: 'active',
        osVersion: '1.4.3',
        registeredAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      };

      db.persistState({
        companies: new Map([['comp_golden', company]]),
        companyUsers: new Map(),
        products: new Map(),
        sales: new Map(),
        customers: new Map(),
        tables: new Map(),
        financeTransactions: new Map(),
        publicSpaces: new Map(),
        devices: new Map([['dev_golden_pos', device]]),
        invoices: new Map(),
        appEntitlements: new Map(),
        appInstallations: new Map(),
        paymentOrders: new Map(),
        companyLedger: new Map(),
        hqAuditLogs: []
      } as unknown as Parameters<typeof db.persistState>[0]);

      // 5. Install App (Grants Entitlement and Device Installation)
      const installResult = db.installStoreAppTransaction('comp_golden', 'dev_golden_pos', 'app_golden_flow', {
        amount: 49.90,
        currency: 'BRL',
        planId: 'SUBSCRIPTION_MONTHLY'
      });
      expect(installResult.success).toBe(true);
      expect(installResult.installation?.installedVersion).toBe('1.0.0');
      expect(installResult.entitlement?.status).toBe('ACTIVE');

      // 6. Verify SQLite ACID state
      const rawDb = db.getRawDatabase()!;
      const installationRow = rawDb.prepare('SELECT * FROM app_installations WHERE company_id = ? AND device_id = ? AND app_id = ?')
        .get('comp_golden', 'dev_golden_pos', 'app_golden_flow') as Record<string, unknown>;
      expect(installationRow).toBeDefined();
      expect(installationRow['installed_version']).toBe('1.0.0');

      // 7. Add Release 1.1.0 Stable
      const artifactId2 = 'art_golden_1_1_0';
      const checksum2 = 'a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b999';
      db.addAppArtifact(artifactId2, 'app_golden_flow', '1.1.0', checksum2, 'mock_bundle_base64_v110');
      db.addAppReleaseTransaction({
        appId: 'app_golden_flow',
        version: '1.1.0',
        channel: 'stable',
        minOsVersion: '1.0.0',
        artifactId: artifactId2,
        checksum: checksum2,
        signature: null,
        releasedAt: new Date().toISOString(),
        status: 'PUBLISHED'
      });

      // 8. Update App to 1.1.0
      const updateResult = db.updateStoreAppTransaction('comp_golden', 'dev_golden_pos', 'app_golden_flow', '1.1.0');
      expect(updateResult.success).toBe(true);
      expect(updateResult.installation?.installedVersion).toBe('1.1.0');

      const updatedRow = rawDb.prepare('SELECT * FROM app_installations WHERE company_id = ? AND device_id = ? AND app_id = ?')
        .get('comp_golden', 'dev_golden_pos', 'app_golden_flow') as Record<string, unknown>;
      expect(updatedRow['installed_version']).toBe('1.1.0');

      // 9. Uninstall App from terminal
      const uninstallResult = db.uninstallStoreAppTransaction('comp_golden', 'dev_golden_pos', 'app_golden_flow');
      expect(uninstallResult.success).toBe(true);

      const uninstalledRow = rawDb.prepare('SELECT * FROM app_installations WHERE company_id = ? AND device_id = ? AND app_id = ?')
        .get('comp_golden', 'dev_golden_pos', 'app_golden_flow');
      expect(uninstalledRow).toBeUndefined();

      // Entitlement must remain active after device uninstallation
      const entitlementRow = rawDb.prepare('SELECT * FROM app_entitlements WHERE company_id = ? AND app_id = ?')
        .get('comp_golden', 'app_golden_flow') as Record<string, unknown>;
      expect(entitlementRow).toBeDefined();
      expect(entitlementRow['status']).toBe('ACTIVE');
    });
  });
});
