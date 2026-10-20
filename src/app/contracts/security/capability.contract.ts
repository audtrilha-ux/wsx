export type OsCapability =
  | 'storage.read'
  | 'storage.write'
  | 'network'
  | 'sync'
  | 'events'
  | 'hardware.scan'
  | 'hardware.scale'
  | 'printer'
  | 'payment'
  | 'files'
  | 'app.launch'
  | 'system.settings';

export type CapabilityStatus = 'granted' | 'denied' | 'prompt';

export interface CapabilityGrant {
  appId: string;
  capability: OsCapability;
  status: CapabilityStatus;
  grantedAt: string;
  grantedBy?: string;
  expiresAt?: string;
}

export interface CapabilityAuditLogEntry {
  id: string;
  appId: string;
  capability: OsCapability;
  action: 'check' | 'request' | 'grant' | 'revoke' | 'enforce';
  granted: boolean;
  timestamp: string;
  tenantId: string;
  details?: string;
}

export interface ICapabilityBrokerService {
  hasCapability(appId: string, capability: OsCapability): Promise<boolean>;
  enforceCapability(appId: string, capability: OsCapability): Promise<void>;
  requestCapability(appId: string, capability: OsCapability): Promise<boolean>;
  grantCapability(appId: string, capability: OsCapability, grantedBy?: string): Promise<void>;
  revokeCapability(appId: string, capability: OsCapability): Promise<void>;
  getGrantedCapabilities(appId: string): Promise<OsCapability[]>;
  getAuditLogs(appId?: string): Promise<CapabilityAuditLogEntry[]>;
}
