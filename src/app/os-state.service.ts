import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { GetOsStateUseCase } from './core/application/store/get-os-state.usecase';
import { InstallAppUseCase } from './core/application/store/install-app.usecase';
import { UninstallAppUseCase } from './core/application/store/uninstall-app.usecase';
import { AppCatalogItem, StoreAppResponse } from './core/domain/store/app-catalog.entity';
import { IdentityService } from './core/identity/identity.service';
import { OsDatabaseService } from './core/storage/os-database.service';
import { AppRegistryService } from './core/app-runtime/app-registry.service';

export interface CompanyState {
  id: string;
  name: string;
  balance: number;
  installedApps: string[]; // App IDs
  status: 'active' | 'suspended' | 'trial';
  osTargetVersion: string;
  channel: string;
  licenseExpiresAt: string;
  planId?: string;
  activeTerminals?: number;
  maxTerminals?: number;
}

interface LocalStateSnapshot {
  company: CompanyState;
  storeAppsWithStatus: StoreAppResponse[];
  availableApps: AppCatalogItem[];
  savedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class OsStateService {
  private getOsState = inject(GetOsStateUseCase);
  private installAppUseCase = inject(InstallAppUseCase);
  private uninstallAppUseCase = inject(UninstallAppUseCase);
  private identityService = inject(IdentityService);
  private osDb = inject(OsDatabaseService);
  private http = inject(HttpClient);
  private appRegistry = inject(AppRegistryService, { optional: true });

  // Available apps in the store (backward-compatibility raw list)
  readonly availableApps = signal<AppCatalogItem[]>([]);

  // Real server-authoritative apps with statuses
  readonly storeAppsWithStatus = signal<StoreAppResponse[]>([]);
  readonly isLoaded = signal<boolean>(false);

  // Current company state derived or loaded from IdentityService tenant
  readonly currentCompanyId = computed(() => {
    const tenant = this.identityService.currentTenant();
    return tenant ? tenant.tenantId : null;
  });

  readonly company = signal<CompanyState>({
    id: '',
    name: 'Selecione uma Empresa',
    balance: 0,
    installedApps: [],
    status: 'active',
    osTargetVersion: '1.4.3',
    channel: 'stable',
    licenseExpiresAt: '2026-12-31'
  });

  constructor() {
    this.loadInitialState();
  }

  async loadInitialState() {
    const tenant = this.identityService.currentTenant();
    const targetId = tenant ? tenant.tenantId : this.currentCompanyId();
    if (!targetId) {
      console.warn('OsState: No company context found. Skipping initialization.');
      return;
    }

    // B-05: Local-First Boot applies ONLY to native containers (Electron/Capacitor/Native SQLite)
    const win = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
    const isNativeContainer = Boolean(
      win && (win['electronAPI'] || win['Capacitor'] || (this.osDb as unknown as Record<string, unknown>)?.['driverName'] === 'sqlite')
    );

    if (isNativeContainer && this.osDb && typeof this.osDb.getNamespace === 'function') {
      try {
        const stateDb = this.osDb.getNamespace(`tenant.${targetId}.system.state`);
        if (stateDb && typeof stateDb.get === 'function') {
          const localSnapshot = await stateDb.get<LocalStateSnapshot>('snapshot');
          if (localSnapshot && localSnapshot.company) {
            this.company.set(localSnapshot.company);
            this.storeAppsWithStatus.set(localSnapshot.storeAppsWithStatus || []);
            this.availableApps.set(localSnapshot.availableApps || []);
            this.isLoaded.set(true);
          }
        }
      } catch (localErr) {
        console.warn('[OsState] Falha ao ler snapshot local do banco:', localErr);
      }
    }

    // 2. Remote Reconciliation (if online)
    try {
      const state = await this.getOsState.execute(targetId);
      
      // Fetch server-authoritative apps with status
      const appsWithStatus = await firstValueFrom(this.http.get<StoreAppResponse[]>('/api/v1/store/apps'));
      const storeApps = appsWithStatus || [];
      const catalogApps = storeApps.map(x => x.app);

      const compState: CompanyState = {
        id: state.company.id,
        name: state.company.name,
        balance: state.company.balance,
        installedApps: [...state.company.installedApps],
        status: (state.company.status || 'active') as 'active' | 'suspended' | 'trial',
        osTargetVersion: state.company.osTargetVersion || '1.4.3',
        channel: state.company.channel || 'stable',
        licenseExpiresAt: state.company.licenseExpiresAt || '2026-12-31',
        activeTerminals: state.company.activeTerminals,
        maxTerminals: state.company.maxTerminals,
        planId: state.company.plan
      };

      this.storeAppsWithStatus.set(storeApps);
      this.availableApps.set(catalogApps);
      this.company.set(compState);
      this.isLoaded.set(true);

      // Persist snapshot to local database for next offline boot
      if (this.osDb && typeof this.osDb.getNamespace === 'function') {
        const stateDb = this.osDb.getNamespace(`tenant.${targetId}.system.state`);
        if (stateDb && typeof stateDb.put === 'function') {
          await stateDb.put('snapshot', {
            company: compState,
            storeAppsWithStatus: storeApps,
            availableApps: catalogApps,
            savedAt: new Date().toISOString()
          });
        }
      }
    } catch (e: unknown) {
      console.warn('[OsState] Servidor central indisponível para reconciliação. Mantendo estado local (offline):', e);
      if (!this.isLoaded()) {
        this.isLoaded.set(true);
      }
    }
  }

  // Derived state
  readonly installedAppsList = computed(() => {
    return this.appRegistry?.getAll() || [];
  });

  readonly storeAppsList = computed(() => {
    return this.storeAppsWithStatus()
      .filter(x => x.status === 'AVAILABLE')
      .map(x => x.app);
  });

  // Actions delegating to Application Use Cases
  async installApp(appId: string): Promise<boolean> {
    console.log(`[OsState] Installing app ${appId}`);
    const success = await this.installAppUseCase.execute(appId);
    if (success) {
      await this.loadInitialState();
    }
    return success;
  }

  async uninstallApp(appId: string): Promise<void> {
    console.log(`[OsState] Uninstalling app ${appId}`);
    await this.uninstallAppUseCase.execute(appId);
    await this.loadInitialState();
  }

  // Authoritative server-side update action with local runtime manifest synchronization
  async updateApp(appId: string): Promise<boolean> {
    console.log(`[OsState] Updating app ${appId}`);
    try {
      const response = await firstValueFrom(this.http.post<{ success: boolean; installedVersion?: string }>(`/api/v1/store/apps/${appId}/update`, {}));
      if (response && response.installedVersion && this.appRegistry) {
        this.appRegistry.upgradeManifestVersion(appId, response.installedVersion);
      }
      await this.loadInitialState();
      return true;
    } catch (error) {
      console.error('Update failed', error);
      return false;
    }
  }
}
