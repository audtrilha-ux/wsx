import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { 
  ISession, 
  IIdentity, 
  ITenantContext, 
  LoginCredentials, 
  LoginResponse,
  HqLoginCredentials,
  HqLoginResponse
} from '../../contracts/auth/auth.contract';

const CLIENT_SESSION_STORAGE_KEY = '3eatcru_client_session_v1';
const HQ_SESSION_STORAGE_KEY = '3eatcru_hq_session_v1';

@Injectable({
  providedIn: 'root'
})
export class IdentityService {
  private http = inject(HttpClient);

  // Client OS Active Session
  private readonly _clientSession = signal<ISession | null>(this.loadStoredSession(CLIENT_SESSION_STORAGE_KEY));
  readonly clientSession = this._clientSession.asReadonly();
  readonly currentIdentity = computed(() => this._clientSession()?.identity || null);
  readonly currentTenant = computed(() => this._clientSession()?.tenant || null);
  readonly isAuthenticated = computed(() => !!this._clientSession()?.token);

  // HQ OS Active Session (Separate Control Plane Authority)
  private readonly _hqSession = signal<ISession | null>(this.loadStoredSession(HQ_SESSION_STORAGE_KEY));
  readonly hqSession = this._hqSession.asReadonly();
  readonly isHqAuthenticated = computed(() => this._hqSession()?.identity.role === 'hq_admin');

  // HQ Support Impersonation (Magic Link)
  readonly isSupportImpersonating = signal<boolean>(false);
  readonly impersonatedCompany = signal<{ id: string; name: string } | null>(null);

  /**
   * HQ Support Magic Link Impersonation
   */
  async impersonateTenant(company: { id: string; name: string }, reason?: string): Promise<void> {
    const hqToken = this.getHqToken();
    if (!hqToken) {
      throw new Error('Apenas Administradores do HQ OS podem iniciar modo de suporte.');
    }

    try {
      const resp = await firstValueFrom(
        this.http.post<{ success: boolean; token: string; expiresAt: string; session: ISession }>(
          '/api/v1/auth/impersonate',
          { companyId: company.id, reason },
          { headers: { Authorization: `Bearer ${hqToken}` } }
        )
      );

      if (resp && resp.session && resp.token) {
        this.isSupportImpersonating.set(true);
        this.impersonatedCompany.set({ id: company.id, name: company.name });
        this.setClientSession({
          ...resp.session,
          token: resp.token
        });
        return;
      }
      throw new Error('Servidor HQ não retornou uma sessão de suporte válida.');
    } catch (err: unknown) {
      console.error('Falha ao iniciar sessão de suporte impersonada:', err);
      throw new Error('Não foi possível iniciar a sessão de suporte para este tenant. Verifique a conectividade e suas permissões de HQ Admin.');
    }
  }

