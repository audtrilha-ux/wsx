import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DeviceTrustLevel, StationType, IDevice, IDeviceIdentity, IPeripheral } from '../../contracts/device/device.contract';
import { HardwareService } from '../hardware/hardware.service';
import { IdentityService } from '../identity/identity.service';
import { BUILD_VERSION } from '../version';

export interface DeviceInfo {
  installationId: string | null;
  pairedDevice: string | null;
  deviceId: string | null;
  companyId: string | null;
  branchId?: string | null;
  name?: string;
  platform: 'web' | 'windows' | 'android';
  osVersion: string;
  appVersion: string;
  browserVersion?: string;
  platformVersion?: string;
  status: 'active' | 'inactive' | 'pending' | 'revoked';
  lastSeen: Date | null;
  pairedAt: Date | null;
  fingerprintHash?: string | null;
  deviceToken?: string | null;
  publicKeyPem?: string | null;
  privateKeyPem?: string | null;
  trustLevel: DeviceTrustLevel;
  stationType: StationType;
  deviceGroup: string;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceService implements IDevice {
  private http = inject(HttpClient);
  private hardwareService = inject(HardwareService);
  private identityService = inject(IdentityService);

  readonly deviceState = signal<DeviceInfo>(this.loadStateFromStorage());
  readonly isPaired = signal<boolean>(false);

  constructor() {
    const state = this.loadStateFromStorage();
    if (!state.installationId) {
      state.installationId = 'inst_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    }
    const detectedPlatform = this.detectPlatform();
    if (state.platform === 'web' && detectedPlatform !== 'web') {
      state.platform = detectedPlatform;
    }
    this.deviceState.set(state);
    this.isPaired.set(!!state.deviceId);
    this.generateFingerprint();
  }

  private detectPlatform(): 'web' | 'windows' | 'android' {
    if (typeof window !== 'undefined') {
      const win = window as unknown as { __3EATCRU_NATIVE_BRIDGE__?: { platform: 'web' | 'windows' | 'android' }; electron?: unknown };
      if (win.__3EATCRU_NATIVE_BRIDGE__) {
        return win.__3EATCRU_NATIVE_BRIDGE__.platform;
      }
      if (win.electron) {
        return 'windows';
      }
    }
    return 'web';
  }

  private loadStateFromStorage(): DeviceInfo {
    if (typeof localStorage === 'undefined') {
      return this.getDefaultState();
    }
    try {
      const raw = localStorage.getItem('3eatcru_device_identity_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            ...this.getDefaultState(),
            ...parsed,
            lastSeen: parsed.lastSeen ? new Date(parsed.lastSeen) : null,
            pairedAt: parsed.pairedAt ? new Date(parsed.pairedAt) : null,
          };
        }
      }
    } catch (e) {
      console.error('[DeviceService] Error parsing stored device state:', e);
    }
    return this.getDefaultState();
  }

