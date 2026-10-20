import { Injectable, inject, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IdentityService } from '../identity/identity.service';
import { OsDatabaseService } from '../storage/os-database.service';

export interface OperatorContext {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'operator';
  email: string;
}

export interface OperatorUser {
  id: string;
  name: string;
  email: string;
  pin: string;
  role: 'admin' | 'manager' | 'operator';
  status: 'active' | 'suspended';
}

interface CachedCredential {
  hash: string;
  operator: OperatorContext;
  cachedAt: string;
  expiresAt: string;
}

async function computeCredentialHash(companyId: string, userId: string, pin: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`3eatcru:${companyId}:${userId}:${pin}:offline_salt_v1`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback if crypto.subtle is unavailable
  const raw = `3eatcru:${companyId}:${userId}:${pin}`;
  return typeof btoa !== 'undefined' ? btoa(encodeURIComponent(raw)) : raw;
}

@Injectable({
  providedIn: 'root'
})
export class OperatorLockService {
  private http = inject(HttpClient);
  private identityService = inject(IdentityService);
  private osDb = inject(OsDatabaseService);

  // Lock State Signals
  private readonly _isLocked = signal<boolean>(true);
  readonly isLocked = this._isLocked.asReadonly();

  private readonly _activeOperator = signal<OperatorContext | null>(null);
  readonly activeOperator = this._activeOperator.asReadonly();

  private readonly _operators = signal<OperatorUser[]>([]);
  readonly operators = this._operators.asReadonly();

  constructor() {
    // React to main session change: load operators and auto-lock
    effect(() => {
      const session = this.identityService.clientSession();
      if (session?.tenant?.tenantId) {
        this.fetchOperators(session.tenant.tenantId);
        this._isLocked.set(true); // Default to locked on login
        this._activeOperator.set(null);
      } else {
        this._operators.set([]);
        this._isLocked.set(true);
        this._activeOperator.set(null);
      }
    });
  }

  async fetchOperators(companyId: string): Promise<void> {
    const authDb = this.osDb.getNamespace(`tenant.${companyId}.system.auth_cache`);

    try {
      // Fetch list of operators/users from backend
      const users = await firstValueFrom(
        this.http.get<OperatorUser[]>(`/api/v1/companies/${companyId}/users`)
      );
      this._operators.set(users || []);

      // Cache operator list for offline usage
      if (users && users.length > 0) {
        await authDb.put('operators_list', users);
      }
    } catch (e) {
      console.warn('Failed to fetch operators online. Attempting offline cache:', e);

      // Try reading cached operator list
      try {
        const cached = await authDb.get<OperatorUser[]>('operators_list');
        if (cached && cached.length > 0) {
          this._operators.set(cached);
          return;
        }
      } catch (cacheErr) {
        console.warn('Could not read cached operators:', cacheErr);
      }

      // Fallback: use active identity as the single operator
      const current = this.identityService.currentIdentity();
      if (current) {
        this._operators.set([{
          id: current.id,
          name: current.displayName,
          email: current.email || '',
          pin: '', // Never hardcode PIN on client fallback
          role: (current.role === 'owner' || current.role === 'hq_admin') ? 'admin' : (current.role === 'manager' ? 'manager' : 'operator'),
          status: 'active'
        }]);
      }
    }
  }

  lock(): void {
    this._activeOperator.set(null);
    this._isLocked.set(true);
  }

  async unlock(userId: string, pin: string): Promise<boolean> {
    const op = this._operators().find(o => o.id === userId);
    if (!op) return false;

    if (op.status === 'suspended') {
      throw new Error('Este operador está suspenso.');
    }

    const session = this.identityService.clientSession();
    const companyId = session?.tenant?.tenantId;
    if (!companyId) {
      throw new Error('Empresa não autenticada na sessão.');
    }

    const authDb = this.osDb.getNamespace(`tenant.${companyId}.system.auth_cache`);

    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; operator: OperatorContext }>(
          '/api/v1/auth/operator-unlock',
          { companyId, userId, pin }
        )
      );

      if (res?.success && res?.operator) {
        this._activeOperator.set(res.operator);
        this._isLocked.set(false);

        // Cache cryptographic hash with 7-day offline grace period
        try {
          const hash = await computeCredentialHash(companyId, userId, pin);
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          await authDb.put<CachedCredential>(`credential_${userId}`, {
            hash,
            operator: res.operator,
            cachedAt: new Date().toISOString(),
            expiresAt
          });
        } catch (cacheErr) {
          console.warn('[OperatorLock] Falha ao persistir cache de credencial offline:', cacheErr);
        }

        return true;
      }
    } catch (e: unknown) {
      // If error is an explicit 401/403 with PIN incorreto, fail immediately
      const status = (e as { status?: number })?.status;
      if (status === 401 || status === 403) {
        const errMsg = (e as { error?: { error?: string } })?.error?.error || 'PIN incorreto. Verifique o código e tente novamente.';
        throw new Error(errMsg);
      }

      // If server is unreachable / offline, check offline cryptographic credential cache
      console.warn('[OperatorLock] Servidor inacessível para unlock. Tentando validação offline segura...');
      try {
        const cached = await authDb.get<CachedCredential>(`credential_${userId}`);
        if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
          const candidateHash = await computeCredentialHash(companyId, userId, pin);
          if (candidateHash === cached.hash) {
            this._activeOperator.set(cached.operator);
            this._isLocked.set(false);
            console.log(`[OperatorLock] Operador '${cached.operator.name}' autenticado OFFLINE com sucesso.`);
            return true;
          } else {
            throw new Error('PIN incorreto (validação offline).');
          }
        }
      } catch (offlineErr) {
        if ((offlineErr as Error)?.message?.includes('PIN')) {
          throw offlineErr;
        }
        console.warn('[OperatorLock] Cache offline indisponível ou expirado:', offlineErr);
      }

      const errMsg = (e as { error?: { error?: string } })?.error?.error || 'Servidor central inacessível e sem credenciais offline salvas para este operador.';
      throw new Error(errMsg);
    }

    return false;
  }
}