  /**
   * Exit HQ Support Mode and return to HQ Control Plane
   */
  exitSupportImpersonation(): void {
    const token = this.getClientToken();
    if (token) {
      this.http.post('/api/v1/auth/impersonate/exit', {}, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({
        error: (err: unknown) => {
          console.debug('[IdentityService] Exit impersonation notify error:', err);
        }
      });
    }

    this.isSupportImpersonating.set(false);
    this.impersonatedCompany.set(null);
    this.logout();
  }
  /**
   * Resolve company public metadata by identifier (ID, slug or CNPJ)
   */
  async resolveCompany(identifier: string): Promise<{
    id: string;
    name: string;
    slug: string;
    status: string;
    plan: string;
    logoUrl?: string;
    branches: { id: string; name: string; address: string; isMain?: boolean }[];
  }> {
    const res = await firstValueFrom(
      this.http.get<{
        success: boolean;
        company: {
          id: string;
          name: string;
          slug: string;
          status: string;
          plan: string;
          logoUrl?: string;
          branches: { id: string; name: string; address: string; isMain?: boolean }[];
        };
      }>(`/api/v1/auth/resolve-company?identifier=${encodeURIComponent(identifier)}`)
    );
    if (res && res.success && res.company) {
      return res.company;
    }
    throw new Error('Empresa não encontrada no sistema central 3eatcru.');
  }

  /**
   * Request password recovery (neutral security protocol)
   */
  async requestPasswordRecovery(email: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ success: boolean; message: string }>('/api/v1/auth/recovery', { email })
    );
    return res?.message || 'Solicitação de recuperação processada com sucesso.';
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>('/api/v1/auth/login', credentials)
    );

    if (response && response.success && response.token) {
      const session: ISession = {
        token: response.token,
        expiresAt: response.expiresAt,
        identity: response.user,
        tenant: response.tenant
      };
      this.setClientSession(session);
      return response;
    }

    throw new Error('Falha na autenticação');
  }

  /**
   * Real HQ OS (Control Plane) Authentication
   */
  async hqLogin(credentials: HqLoginCredentials): Promise<HqLoginResponse> {
    const response = await firstValueFrom(
      this.http.post<HqLoginResponse>('/api/v1/auth/hq-login', credentials)
    );

    if (response && response.success && response.token) {
      const session: ISession = {
        token: response.token,
        expiresAt: response.expiresAt,
        identity: response.user
      };
      this.setHqSession(session);
      return response;
    }

    throw new Error('Credenciais de HQ Admin inválidas');
  }

  /**
   * Verify and refresh session with Central
   */
  async verifySession(): Promise<boolean> {
    const token = this.getClientToken();
    if (!token) return false;

    try {
      const res = await firstValueFrom(
        this.http.get<{ valid: boolean; user: IIdentity; tenant: ITenantContext }>('/api/v1/auth/client/me')
      );
      if (res && res.valid) {
        const current = this._clientSession();
        if (current) {
          this.setClientSession({
            ...current,
            identity: res.user,
            tenant: res.tenant
          });
        }
        return true;
      }
    } catch {
      this.logout();
    }
    return false;
  }

  async verifyHqSession(): Promise<boolean> {
    const token = this.getHqToken();
    if (!token) return false;

    try {
      const res = await firstValueFrom(
        this.http.get<{ valid: boolean; user: IIdentity }>('/api/v1/auth/hq/me')
      );
      if (res && res.valid) {
        const current = this._hqSession();
        if (current) {
          this.setHqSession({
            ...current,
            identity: res.user
          });
        }
        return true;
      }
    } catch {
      this.hqLogout();
    }
    return false;
  }

  logout(): void {
    const token = this.getClientToken();
    if (token) {
      this.http.post('/api/v1/auth/logout', {}).subscribe({
        error: (err: unknown) => console.debug('Server logout notify failed:', err)
      });
    }
    this._clientSession.set(null);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CLIENT_SESSION_STORAGE_KEY);
    }
  }

  hqLogout(): void {
    const token = this.getHqToken();
    if (token) {
      this.http.post('/api/v1/auth/logout', {}).subscribe({
        error: (err: unknown) => console.debug('Server HQ logout notify failed:', err)
      });
    }
    this._hqSession.set(null);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(HQ_SESSION_STORAGE_KEY);
    }
  }

  getClientToken(): string | null {
    return this._clientSession()?.token || null;
  }

  getHqToken(): string | null {
    return this._hqSession()?.token || null;
  }

  private setClientSession(session: ISession): void {
    this._clientSession.set(session);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(CLIENT_SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  }

  private setHqSession(session: ISession): void {
    this._hqSession.set(session);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(HQ_SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  }

  private loadStoredSession(storageKey: string): ISession | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      // Robust runtime structural validation to prevent schema pollution
      if (!parsed || typeof parsed !== 'object') return null;
      if (typeof parsed.token !== 'string' || !parsed.token) return null;
      if (!parsed.expiresAt) return null;
      if (!parsed.identity || typeof parsed.identity !== 'object') return null;
      if (typeof parsed.identity.id !== 'string' || typeof parsed.identity.role !== 'string') return null;

      // Validate expiration
      if (new Date(parsed.expiresAt).getTime() < Date.now()) {
        sessionStorage.removeItem(storageKey);
        return null;
      }
      return parsed as ISession;
    } catch {
      return null;
    }
  }
}