  private saveStateToStorage(state: DeviceInfo): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('3eatcru_device_identity_v1', JSON.stringify(state));
    } catch (e) {
      console.error('[DeviceService] Error saving device state:', e);
    }
  }

  private getDefaultState(): DeviceInfo {
    return {
      installationId: null,
      pairedDevice: null,
      deviceId: null,
      companyId: null,
      branchId: null,
      platform: this.detectPlatform(),
      osVersion: BUILD_VERSION,
      appVersion: `v${BUILD_VERSION}`,
      browserVersion: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/SSR',
      status: 'inactive',
      lastSeen: null,
      pairedAt: null,
      fingerprintHash: null,
      deviceToken: null,
      publicKeyPem: null,
      privateKeyPem: null,
      trustLevel: 'untrusted',
      stationType: 'pos',
      deviceGroup: 'Frente_de_Caixa'
    };
  }

  async ensureCryptographicKeyPair(): Promise<{ publicKeyPem: string; privateKeyPem: string }> {
    const s = this.deviceState();
    if (s.publicKeyPem && s.privateKeyPem) {
      return { publicKeyPem: s.publicKeyPem, privateKeyPem: s.privateKeyPem };
    }

    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const keyPair = await crypto.subtle.generateKey(
          {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256'
          },
          true,
          ['sign', 'verify']
        );

        const exportedPublic = await crypto.subtle.exportKey('spki', keyPair.publicKey);
        const exportedPrivate = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

        const pubBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublic)));
        const privBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPrivate)));

        const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${pubBase64}\n-----END PUBLIC KEY-----`;
        const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privBase64}\n-----END PRIVATE KEY-----`;

        this.deviceState.update(state => {
          const updated = {
            ...state,
            publicKeyPem,
            privateKeyPem,
            trustLevel: 'trusted' as DeviceTrustLevel
          };
          this.saveStateToStorage(updated);
          return updated;
        });

        return { publicKeyPem, privateKeyPem };
      }
    } catch (err) {
      console.warn('[DeviceService] WebCrypto indisponível, gerando par de chaves simulado:', err);
    }

    const mockPub = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQE3EATCRU_DEV_${Date.now()}\n-----END PUBLIC KEY-----`;
    const mockPriv = `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAE3EATCRU_PRIV_${Date.now()}\n-----END PRIVATE KEY-----`;

    this.deviceState.update(state => {
      const updated = {
        ...state,
        publicKeyPem: mockPub,
        privateKeyPem: mockPriv,
        trustLevel: 'trusted' as DeviceTrustLevel
      };
      this.saveStateToStorage(updated);
      return updated;
    });

    return { publicKeyPem: mockPub, privateKeyPem: mockPriv };
  }

  async rotateCredentials(): Promise<{ newDeviceToken: string; newPublicKeyPem: string }> {
    const newToken = `jwt_terminal_rot_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    this.deviceState.update(state => ({
      ...state,
      publicKeyPem: null,
      privateKeyPem: null,
      deviceToken: newToken
    }));

    const keyPair = await this.ensureCryptographicKeyPair();
    return {
      newDeviceToken: newToken,
      newPublicKeyPem: keyPair.publicKeyPem
    };
  }

  async revokeDevice(reason = 'Revogado pelo administrador'): Promise<void> {
    this.deviceState.update(state => {
      const updated: DeviceInfo = {
        ...state,
        status: 'revoked',
        trustLevel: 'untrusted',
        deviceToken: null
      };
      this.saveStateToStorage(updated);
      return updated;
    });
    this.isPaired.set(false);
    console.warn(`[DeviceService] Dispositivo revogado: ${reason}`);
  }

  setStationType(stationType: StationType, group = 'Geral'): void {
    this.deviceState.update(state => {
      const updated = {
        ...state,
        stationType,
        deviceGroup: group
      };
      this.saveStateToStorage(updated);
      return updated;
    });
  }

  private generateFingerprint(): void {
    const s = this.deviceState();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/SSR';
    const screenRes = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '1920x1080';
    let hash = 0;
    const raw = `${userAgent}|${screenRes}|${s.installationId || ''}`;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    const fingerprintHash = `fp_${Math.abs(hash).toString(16)}`;
    const deviceToken = `jwt_terminal_${fingerprintHash}_${Date.now()}`;

    this.deviceState.update(state => {
      const updated = {
        ...state,
        fingerprintHash,
        deviceToken: state.deviceToken || deviceToken
      };
      this.saveStateToStorage(updated);
      return updated;
    });
  }

  async getIdentity(): Promise<IDeviceIdentity> {
    const s = this.deviceState();
    const currentTenantId = this.identityService.currentTenant()?.tenantId || s.companyId;
    return {
      deviceId: s.deviceId,
      terminalName: s.pairedDevice || 'Terminal Desconectado',
      pairedCompanyId: currentTenantId,
      platform: s.platform === 'windows' ? 'windows' : s.platform === 'android' ? 'android' : 'web',
      appVersion: s.appVersion,
      registeredAt: s.pairedAt || new Date(),
      publicKeyPem: s.publicKeyPem || undefined,
      trustLevel: s.trustLevel,
      stationType: s.stationType,
      deviceGroup: s.deviceGroup
    };
  }

  async listPeripherals(): Promise<IPeripheral[]> {
    return this.hardwareService.peripherals().map(p => ({
      id: p.id,
      name: p.name,
      type: p.type === 'scanner' ? 'barcode_scanner' : p.type as IPeripheral['type'],
      status: p.status === 'online' ? 'connected' : p.status === 'offline' ? 'disconnected' : 'simulated'
    }));
  }

  async getPeripheral(id: string): Promise<IPeripheral | null> {
    const list = await this.listPeripherals();
    return list.find(p => p.id === id) || null;
  }

  async pingHardware(id: string): Promise<boolean> {
    const p = await this.getPeripheral(id);
    return p !== null && p.status !== 'disconnected';
  }

  /**
   * Enrolls this terminal with the Central HQ (POST /api/v1/companies/:id/devices).
   * Generates or updates authentic server-side device registration.
   */
  async enrollDevice(name: string, companyId: string, branchId?: string): Promise<{ success: boolean; deviceId?: string; error?: string }> {
    try {
      const s = this.deviceState();
      const payload = {
        name,
        branchId: branchId || s.branchId || undefined,
        installationId: s.installationId,
        fingerprintHash: s.fingerprintHash,
        platform: s.platform,
        osVersion: s.osVersion
      };

      const res = await firstValueFrom(
        this.http.post<{ success: boolean; device: { deviceId: string; branchId: string; status: 'active' | 'inactive' | 'pending' } }>(
          `/api/v1/companies/${companyId}/devices`,
          payload
        )
      );

      if (res && res.success && res.device) {
        this.deviceState.update(state => {
          const updated: DeviceInfo = {
            ...state,
            pairedDevice: name,
            deviceId: res.device.deviceId,
            companyId,
            branchId: res.device.branchId,
            pairedAt: new Date(),
            status: res.device.status
          };
          this.saveStateToStorage(updated);
          return updated;
        });
        this.isPaired.set(true);
        return { success: true, deviceId: res.device.deviceId };
      }
      return { success: false, error: 'Falha ao registrar dispositivo na Central.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao comunicar com a Central.';
      console.error('[DeviceService] Erro no registro de dispositivo:', err);
      return { success: false, error: msg };
    }
  }

  pairDevice(name: string, deviceId?: string, companyId?: string, branchId?: string) {
    this.deviceState.update(state => {
      const updated = {
        ...state,
        pairedDevice: name,
        deviceId: deviceId || state.deviceId || `dev_${Math.random().toString(36).substring(2, 10)}`,
        companyId: companyId || state.companyId || 'company_default',
        branchId: branchId || state.branchId || 'branch_default',
        pairedAt: new Date(),
        status: 'active' as const
      };
      this.saveStateToStorage(updated);
      return updated;
    });
    this.isPaired.set(true);
  }

  unpairDevice() {
    this.deviceState.update(state => {
      const updated = {
        ...state,
        pairedDevice: null,
        deviceId: null,
        companyId: null,
        branchId: null,
        pairedAt: null,
        status: 'pending' as const
      };
      this.saveStateToStorage(updated);
      return updated;
    });
    this.isPaired.set(false);
  }

  setPlatform(platform: 'web' | 'windows' | 'android') {
    this.deviceState.update(state => {
      const updated = {
        ...state,
        platform
      };
      this.saveStateToStorage(updated);
      return updated;
    });
    this.generateFingerprint();
  }

  updateHealth() {
    this.deviceState.update(state => {
      const updated = {
        ...state,
        lastSeen: new Date()
      };
      this.saveStateToStorage(updated);
      return updated;
    });
  }
}
