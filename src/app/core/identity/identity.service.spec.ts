import { TestBed } from '@angular/core/testing';
import { IdentityService } from './identity.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ISession } from '../../contracts/auth/auth.contract';

describe('IdentityService', () => {
  let service: IdentityService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [IdentityService]
    });
    service = TestBed.inject(IdentityService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should be created and start without active sessions', () => {
    expect(service).toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isHqAuthenticated()).toBe(false);
  });

  it('should maintain strict separation between Client and HQ tokens', () => {
    const clientSession: ISession = {
      token: 'jwt_client_token_123',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      identity: {
        id: 'usr_1',
        username: 'operator',
        displayName: 'Operador',
        email: 'operator@3eatcru.com',
        role: 'manager'
      },
      tenant: {
        tenantId: 'comp_1',
        tenantName: 'Empresa Teste',
        plan: 'pro',
        status: 'active',
        balance: 500
      }
    };
    sessionStorage.setItem('3eatcru_client_session_v1', JSON.stringify(clientSession));

    const hqSession: ISession = {
      token: 'jwt_hq_token_456',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      identity: {
        id: 'hq_admin_1',
        username: 'hqadmin',
        displayName: 'HQ Superadmin',
        email: 'admin@3eatcru.com',
        role: 'hq_admin'
      }
    };
    sessionStorage.setItem('3eatcru_hq_session_v1', JSON.stringify(hqSession));

    // Reset module to re-instantiate service and pick up stored sessions
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [IdentityService]
    });
    service = TestBed.inject(IdentityService);

    expect(service.getClientToken()).toBe('jwt_client_token_123');
    expect(service.getHqToken()).toBe('jwt_hq_token_456');

    // Logout client should not clear HQ session
    service.logout();
    expect(service.getClientToken()).toBeNull();
    expect(service.getHqToken()).toBe('jwt_hq_token_456');

    // Logout HQ
    service.hqLogout();
    expect(service.getHqToken()).toBeNull();
  });

  it('should handle support impersonation lifecycle correctly', async () => {
    // Setup HQ session
    const hqSession: ISession = {
      token: 'jwt_hq_token_456',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      identity: {
        id: 'hq_admin_1',
        username: 'hqadmin',
        displayName: 'HQ Superadmin',
        email: 'admin@3eatcru.com',
        role: 'hq_admin'
      }
    };
    sessionStorage.setItem('3eatcru_hq_session_v1', JSON.stringify(hqSession));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [IdentityService]
    });
    service = TestBed.inject(IdentityService);

    expect(service.isSupportImpersonating()).toBe(false);
    expect(service.impersonatedCompany()).toBeNull();

    // Impersonation request
    const impersonatePromise = service.impersonateTenant({ id: 'comp_target', name: 'Target Tenant' }, 'Suporte Emergencial');

    const httpMock = TestBed.inject(HttpTestingController);
    const req = httpMock.expectOne('/api/v1/auth/impersonate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ companyId: 'comp_target', reason: 'Suporte Emergencial' });
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt_hq_token_456');

    req.flush({
      success: true,
      token: 'jwt_impersonated_token',
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
      session: {
        token: 'jwt_impersonated_token',
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
        identity: {
          id: 'impersonated_usr',
          username: 'support_admin',
          displayName: 'HQ Support (Impersonated)',
          email: 'support@3eatcru.com',
          role: 'admin'
        },
        tenant: {
          tenantId: 'comp_target',
          tenantName: 'Target Tenant',
          plan: 'enterprise',
          status: 'active'
        }
      }
    });

    await impersonatePromise;

    expect(service.isSupportImpersonating()).toBe(true);
    expect(service.impersonatedCompany()).toEqual({ id: 'comp_target', name: 'Target Tenant' });
    expect(service.getClientToken()).toBe('jwt_impersonated_token');
    expect(service.currentTenant()?.tenantId).toBe('comp_target');

    // Exit impersonation
    service.exitSupportImpersonation();
    const exitReq = httpMock.expectOne('/api/v1/auth/impersonate/exit');
    expect(exitReq.request.method).toBe('POST');
    exitReq.flush({ success: true });

    expect(service.isSupportImpersonating()).toBe(false);
    expect(service.impersonatedCompany()).toBeNull();
    expect(service.getClientToken()).toBeNull();
  });
});

