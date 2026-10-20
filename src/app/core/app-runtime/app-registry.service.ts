import { Injectable, signal, Type, inject, effect } from '@angular/core';
import { AppManifest, AppCategory } from '../../contracts/apps/app-manifest.contract';
import { OS_APPS } from './app-registry.token';
import { OsProfileService } from '../os-profile/os-profile.service';
import { AppProfileRegistryService } from './app-profile-registry.service';

import { SettingsComponent } from '../../ui/os/apps/settings/settings.component';
import { BrowserComponent } from '../../ui/os/apps/browser/browser.component';
import { TaskManagerComponent } from '../../ui/os/apps/task-manager/task-manager.component';
import { CalculatorComponent } from '../../ui/os/apps/calculator/calculator.component';
import { FileExplorerComponent } from '../../ui/os/apps/file-explorer/file-explorer.component';
import { HealthDiagnosticsComponent } from '../../ui/os/apps/health-diagnostics/health-diagnostics.component';
import { PublicSpaceCartDrawerComponent } from '../../ui/public-space/components/public-space-cart-drawer.component';
import { MarketplaceComponent } from '../../ui/marketplace/marketplace.component';

export type AppLoadingState = 'unloaded' | 'loading' | 'loaded' | 'failed';

@Injectable({
  providedIn: 'root'
})
export class AppRegistryService {
  private registry = new Map<string, AppManifest>();
  readonly registeredApps = signal<AppManifest[]>([]);
  readonly availableApps = this.registeredApps; // Alias for backward compatibility
  private readonly injectedApps = inject(OS_APPS, { optional: true }) || [];
  private readonly profileService = inject(OsProfileService);
  private readonly profileRegistry = inject(AppProfileRegistryService);

  readonly loadingStates = signal<Record<string, AppLoadingState>>({});
  private loadedComponents = new Map<string, Type<unknown>>();

  constructor() {
    // Register native OS system tools
    this.registerNative('app_settings', 'Configurações', 'settings', SettingsComponent);
    this.registerNative('browser', 'Navegador Web OS', 'explore', BrowserComponent);
    this.registerNative('task_manager', 'Gerenciador de Tarefas', 'view_timeline', TaskManagerComponent);
    this.registerNative('calculator', 'Calculadora', 'calculate', CalculatorComponent);
    this.registerNative('file_explorer', 'Explorador de Arquivos', 'folder_open', FileExplorerComponent);
    this.registerNative('app_health_diagnostics', 'Diagnósticos do Sistema', 'health_and_safety', HealthDiagnosticsComponent);
    this.registerNative('cart_drawer', 'Carrinho de Compras', 'shopping_cart', PublicSpaceCartDrawerComponent);
    this.registerNative('marketplace_catalog', 'Catálogo & Marketplace', 'storefront', MarketplaceComponent);

    // Initialize registered suite immediately and react to profile toggles
    this.reloadAppsForProfile();
    effect(() => {
      void this.profileService.activeProfile();
      this.reloadAppsForProfile();
    });
  }

  reloadAppsForProfile(): void {
    const systemAppIds = new Set([
      'app_settings',
      'browser',
      'task_manager',
      'calculator',
      'file_explorer',
      'app_health_diagnostics',
      'cart_drawer',
      'marketplace_catalog'
    ]);

    // Keep native system apps, refresh profile business apps
    for (const [id] of Array.from(this.registry.entries())) {
      if (!systemAppIds.has(id)) {
        this.registry.delete(id);
      }
    }

    const apps = this.profileRegistry.getAppsForProfile(this.profileService.activeProfile());
    for (const app of apps) {
      this.registry.set(app.id, app);
    }

    // Register any business or third-party applications injected at composition root
    for (const app of this.injectedApps) {
      if (!this.registry.has(app.id)) {
        this.registry.set(app.id, app);
      }
    }

    this.registeredApps.set(Array.from(this.registry.values()));
  }

  private registerNative(id: string, name: string, icon: string, component: Type<unknown>): void {
    this.loadedComponents.set(id, component);
    this.loadingStates.update(s => ({ ...s, [id]: 'loaded' }));
    this.register({
      id,
      name,
      description: 'Componente nativo do Sistema Operacional',
      version: '1.0.0',
      category: 'SYSTEM',
      icon,
      developer: '3eatcru OS',
      isSystemApp: true,
      loadComponent: async () => component
    });
  }

  register(manifest: AppManifest): void {
    this.registry.set(manifest.id, manifest);
    this.registeredApps.set(Array.from(this.registry.values()));
  }

  upgradeManifestVersion(appId: string, newVersion: string): boolean {
    const existing = this.registry.get(appId);
    if (existing) {
      this.registry.set(appId, { ...existing, version: newVersion });
      this.registeredApps.set(Array.from(this.registry.values()));
      return true;
    }
    return false;
  }

  unregister(appId: string): void {
    this.registry.delete(appId);
    this.registeredApps.set(Array.from(this.registry.values()));
  }

  get(appId: string): AppManifest | undefined {
    return this.registry.get(appId);
  }

  getManifest(appId: string): AppManifest | undefined {
    return this.get(appId);
  }

  has(appId: string): boolean {
    return this.registry.has(appId);
  }

  getComponent(appId: string): Type<unknown> | undefined {
    return this.loadedComponents.get(appId);
  }

  async loadComponent(appId: string): Promise<Type<unknown> | undefined> {
    if (this.loadedComponents.has(appId)) {
      return this.loadedComponents.get(appId);
    }

    const manifest = this.registry.get(appId);
    if (!manifest || !manifest.loadComponent) {
      this.loadingStates.update(s => ({ ...s, [appId]: 'failed' }));
      return undefined;
    }

    this.loadingStates.update(s => ({ ...s, [appId]: 'loading' }));

    try {
      const comp = await manifest.loadComponent();
      this.loadedComponents.set(appId, comp);
      this.loadingStates.update(s => ({ ...s, [appId]: 'loaded' }));
      return comp;
    } catch (err) {
      console.error('Failed to load component for app ' + appId, err);
      this.loadingStates.update(s => ({ ...s, [appId]: 'failed' }));
      return undefined;
    }
  }

  getAll(): AppManifest[] {
    return this.registeredApps();
  }

  getByCategory(category: AppCategory): AppManifest[] {
    return this.getAll().filter(app => app.category === category);
  }
}
