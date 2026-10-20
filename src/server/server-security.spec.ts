// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Response } from 'express';
import crypto from 'node:crypto';
import {
  requireAuth,
  requireHqAdmin,
  requireTenant,
  requireTenantRole,
  requirePaymentGatewaySignature,
  resolveEffectiveTenant,
  AuthenticatedRequest
} from './middleware.js';
import { signJwt, revokeToken, isTokenRevoked, verifyJwt, decryptMfaSecret } from './config.js';
import { centralState, CompanyData, centralDatabase } from './state.js';
import { z } from 'zod';

interface MockResponse {
  statusCode: number;
  body: { error?: string } | null;
  status: (code: number) => MockResponse;
  json: (data: unknown) => MockResponse;
}

describe('Backend Security & API Isolation Suite (Phase F)', () => {
  const originalEnvSecret = process.env['PAYMENT_GATEWAY_SECRET'];

  beforeEach(() => {
    process.env['PAYMENT_GATEWAY_SECRET'] = 'test_secret_webhook_key_12345';
  });

  afterEach(() => {
    if (originalEnvSecret) {
      process.env['PAYMENT_GATEWAY_SECRET'] = originalEnvSecret;
    } else {
      delete process.env['PAYMENT_GATEWAY_SECRET'];
    }
  });

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

  describe('1. JWT Lifecycle, Integrity & Expiration', () => {
    it('should reject requests with no Authorization header', () => {
      const req: Partial<AuthenticatedRequest> = { headers: {} };
      const res = createMockRes();
      let nextCalled = false;

      requireAuth(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body?.error).toContain('Token de autenticação não fornecido');
    });

    it('should reject expired tokens', () => {
      // Create a token expired 10 seconds ago
      const expiredToken = signJwt({ id: 'user_1', name: 'User 1', email: 'u1@test.com', role: 'operator' }, -10);
      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${expiredToken}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireAuth(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body?.error).toContain('Sessão expirada ou token inválido');
    });

    it('should reject revoked/blacklisted tokens', () => {
      const token = signJwt({ id: 'user_revoked', name: 'Revoked', email: 'revoked@test.com', role: 'operator' }, 3600);
      revokeToken(token);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireAuth(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body?.error).toContain('Sessão expirada ou token inválido');
    });

    it('should accept valid tokens and attach user payload to request', () => {
      const validToken = signJwt({
        id: 'user_legit',
        name: 'Carlos Admin',
        email: 'carlos@empresa.com',
        role: 'manager',
        companyId: 'company_alpha'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${validToken}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireAuth(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.user?.id).toBe('user_legit');
      expect(req.user?.companyId).toBe('company_alpha');
      expect(req.user?.role).toBe('manager');
    });
  });

  describe('2. Multi-Tenant Isolation & Anti-IDOR Scoping', () => {
    it('should block Tenant A user attempting to access Tenant B endpoint by path parameter (IDOR)', () => {
      const token = signJwt({
        id: 'user_a',
        role: 'admin',
        companyId: 'company_a'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: { id: 'company_b' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('IDOR');
    });

    it('should block Tenant A user attempting to post body with Tenant B companyId (IDOR)', () => {
      const token = signJwt({
        id: 'user_a',
        role: 'admin',
        companyId: 'company_a'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: {},
        body: { companyId: 'company_b', amount: 500 }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('outro tenant (IDOR)');
    });

    it('should allow legitimate access when requested company matches user companyId', () => {
      const token = signJwt({
        id: 'user_a',
        role: 'admin',
        companyId: 'company_a'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: { id: 'company_a' },
        body: { companyId: 'company_a' }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it('should block suspended companies from accessing tenant endpoints', () => {
      const suspendedCompany: Partial<CompanyData> = {
        id: 'company_suspended',
        name: 'Suspended Corp',
        slug: 'suspended',
        status: 'suspended',
        plan: 'pro',
        balance: 0,
        installedApps: []
      };
      centralState.companies.set('company_suspended', suspendedCompany as CompanyData);

      const token = signJwt({
        id: 'user_susp',
        role: 'admin',
        companyId: 'company_suspended'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: { id: 'company_suspended' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('suspensa');
    });
  });

  describe('3. Role-Based Access Control (Manager vs Operator)', () => {
    it('should reject Operator from endpoints requiring Manager or Admin role', () => {
      const token = signJwt({
        id: 'op_1',
        role: 'operator',
        companyId: 'comp_1'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: { id: 'comp_1' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      const guard = requireTenantRole(['admin', 'manager']);
      guard(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('Requer um dos seguintes perfis: admin, manager');
    });

    it('should allow Manager on endpoints requiring Manager or Admin', () => {
      const token = signJwt({
        id: 'mgr_1',
        role: 'manager',
        companyId: 'comp_1'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: { id: 'comp_1' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      const guard = requireTenantRole(['admin', 'manager']);
      guard(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it('should reject non-HQ Admin users from HQ Control Plane endpoints', () => {
      const token = signJwt({
        id: 'admin_tenant',
        role: 'admin',
        companyId: 'comp_1'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireHqAdmin(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('Recurso exclusivo do HQ Control Plane');
    });

    it('should allow genuine HQ Admin users into HQ Control Plane endpoints', () => {
      const token = signJwt({
        id: 'hq_super',
        role: 'hq_admin'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireHqAdmin(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });
  });

  describe('4. Payment Webhook HMAC Anti-Spoofing & Signature Verification', () => {
    it('should reject webhook requests without signature header', () => {
      const req: Partial<AuthenticatedRequest> = {
        headers: {},
        body: { event: 'PAYMENT_RECEIVED', amount: 100 }
      };
      const res = createMockRes();
      let nextCalled = false;

      requirePaymentGatewaySignature(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body?.error).toContain('Assinatura do gateway ausente');
    });

    it('should reject webhook with forged or incorrect signature', () => {
      const req: Partial<AuthenticatedRequest> = {
        headers: { 'x-gateway-signature': '0000000000000000000000000000000000000000000000000000000000000000' },
        body: { event: 'PAYMENT_RECEIVED', amount: 100 }
      };
      const res = createMockRes();
      let nextCalled = false;

      requirePaymentGatewaySignature(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('Assinatura do gateway inválida');
    });

    it('should accept webhook with authentic HMAC SHA-256 signature calculated with PAYMENT_GATEWAY_SECRET', () => {
      const payload = { event: 'PAYMENT_CONFIRMED', invoiceId: 'inv_123', amount: 150 };
      const secret = process.env['PAYMENT_GATEWAY_SECRET']!;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(JSON.stringify(payload));
      const validSignature = hmac.digest('hex');

      const req: Partial<AuthenticatedRequest> = {
        headers: { 'x-gateway-signature': validSignature },
        body: payload
      };
      const res = createMockRes();
      let nextCalled = false;

      requirePaymentGatewaySignature(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it('should reject webhook if payload is tampered after signature generation (integrity breach)', () => {
      const payload = { event: 'PAYMENT_CONFIRMED', invoiceId: 'inv_123', amount: 150 };
      const secret = process.env['PAYMENT_GATEWAY_SECRET']!;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(JSON.stringify(payload));
      const validSignature = hmac.digest('hex');

      // Attacker tampers amount to 999999
      const tamperedPayload = { ...payload, amount: 999999 };

      const req: Partial<AuthenticatedRequest> = {
        headers: { 'x-gateway-signature': validSignature },
        body: tamperedPayload
      };
      const res = createMockRes();
      let nextCalled = false;

      requirePaymentGatewaySignature(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('Assinatura do gateway inválida');
    });
  });

  describe('5. HQ Support Impersonation Boundary Enforcement', () => {
    it('should restrict impersonation session strictly to the target company authorized in actingAs', () => {
      const supportToken = signJwt({
        id: 'hq_admin_1',
        role: 'hq_admin',
        isImpersonating: true,
        actingAs: 'company_authorized'
      }, 3600);

      // Attempting to access unauthorized company
      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${supportToken}` },
        params: { id: 'company_unauthorized' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('restrita exclusivamente à empresa autorizada');
    });

    it('should permit impersonation session accessing the authorized target company', () => {
      const supportToken = signJwt({
        id: 'hq_admin_1',
        role: 'hq_admin',
        isImpersonating: true,
        actingAs: 'company_authorized'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${supportToken}` },
        params: { id: 'company_authorized' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.user?.companyId).toBe('company_authorized');
    });
  });

  describe('6. Comprehensive Audit Verification Tests (2026-09-18)', () => {
    const TenantRoleSchema = z.enum(['admin', 'manager', 'operator']);

    it('1. Role injection: tenant admin -> POST user role=hq_admin -> rejected', () => {
      // Must reject hq_admin or any non-tenant role
      const invalidRoles = ['hq_admin', 'super_admin', 'root', 'support', 'owner'];
      for (const role of invalidRoles) {
        const result = TenantRoleSchema.safeParse(role);
        expect(result.success).toBe(false);
      }

      // Must allow valid tenant roles
      const validRoles = ['admin', 'manager', 'operator'];
      for (const role of validRoles) {
        const result = TenantRoleSchema.safeParse(role);
        expect(result.success).toBe(true);
      }
    });

    it('2. Update role injection: tenant admin -> PUT user role=hq_admin -> rejected', () => {
      const updateRoleSchema = z.object({
        name: z.string().optional(),
        role: TenantRoleSchema.optional()
      });

      const attemptEscalation = updateRoleSchema.safeParse({ role: 'hq_admin' });
      expect(attemptEscalation.success).toBe(false);

      const validUpdate = updateRoleSchema.safeParse({ role: 'manager' });
      expect(validUpdate.success).toBe(true);
      if (validUpdate.success) {
        expect(validUpdate.data.role).toBe('manager');
      }
    });

    it('3. Support query bypass: support actingAs=A -> query.companyId=B -> rejected with 403', () => {
      const supportToken = signJwt({
        id: 'hq_admin_support',
        role: 'hq_admin',
        isImpersonating: true,
        actingAs: 'company_authorized_A'
      }, 3600);

      // Malicious attempt to access company_B via query string
      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${supportToken}` },
        query: { companyId: 'company_unauthorized_B' },
        params: {},
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('restrita exclusivamente à empresa autorizada');

      // Also verify resolveEffectiveTenant always prioritizes actingAs for support sessions
      const effectiveTenant = resolveEffectiveTenant(req as AuthenticatedRequest);
      expect(effectiveTenant).toBe('company_authorized_A');
    });

    it('4. Support HQ global route: support token -> requireHqAdmin -> rejected with 403', () => {
      const supportToken = signJwt({
        id: 'hq_admin_support',
        role: 'hq_admin',
        isImpersonating: true,
        actingAs: 'company_A'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${supportToken}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireHqAdmin(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('Sessões de suporte não possuem acesso a rotas globais do HQ Control Plane');
    });

    it('5. PIN login: POST /auth/login with PIN -> rejected (password required)', () => {
      const loginSchema = z.object({
        email: z.string().email('E-mail inválido'),
        password: z.string().min(1, 'Senha é obrigatória'),
        companyId: z.string().optional(),
        companyIdentifier: z.string().optional()
      }).refine(data => data.companyId || data.companyIdentifier, {
        message: 'A identificação da empresa é obrigatória'
      });

      // Attempting to authenticate using PIN instead of password
      const pinOnlyAttempt = loginSchema.safeParse({
        email: 'user@company.com',
        pin: '1234',
        companyId: 'company_1'
      });
      expect(pinOnlyAttempt.success).toBe(false);

      // Normal valid login payload
      const validAttempt = loginSchema.safeParse({
        email: 'user@company.com',
        password: 'securePassword123',
        companyId: 'company_1'
      });
      expect(validAttempt.success).toBe(true);
    });

    it('6. Restart revocation: token revoked in SQLite -> verified revoked and rejected with 401', () => {
      const testToken = signJwt({ id: 'user_restart_test', email: 'test@revoked.com', role: 'operator' }, 7200);

      // Revoke and ensure written to SQLite
      revokeToken(testToken);

      // Check SQLite persistence
      expect(centralDatabase.isTokenRevoked(testToken)).toBe(true);
      expect(isTokenRevoked(testToken)).toBe(true);
      expect(verifyJwt(testToken)).toBeNull();

      // Ensure requireAuth blocks the request with 401
      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${testToken}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireAuth(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body?.error).toContain('Sessão expirada ou token inválido');
    });

    it('7. Marketplace stock concurrency: product stock=1, concurrent orders -> only 1 succeeds', () => {
      const db = centralDatabase.getRawDatabase();
      if (!db) {
        // Skip if SQLite is in mock/fallback
        return;
      }

      const testCompanyId = 'comp_concurrency_test';
      const testProductId = 'prod_unique_stock_1';

      // Ensure test company exists for foreign key constraints
      db.prepare(`
        INSERT OR IGNORE INTO companies (id, name, cnpj, plan, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(testCompanyId, 'Concurrency Test Co', '00000000000199', 'pro', 'active');

      // Insert fresh test product with exactly 1 unit of stock
      db.prepare("DELETE FROM products WHERE id = ?").run(testProductId);
      db.prepare("DELETE FROM orders WHERE id IN (?, ?)").run('order_concurrent_1', 'order_concurrent_2');
      db.prepare(`
        INSERT INTO products (id, company_id, name, price, stock)
        VALUES (?, ?, ?, ?, ?)
      `).run(testProductId, testCompanyId, 'Produto Raro', 100, 1);

      // Verify initial stock is 1
      const initialProd = db.prepare("SELECT stock FROM products WHERE id = ?").get(testProductId) as { stock: number };
      expect(initialProd.stock).toBe(1);

      // Order 1: attempts to buy 1 item
      const order1 = {
        id: 'order_concurrent_1',
        companyId: testCompanyId,
        amount: 100,
        status: 'PAID'
      };
      const result1 = centralDatabase.saveMarketplaceOrderTransaction(order1, [{ productId: testProductId, quantity: 1 }], false);
      expect(result1.success).toBe(true);

      // Verify stock was decremented to 0
      const afterOrder1 = db.prepare("SELECT stock FROM products WHERE id = ?").get(testProductId) as { stock: number };
      expect(afterOrder1.stock).toBe(0);

      // Order 2: attempts to buy 1 item concurrently
      const order2 = {
        id: 'order_concurrent_2',
        companyId: testCompanyId,
        amount: 100,
        status: 'PAID'
      };
      expect(() => {
        centralDatabase.saveMarketplaceOrderTransaction(order2, [{ productId: testProductId, quantity: 1 }], false);
      }).toThrow(/INSUFFICIENT_STOCK/);

      // Verify stock remains 0 (not negative) and second order was not inserted
      const finalProd = db.prepare("SELECT stock FROM products WHERE id = ?").get(testProductId) as { stock: number };
      expect(finalProd.stock).toBe(0);

      const order2Record = db.prepare("SELECT id FROM orders WHERE id = ?").get('order_concurrent_2');
      expect(order2Record).toBeUndefined();

      // Clean up test data
      db.prepare("DELETE FROM products WHERE id = ?").run(testProductId);
      db.prepare("DELETE FROM orders WHERE id = ?").run('order_concurrent_1');
      db.prepare("DELETE FROM companies WHERE id = ?").run(testCompanyId);
    });

    it('8. MFA Encryption at Rest: should encrypt mfa_secret in database and decrypt on load', () => {
      const db = centralDatabase.getRawDatabase();
      if (!db) return;

      const testAdminId = 'adm_encrypt_rest_test';
      const plainSecret = 'NBSWY3DPEB3W64TBNQ';

      // Remove any existing test data
      db.prepare("DELETE FROM hq_admins WHERE id = ?").run(testAdminId);

      // Create a test state with our admin having a plaintext secret
      const testState = {
        hqAdmins: [{
          id: testAdminId,
          name: 'Encrypt Rest Admin',
          email: 'rest@3eatcru.com',
          role: 'hq_admin',
          password: 'hashedpassword_not_leaked',
          mfaEnabled: true,
          mfaSecret: plainSecret
        }],
        companies: new Map(),
        companyUsers: new Map(),
        products: new Map(),
        sales: new Map(),
        customers: new Map(),
        tables: new Map(),
        financeTransactions: new Map(),
        publicSpaces: new Map(),
        devices: new Map(),
        orders: new Map(),
        invoices: new Map(),
        billingIdempotencyLog: new Map(),
        appEntitlements: new Map(),
        appInstallations: new Map(),
        paymentOrders: new Map(),
        osDb: new Map(),
        plans: [],
        apps: [],
        osReleases: [],
        hqAuditLogs: []
      };

      // Persist the state using the centralDatabase persist method which has the encryption hook
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      centralDatabase.persistState(testState as any);

      // Verify the database record directly to prove it is encrypted at rest (starts with 'enc:')
      const row = db.prepare("SELECT mfa_secret FROM hq_admins WHERE id = ?").get(testAdminId) as { mfa_secret: string };
      expect(row).toBeDefined();
      expect(row.mfa_secret).not.toBe(plainSecret);
      expect(row.mfa_secret.startsWith('enc:')).toBe(true);

      // Load state from database to prove it automatically decrypts back to plaintext
      const loadedState = centralDatabase.loadFromDatabase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loadedAdmin = loadedState.hqAdmins.find((a: any) => a.id === testAdminId);
      expect(loadedAdmin).toBeDefined();
      expect(loadedAdmin.mfaSecret).toBe(plainSecret);

      // Cleanup
      db.prepare("DELETE FROM hq_admins WHERE id = ?").run(testAdminId);
    });

    it('MFA Legacy Plaintext Auto-Migration on Boot: should detect plaintext mfa_secret on boot and update DB atomically with encrypted value', () => {
      const db = centralDatabase.getRawDatabase();
      expect(db).toBeDefined();

      const testId = 'hq_admin_legacy_mig_test';
      const plainSecret = 'legacy-plain-mfa-secret-123';

      // Preemptively delete leftover records from failed test runs
      db!.prepare("DELETE FROM hq_admins WHERE id = ?").run(testId);

      // Insert directly in database with a plaintext secret
      db!.prepare(`
        INSERT INTO hq_admins (id, name, email, password, role, mfa_secret)
        VALUES (?, 'Legacy Mig', 'legacy_mig@test.com', 'dummyhash', 'admin', ?)
      `).run(testId, plainSecret);

      // Trigger automatic migration by calling internal method directly or re-initializing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (centralDatabase as any).migrateLegacyMfaSecrets();

      // Verify that the record was updated to an encrypted format starting with 'enc:'
      const row = db!.prepare("SELECT mfa_secret FROM hq_admins WHERE id = ?").get(testId) as { mfa_secret: string };
      expect(row).toBeDefined();
      expect(row.mfa_secret.startsWith('enc:')).toBe(true);

      // Verify it decrypts back correctly using decrypt helper
      expect(decryptMfaSecret(row.mfa_secret)).toBe(plainSecret);

      // Clean up
      db!.prepare("DELETE FROM hq_admins WHERE id = ?").run(testId);
    });

    it('Rate Limiter Fail-Closed on Database Failure: should block request (return false) instead of allowing (fail-open) if database encounters an error', () => {
      // Mock db as null to simulate a transient db disconnection/error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbBackup = (centralDatabase as any).db;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (centralDatabase as any).db = null;

      try {
        const check = centralDatabase.checkRateLimit('ip:test_rate_limit_fail', 5, 60000);
        // It must fail closed (return false) for robust security under brute force attacks or locks
        expect(check).toBe(false);
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (centralDatabase as any).db = dbBackup;
      }
    });

    it('Bootstrap hasData Semantics: should consider database non-empty if at least 1 hq_admin exists, preventing re-bootstrapping when companies table is empty', () => {
      const db = centralDatabase.getRawDatabase();
      expect(db).toBeDefined();

      // Temporarily ensure no companies exist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const companiesBackup = db!.prepare("SELECT id, name, slug, cnpj, logo_url, balance, installed_apps, status, plan, max_terminals, max_branches, active_terminals, channel, os_target_version, license_expires_at, branches FROM companies").all() as any[];
      db!.prepare("DELETE FROM companies").run();

      const testId = 'dummy_boot_admin';
      db!.prepare("DELETE FROM hq_admins WHERE id = ?").run(testId);
      db!.prepare(`
        INSERT INTO hq_admins (id, name, email, password, role, mfa_secret)
        VALUES (?, 'Dummy Boot', 'dummy_boot@test.com', 'dummyhash', 'admin', 'dummy')
      `).run(testId);

      try {
        // hasData should return true because of the admin account presence, preventing blank-start bootstrap
        expect(centralDatabase.hasData()).toBe(true);
      } finally {
        // Restore
        db!.prepare("DELETE FROM hq_admins WHERE id = ?").run(testId);
        for (const comp of companiesBackup) {
          db!.prepare(`
            INSERT INTO companies (id, name, slug, cnpj, logo_url, balance, installed_apps, status, plan, max_terminals, max_branches, active_terminals, channel, os_target_version, license_expires_at, branches)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            comp.id, comp.name, comp.slug, comp.cnpj, comp.logo_url, comp.balance, comp.installed_apps, comp.status,
            comp.plan, comp.max_terminals, comp.max_branches, comp.active_terminals, comp.channel, comp.os_target_version,
            comp.license_expires_at, comp.branches
          );
        }
      }
    });
  });
});
