import { TestBed } from '@angular/core/testing';
import { AppAccessService } from './app-access.service';
import { AppRegistryService } from './app-registry.service';
import { DeviceService } from '../device/device.service';
import { OsStateService } from '../../os-state.service';
import { OS_APPS } from './app-registry.token';
import { AppManifest } from '../../contracts/apps/app-manifest.contract';
import { Component } from '@angular/core';

@Component({
  template: `<div>Mock App</div>`,
  standalone: true
})
class MockComponent {}

describe('AppAccessService — Security & Granular Permissions', () => {
  let accessService: AppAccessService;
  let registry: AppRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AppAccessService,
        AppRegistryService,
        { provide: OS_APPS, useValue: [] },
        {
          provide: DeviceService,
          useValue: {
            deviceState: () => ({ osVersion: '1.4.3', deviceId: 'dev_123', status: 'active' })
          }
        },
        {
          provide: OsStateService,
          useValue: {
            storeAppsWithStatus: () => []
          }
        }
      ]
    });

    accessService = TestBed.inject(AppAccessService);
    registry = TestBed.inject(AppRegistryService);
  });

  describe('Permission Hierarchy (M22-01)', () => {
    it('should grant exact matching permissions', () => {
      const manifest: AppManifest = {
        id: 'app_exact',
        name: 'Exact Perms App',
        description: 'Test app for exact permissions',
        version: '1.0.0',
        category: 'UTILITIES',
        icon: 'settings',
        developer: 'HQ Enterprise',
        permissions: ['printer.tickets', 'storage.local'],
        loadComponent: async () => MockComponent
      };
      registry.register(manifest);

      expect(accessService.isPermissionGranted('app_exact', 'printer.tickets')).toBe(true);
      expect(accessService.isPermissionGranted('app_exact', 'storage.local')).toBe(true);
      expect(accessService.isPermissionGranted('app_exact', 'network.sync')).toBe(false);
    });

    it('should allow parent permission to grant child permission', () => {
      const manifest: AppManifest = {
        id: 'app_parent_perms',
        name: 'Parent Perms App',
        description: 'Test app for parent permissions',
        version: '1.0.0',
        category: 'UTILITIES',
        icon: 'folder',
        developer: 'HQ Enterprise',
        permissions: ['printer', 'storage.read'],
        loadComponent: async () => MockComponent
      };
      registry.register(manifest);

      // 'printer' grants 'printer.tickets' and 'printer.receipts.cut'
      expect(accessService.isPermissionGranted('app_parent_perms', 'printer.tickets')).toBe(true);
      expect(accessService.isPermissionGranted('app_parent_perms', 'printer.receipts.cut')).toBe(true);

      // 'storage.read' grants 'storage.read.customers'
      expect(accessService.isPermissionGranted('app_parent_perms', 'storage.read.customers')).toBe(true);
    });

    it('should NOT allow child permission to grant broader parent permission (Privilege Escalation Prevention)', () => {
      const manifest: AppManifest = {
        id: 'app_child_only',
        name: 'Child Only App',
        description: 'Test app for child permissions',
        version: '1.0.0',
        category: 'UTILITIES',
        icon: 'lock',
        developer: 'HQ Enterprise',
        permissions: ['printer.tickets'],
        loadComponent: async () => MockComponent
      };
      registry.register(manifest);

      // 'printer.tickets' does NOT grant 'printer'
      expect(accessService.isPermissionGranted('app_child_only', 'printer')).toBe(false);

      // 'printer.tickets' does NOT grant sibling 'printer.fiscal'
      expect(accessService.isPermissionGranted('app_child_only', 'printer.fiscal')).toBe(false);
    });

    it('should support wildcards correctly', () => {
      const manifest: AppManifest = {
        id: 'app_wildcard',
        name: 'Wildcard App',
        description: 'Test app for wildcard permissions',
        version: '1.0.0',
        category: 'UTILITIES',
        icon: 'star',
        developer: 'HQ Enterprise',
        permissions: ['storage.*'],
        loadComponent: async () => MockComponent
      };
      registry.register(manifest);

      expect(accessService.isPermissionGranted('app_wildcard', 'storage.read')).toBe(true);
      expect(accessService.isPermissionGranted('app_wildcard', 'storage.write')).toBe(true);
      expect(accessService.isPermissionGranted('app_wildcard', 'printer.tickets')).toBe(false);
    });
  });
});
