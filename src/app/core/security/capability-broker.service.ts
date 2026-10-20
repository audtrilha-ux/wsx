import { Injectable, inject, signal } from '@angular/core';
import { OsDatabaseService } from '../storage/os-database.service';
import { IdentityService } from '../identity/identity.service';
import { DeviceService } from '../device/device.service';
import {
  OsCapability,
  CapabilityGrant,
  CapabilityAuditLogEntry,
  ICapabilityBrokerService
} from '../../contracts/security/capability.contract';

const SYSTEM_APPS = new Set([
  'sys.pos',
  'sys.inventory',
  'sys.tables',
  'sys.kds',
  'sys.settings',
  'sys.publicspace',
  'sys.marketplace'
]);

const DEFAULT_SYSTEM_CAPABILITIES: OsCapability[] = [
  'storage.read',
  'storage.write',
  'network',
  'sync',
  'events',
  'hardware.scan',
  'hardware.scale',
  'printer',
  'payment',
  'files',
  'app.launch',
  'system.settings'
];

@Injectable({
  providedIn: 'root'
})
export class CapabilityBrokerService implements ICapabilityBrokerService {
  private osDb = inject(OsDatabaseService);
  private identityService = inject(IdentityService);
  private deviceService = inject(DeviceService);

  readonly capabilityMap = signal<Record<string, OsCapability[]>>({});

  private getTenantId(): string {
    return (
      this.identityService.currentTenant()?.tenantId ||
      this.deviceService.deviceState().companyId ||
      'default'
    );
  }

  private getCapabilityNs(): string {
    return `tenant.${this.getTenantId()}.system.capabilities`;
  }

  private getAuditNs(): string {
    return `tenant.${this.getTenantId()}.system.capability_audit`;
  }

  async hasCapability(appId: string, capability: OsCapability): Promise<boolean> {
    const granted = await this.checkCapability(appId, capability);
    await this.logAudit(appId, capability, 'check', granted);
    return granted;
  }

  private async checkCapability(appId: string, capability: OsCapability): Promise<boolean> {
    // System core apps have full default permissions
    if (SYSTEM_APPS.has(appId)) {
      return DEFAULT_SYSTEM_CAPABILITIES.includes(capability);
    }

    // External apps read from DB grant list
    const ns = this.osDb.getNamespace(this.getCapabilityNs());
    const grantKey = `grant_${appId}_${capability}`;
    const grant = await ns.get<CapabilityGrant>(grantKey);

    if (grant && grant.status === 'granted') {
      if (grant.expiresAt && new Date(grant.expiresAt) < new Date()) {
        await this.revokeCapability(appId, capability);
        return false;
      }
      return true;
    }

    return false;
  }

  async enforceCapability(appId: string, capability: OsCapability): Promise<void> {
    const granted = await this.checkCapability(appId, capability);
    await this.logAudit(appId, capability, 'enforce', granted);

    if (!granted) {
      const err = `[CapabilityBroker] Acesso negado: O aplicativo '${appId}' não possui a permissão '${capability}'.`;
      console.error(err);
      throw new Error(err);
    }
  }

  async requestCapability(appId: string, capability: OsCapability): Promise<boolean> {
    const granted = await this.checkCapability(appId, capability);
    await this.logAudit(appId, capability, 'request', granted, `Solicitação de permissão para ${capability}`);
    return granted;
  }

  async grantCapability(appId: string, capability: OsCapability, grantedBy = 'system_admin'): Promise<void> {
    const ns = this.osDb.getNamespace(this.getCapabilityNs());
    const grantKey = `grant_${appId}_${capability}`;

    const grantRecord: CapabilityGrant = {
      appId,
      capability,
      status: 'granted',
      grantedAt: new Date().toISOString(),
      grantedBy
    };

    await ns.put(grantKey, grantRecord);
    await this.logAudit(appId, capability, 'grant', true, `Concedido por ${grantedBy}`);
    await this.refreshGrantedCapabilitiesSignal(appId);
  }

  async revokeCapability(appId: string, capability: OsCapability): Promise<void> {
    const ns = this.osDb.getNamespace(this.getCapabilityNs());
    const grantKey = `grant_${appId}_${capability}`;

    await ns.delete(grantKey);
    await this.logAudit(appId, capability, 'revoke', false, 'Permissão revogada');
    await this.refreshGrantedCapabilitiesSignal(appId);
  }

  async getGrantedCapabilities(appId: string): Promise<OsCapability[]> {
    if (SYSTEM_APPS.has(appId)) {
      return [...DEFAULT_SYSTEM_CAPABILITIES];
    }

    const ns = this.osDb.getNamespace(this.getCapabilityNs());
    const entries = await ns.query<CapabilityGrant>();
    const appGrants = entries
      .filter(e => e.value.appId === appId && e.value.status === 'granted')
      .map(e => e.value.capability);

    return Array.from(new Set(appGrants));
  }

  async getAuditLogs(appId?: string): Promise<CapabilityAuditLogEntry[]> {
    const ns = this.osDb.getNamespace(this.getAuditNs());
    const entries = await ns.query<CapabilityAuditLogEntry>();
    let logs = entries.map(e => e.value);

    if (appId) {
      logs = logs.filter(l => l.appId === appId);
    }

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private async logAudit(
    appId: string,
    capability: OsCapability,
    action: 'check' | 'request' | 'grant' | 'revoke' | 'enforce',
    granted: boolean,
    details?: string
  ): Promise<void> {
    const tenantId = this.getTenantId();
    const ns = this.osDb.getNamespace(this.getAuditNs());

    const entry: CapabilityAuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      appId,
      capability,
      action,
      granted,
      timestamp: new Date().toISOString(),
      tenantId,
      details
    };

    await ns.put(entry.id, entry);
  }

  private async refreshGrantedCapabilitiesSignal(appId: string): Promise<void> {
    const current = await this.getGrantedCapabilities(appId);
    this.capabilityMap.update(map => ({
      ...map,
      [appId]: current
    }));
  }
}
