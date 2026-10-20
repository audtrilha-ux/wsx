import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { IdentityService } from '../identity/identity.service';
import { ISession } from '../../contracts/auth/auth.contract';

describe('Security & Multi-Tenant Isolation Suite', () => {
  let identityService: IdentityService;
  let httpMock: HttpTestingController;

  const tenantA: ISession = {
    token: 'jwt_tenant_a_token',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    identity: {
      id: 'usr_tenant_a',
      username: 'manager_a',
      displayName: 'Manager Alpha',
      email: 'alpha@enterprise.com',
      role: 'manager'
    },
    tenant: {
      tenantId: 'company_alpha_123',
      tenantName: 'Alpha Corp',
      plan: 'pro',
      status: 'active',
      balance: 1000,
      branchId: 'branch_matriz_a',
      branchName: 'Matriz Alpha'
    }
  };

  const tenantB: ISession = {
    token: 'jwt_tenant_b_token',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    identity: {
      id: 'usr_tenant_b',
      username: 'manager_b',
      displayName: 'Manager Beta',
      email: 'beta@enterprise.com',
      role: 'manager'
    },
    tenant: {
      tenantId: 'company_beta_456',
      tenantName: 'Beta LTDA',
      plan: 'starter',
      status: 'active',
      balance: 50,
      branchId: 'branch_matriz_b',
      branchName: 'Matriz Beta'
    }
  };

  const hqAdminSession: ISession = {
    token: 'jwt_hq_superadmin_token',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    identity: {
      id: 'hq_admin_007',
      username: 'hqsuperadmin',
      displayName: 'HQ Global Administrator',
      email: 'admin@3eatcru.com.br',
      role: 'hq_admin'
    }
  };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [IdentityService]
    });
    identityService = TestBed.inject(IdentityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  const createService = () => TestBed.runInInjectionContext(() => new IdentityService());

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  describe('1. Dual-OS Authority & Token Segregation', () => {
    it('should isolate Client OS token from HQ OS token in storage', () => {
      sessionStorage.setItem('3eatcru_client_session_v1', JSON.stringify(tenantA));
      sessionStorage.setItem('3eatcru_hq_session_v1', JSON.stringify(hqAdminSession));

      const reloadedService = createService();
      expect(reloadedService.getClientToken()).toBe('jwt_tenant_a_token');
      expect(reloadedService.getHqToken()).toBe('jwt_hq_superadmin_token');
      expect(reloadedService.currentTenant()?.tenantId).toBe('company_alpha_123');
      expect(reloadedService.isHqAuthenticated()).toBe(true);
    });

    it('should clear only client session on client logout while retaining HQ session', () => {
      sessionStorage.setItem('3eatcru_client_session_v1', JSON.stringify(tenantA));
      sessionStorage.setItem('3eatcru_hq_session_v1', JSON.stringify(hqAdminSession));

      const service = createService();
      service.logout();

      const logoutReq = httpMock.expectOne('/api/v1/auth/logout');
      expect(logoutReq.request.method).toBe('POST');
      logoutReq.flush({ success: true });

      expect(service.getClientToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.getHqToken()).toBe('jwt_hq_superadmin_token');
      expect(service.isHqAuthenticated()).toBe(true);
    });
  });

  describe('2. Tenant Boundary & Anti-IDOR Scoping', () => {
    it('should not allow Tenant A to access Tenant B context in client session state', () => {
      sessionStorage.setItem('3eatcru_client_session_v1', JSON.stringify(tenantA));
      const service = createService();

      expect(service.currentTenant()?.tenantId).toBe('company_alpha_123');
      expect(service.currentTenant()?.tenantId).not.toBe(tenantB.tenant?.tenantId);
    });

    it('should isolate branch context within the tenant boundary', () => {
      sessionStorage.setItem('3eatcru_client_session_v1', JSON.stringify(tenantA));
      const service = createService();

      expect(service.currentTenant()?.branchId).toBe('branch_matriz_a');
      expect(service.currentTenant()?.branchName).toBe('Matriz Alpha');
    });
  });

  describe('3. HQ Support Impersonation Safety & Auditability', () => {
    it('should reject impersonation attempt when caller is not HQ authenticated', async () => {
      expect(identityService.isHqAuthenticated()).toBe(false);

      let threw = false;
      try {
        await identityService.impersonateTenant({ id: 'company_alpha_123', name: 'Alpha Corp' });
      } catch (err: unknown) {
        threw = true;
        expect((err as Error).message).toContain('Apenas Administradores do HQ OS');
      }
      expect(threw).toBe(true);
    });

    it('should allow HQ admin to start support impersonation session and switch client context safely', async () => {
      sessionStorage.setItem('3eatcru_hq_session_v1', JSON.stringify(hqAdminSession));
      const service = createService();

      const impersonatePromise = service.impersonateTenant(
        { id: 'company_alpha_123', name: 'Alpha Corp' },
        'Investigação de chamado #9021'
      );

      const req = httpMock.expectOne('/api/v1/auth/impersonate');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        companyId: 'company_alpha_123',
        reason: 'Investigação de chamado #9021'
      });
      expect(req.request.headers.get('Authorization')).toBe('Bearer jwt_hq_superadmin_token');

      req.flush({
        success: true,
        token: 'jwt_support_scoped_token',
        expiresAt: new Date(Date.now() + 28800000).toISOString(),
        session: {
          identity: {
            id: 'support_hq_admin_007',
            username: 'hqsuperadmin',
            displayName: 'Suporte HQ (Global Administrator)',
            email: 'admin@3eatcru.com.br',
            role: 'hq_admin'
          },
          tenant: {
            tenantId: 'company_alpha_123',
            tenantName: 'Alpha Corp',
            plan: 'pro',
            status: 'active',
            balance: 1000
          }
        }
      });

      await impersonatePromise;

      expect(service.isSupportImpersonating()).toBe(true);
      expect(service.impersonatedCompany()?.id).toBe('company_alpha_123');
      expect(service.currentTenant()?.tenantId).toBe('company_alpha_123');
      expect(service.getClientToken()).toBe('jwt_support_scoped_token');
    });

    it('should clean up support state and notify server on exitSupportImpersonation', () => {
      sessionStorage.setItem('3eatcru_hq_session_v1', JSON.stringify(hqAdminSession));
      sessionStorage.setItem('3eatcru_client_session_v1', JSON.stringify({
        token: 'jwt_support_scoped_token',
        expiresAt: new Date(Date.now() + 28800000).toISOString(),
        identity: {
          id: 'support_hq_admin_007',
          username: 'hqsuperadmin',
          displayName: 'Suporte HQ',
          email: 'admin@3eatcru.com.br',
          role: 'hq_admin'
        },
        tenant: {
          tenantId: 'company_alpha_123',
          tenantName: 'Alpha Corp',
          plan: 'pro',
          status: 'active',
          balance: 1000
        }
      }));
      const service = createService();

      service.exitSupportImpersonation();

      const req = httpMock.expectOne('/api/v1/auth/impersonate/exit');
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe('Bearer jwt_support_scoped_token');
      req.flush({ success: true, message: 'Sessão encerrada' });

      const logoutReq = httpMock.expectOne('/api/v1/auth/logout');
      logoutReq.flush({ success: true });

      expect(service.isSupportImpersonating()).toBe(false);
      expect(service.impersonatedCompany()).toBeNull();
      expect(service.getClientToken()).toBeNull();
    });
  });
});
