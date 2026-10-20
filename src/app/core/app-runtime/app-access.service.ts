import { Injectable, inject } from '@angular/core';
import { AppRegistryService } from './app-registry.service';
import { DeviceService } from '../device/device.service';
import { OsStateService } from '../../os-state.service';
import { satisfiesSemVer } from '../semver';

export interface AppAccessCheckResult {
  allowed: boolean;
  code: 'OK' | 'UNREGISTERED' | 'NOT_ENTITLED' | 'NOT_INSTALLED' | 'INCOMPATIBLE_OS' | 'MISSING_DEPENDENCY' | 'UNSATISFIED_DEPENDENCY' | 'SYSTEM_RESERVED';
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppAccessService {
  private appRegistry = inject(AppRegistryService);
  private deviceService = inject(DeviceService);
  private osState = inject(OsStateService);

  validateCompatibility(appId: string): { compatible: boolean; reason?: string } {
    const manifest = this.appRegistry.get(appId);
    if (!manifest) {
      return { compatible: false, reason: `Manifesto do app '${appId}' não encontrado no AppRegistry.` };
    }

    if (manifest.isSystemApp) {
      return { compatible: true };
    }

    const currentOsVersion = this.deviceService.deviceState().osVersion || '1.4.3';
    if (manifest.osCompatibility && !satisfiesSemVer(currentOsVersion, manifest.osCompatibility)) {
      return {
        compatible: false,
        reason: `App '${manifest.name}' requer 3eatcru OS ${manifest.osCompatibility}, mas o terminal está na versão ${currentOsVersion}.`
      };
    }

    if (manifest.dependencies && manifest.dependencies.length > 0) {
      const storeApps = this.osState.storeAppsWithStatus();
      for (const dep of manifest.dependencies) {
        const depStoreApp = storeApps.find(s => s.app.id === dep.id);
        const depManifest = this.appRegistry.get(dep.id);

        if (!depManifest && !depStoreApp) {
          return {
            compatible: false,
            reason: `App '${manifest.name}' requer a dependência '${dep.id}' (${dep.versionRange}), que não está registrada no sistema.`
          };
        }

        const isSystemOrUtility = (depManifest && depManifest.isSystemApp) ||
                                  (depStoreApp && depStoreApp.app.isSystemApp);

        const isInstalled = depStoreApp && depStoreApp.installation && depStoreApp.installation.status === 'INSTALLED';

        if (!isSystemOrUtility && !isInstalled) {
          return {
            compatible: false,
            reason: `App '${manifest.name}' requer o módulo dependente '${depStoreApp?.app.name || dep.id}' instalado no inquilino.`
          };
        }

        const installedVersion = isSystemOrUtility ? (depManifest?.version || '1.0.0') : depStoreApp?.installation?.installedVersion;
        if (dep.versionRange && installedVersion) {
          if (!satisfiesSemVer(installedVersion, dep.versionRange)) {
            return {
              compatible: false,
              reason: `App '${manifest.name}' requer '${depStoreApp?.app.name || dep.id}' na versão '${dep.versionRange}', mas a versão instalada é '${installedVersion}'.`
            };
          }
        }
      }
    }

    return { compatible: true };
  }

  canLaunchApp(appId: string): AppAccessCheckResult {
    const manifest = this.appRegistry.get(appId);
    if (!manifest) {
      return {
        allowed: false,
        code: 'UNREGISTERED',
        reason: `Módulo '${appId}' não está registrado no AppRegistry do sistema.`
      };
    }

    // System apps bypass all checks
    if (manifest.isSystemApp) {
      return { allowed: true, code: 'OK' };
    }

    if (!this.osState.isLoaded()) {
      return {
        allowed: false,
        code: 'NOT_ENTITLED',
        reason: 'Sincronizando estado do inquilino... Por favor, aguarde.'
      };
    }

    const compat = this.validateCompatibility(appId);
    if (!compat.compatible) {
      return {
        allowed: false,
        code: 'INCOMPATIBLE_OS',
        reason: compat.reason
      };
    }

    // Check store entitlement and installation status
    const storeApps = this.osState.storeAppsWithStatus();
    const storeApp = storeApps.find(s => s.app.id === appId);
    
    if (!storeApp) {
      return {
        allowed: false,
        code: 'NOT_ENTITLED',
        reason: `Aplicativo '${manifest.name}' não está disponível na loja ou você não possui uma licença.`
      };
    }

    if (storeApp.entitlement && storeApp.entitlement.status !== 'ACTIVE') {
      return {
        allowed: false,
        code: 'NOT_ENTITLED',
        reason: `Licença comercial do app '${manifest.name}' está ${storeApp.entitlement.status}.`
      };
    }
    
    if (storeApp.status === 'SUSPENDED' || storeApp.status === 'REVOKED' || storeApp.status === 'EXPIRED') {
      return {
        allowed: false,
        code: 'NOT_ENTITLED',
        reason: `Acesso negado: Licença comercial não autorizada (${storeApp.status}).`
      };
    }

    if (!storeApp.installation || storeApp.installation.status !== 'INSTALLED') {
      return {
        allowed: false,
        code: 'NOT_INSTALLED',
        reason: `Aplicativo '${manifest.name}' não está instalado neste terminal.`
      };
    }

    // H-07: Verify code executable manifest version exactly matches installed version for bundled architecture
    if (storeApp.installation.installedVersion && manifest.version) {
      if (manifest.version !== storeApp.installation.installedVersion) {
        return {
          allowed: false,
          code: 'NOT_INSTALLED',
          reason: `O manifesto do código executável local (v${manifest.version}) não corresponde à versão instalada autorizada (v${storeApp.installation.installedVersion}). Atualize o aplicativo na Store.`
        };
      }
    }

    return { allowed: true, code: 'OK' };
  }

  isPermissionGranted(appId: string, requiredPermission: string): boolean {
    const manifest = this.appRegistry.get(appId);
    if (!manifest) return false;
    const perms: readonly string[] = manifest.permissions || [];
    if (perms.includes('*') || perms.includes(requiredPermission)) return true;

    const normalize = (p: string) => p.toLowerCase().replace(/[:_]/g, '.');
    const reqNorm = normalize(requiredPermission);

    return perms.some(p => {
      const pNorm = normalize(p);
      if (pNorm === reqNorm || pNorm === '*') return true;
      if (pNorm.endsWith('.*')) {
        const prefix = pNorm.slice(0, -2);
        return reqNorm === prefix || reqNorm.startsWith(`${prefix}.`);
      }
      // Parent permission grants child permission (e.g. 'printer' grants 'printer.tickets')
      // Note: Child permission (e.g. 'printer.tickets') must NEVER grant broader parent permission ('printer')
      return reqNorm.startsWith(`${pNorm}.`);
    });
  }
}
