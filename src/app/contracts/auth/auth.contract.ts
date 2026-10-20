/**
 * 3EATCRU OS - Auth & Identity Contracts (Section 8.1 & Section 18)
 * Isolamento rigoroso de Tenant, Sessão, Identidade e Permissões
 */

export interface IPermission {
  resource: string;
  action: 'read' | 'write' | 'delete' | 'admin' | 'execute';
  scope?: string;
}

export type ClientUserRole = 'owner' | 'manager' | 'operator' | 'cashier' | 'waiter' | 'system';
export type HqUserRole = 'hq_admin';
export type UserRole = ClientUserRole | HqUserRole;

export interface IIdentity {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly email?: string;
  readonly role: UserRole;
  readonly permissions?: string[];
  hasPermission?(permission: string | IPermission): boolean;
}

export interface ITenantContext {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly slug?: string;
  readonly plan: 'free' | 'starter' | 'pro' | 'enterprise';
  readonly status: 'active' | 'suspended' | 'trial';
  readonly balance: number;
  readonly branchId?: string;
  readonly branchName?: string;
  readonly installedApps?: string[];
}

export interface ISession {
  readonly token: string;
  readonly expiresAt: Date | string;
  readonly identity: IIdentity;
  readonly tenant?: ITenantContext;
  isValid?(): boolean;
}

export interface LoginCredentials {
  companyId: string;
  email: string;
  password: string;
  branchId?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  expiresAt: string;
  user: IIdentity;
  tenant: ITenantContext;
}

export interface HqLoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface HqLoginResponse {
  success: boolean;
  token: string;
  expiresAt: string;
  user: IIdentity;
}

