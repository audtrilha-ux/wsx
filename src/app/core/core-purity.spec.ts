import { TestBed } from '@angular/core/testing';
import { AppRegistryService } from './app-runtime/app-registry.service';
import { OS_APPS } from './app-runtime/app-registry.token';
import { AppManifest } from '../contracts/apps/app-manifest.contract';

import { AppProfileRegistryService } from './app-runtime/app-profile-registry.service';

describe('Gate 1 — OS Purity & Decoupling Architectural Test', () => {
  it('should initialize AppRegistryService purely with native OS system tools and zero business apps by default', () => {
    TestBed.configureTestingModule({
      providers: [
        AppRegistryService,
        { provide: AppProfileRegistryService, useValue: { getAppsForProfile: () => [] } },
        { provide: OS_APPS, useValue: [] }
      ]
    });

    const registry = TestBed.inject(AppRegistryService);
    const allApps = registry.getAll();

    // Verify all registered apps in pure OS are strictly native system apps
    const businessApps = allApps.filter(app => !app.isSystemApp);
    expect(businessApps.length).toBe(0);

    const systemAppIds = allApps.map(app => app.id);
    expect(systemAppIds).toContain('app_settings');
    expect(systemAppIds).toContain('browser');
    expect(systemAppIds).toContain('task_manager');
    expect(systemAppIds).toContain('calculator');
    expect(systemAppIds).toContain('file_explorer');
    expect(systemAppIds).toContain('app_health_diagnostics');
  });

  it('should dynamically accept injected third-party or business manifests via OS_APPS token without hardcoded core knowledge', () => {
    const mockExternalApp: AppManifest = {
      id: 'app_custom_partner_crm',
      name: 'Custom Partner CRM',
      description: 'External app loaded via token',
      version: '1.0.0',
      category: 'CRM',
      icon: 'contact_page',
      developer: 'Partner Inc',
      isSystemApp: false,
      loadComponent: async () => class MockComponent {}
    };

    TestBed.configureTestingModule({
      providers: [
        AppRegistryService,
        { provide: OS_APPS, useValue: [mockExternalApp] }
      ]
    });

    const registry = TestBed.inject(AppRegistryService);
    expect(registry.has('app_custom_partner_crm')).toBe(true);
    expect(registry.get('app_custom_partner_crm')?.developer).toBe('Partner Inc');
  });
});
