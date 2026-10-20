import { TestBed } from '@angular/core/testing';
import { Component, Type } from '@angular/core';
import { AppRegistryService } from './app-registry.service';
import { AppManifest } from '../../contracts/apps/app-manifest.contract';
import { OS_APPS } from './app-registry.token';

@Component({
  template: `<div>Mock Dynamic App</div>`,
  standalone: true
})
class MockDynamicAppComponent {}

describe('AppRegistryService — Sovereign Manifest & Component Loading', () => {
  let registry: AppRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AppRegistryService,
        { provide: OS_APPS, useValue: [] }
      ]
    });

    registry = TestBed.inject(AppRegistryService);
  });

  it('should initialize with native OS components registered', () => {
    expect(registry.has('app_settings')).toBe(true);
    expect(registry.has('file_explorer')).toBe(true);
    expect(registry.has('task_manager')).toBe(true);
    expect(registry.has('calculator')).toBe(true);
    expect(registry.has('browser')).toBe(true);
    expect(registry.has('app_health_diagnostics')).toBe(true);
  });

  it('should dynamically register and retrieve an application manifest', () => {
    const testManifest: AppManifest = {
      id: 'custom_app',
      name: 'Custom Business App',
      description: 'Test application for registry',
      version: '1.0.0',
      category: 'UTILITIES',
      icon: 'extension',
      developer: 'Test Vendor',
      loadComponent: async () => MockDynamicAppComponent
    };

    registry.register(testManifest);
    expect(registry.has('custom_app')).toBe(true);
    expect(registry.get('custom_app')?.name).toBe('Custom Business App');
  });

  it('should manage reactive loading states during dynamic component resolution', async () => {
    let resolveComponent!: (comp: Type<unknown>) => void;
    const loadPromise = new Promise<Type<unknown>>(resolve => {
      resolveComponent = resolve;
    });

    const asyncManifest: AppManifest = {
      id: 'async_app',
      name: 'Async App',
      description: 'Testing loading states',
      version: '1.0.0',
      category: 'SALES',
      icon: 'sync',
      developer: 'Test Vendor',
      loadComponent: () => loadPromise
    };

    registry.register(asyncManifest);
    
    // Initial state before loadComponent is called
    expect(registry.loadingStates()['async_app']).toBeUndefined();

    // Trigger loading
    const loadTask = registry.loadComponent('async_app');
    expect(registry.loadingStates()['async_app']).toBe('loading');

    // Resolve component
    resolveComponent(MockDynamicAppComponent);
    const loadedComp = await loadTask;

    expect(loadedComp).toBe(MockDynamicAppComponent);
    expect(registry.loadingStates()['async_app']).toBe('loaded');
    expect(registry.getComponent('async_app')).toBe(MockDynamicAppComponent);
  });

  it('should handle and track loadComponent failure gracefully', async () => {
    const faultyManifest: AppManifest = {
      id: 'faulty_app',
      name: 'Faulty App',
      description: 'Throws error on load',
      version: '1.0.0',
      category: 'SALES',
      icon: 'error',
      developer: 'Test Vendor',
      loadComponent: async () => {
        throw new Error('Network bundle chunk failed to download');
      }
    };

    registry.register(faultyManifest);

    try {
      await registry.loadComponent('faulty_app');
    } catch (e) {
      expect((e as Error).message).toContain('Network bundle chunk failed to download');
    }

    expect(registry.loadingStates()['faulty_app']).toBe('failed');
  });

  it('should upgrade manifest version atomically and reflect in get()', () => {
    const manifest: AppManifest = {
      id: 'upgradeable_app',
      name: 'Upgradeable App',
      description: 'App with updates',
      version: '1.0.0',
      category: 'SALES',
      icon: 'store',
      developer: 'Test Vendor',
      loadComponent: async () => MockDynamicAppComponent
    };

    registry.register(manifest);
    expect(registry.get('upgradeable_app')?.version).toBe('1.0.0');

    const upgraded = registry.upgradeManifestVersion('upgradeable_app', '1.1.0');
    expect(upgraded).toBe(true);
    expect(registry.get('upgradeable_app')?.version).toBe('1.1.0');

    // Attempting to upgrade non-existent app returns false
    const nonExistent = registry.upgradeManifestVersion('unknown_app', '2.0.0');
    expect(nonExistent).toBe(false);
  });
});
