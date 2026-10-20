// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { centralDatabase } from './central-db.js';
import { centralState, getTenantInstalledAppIds } from '../state.js';
import { resolveDeviceContext, getAuthoritativeReleaseForChannel } from '../routes/store.js';
import type { AuthenticatedRequest } from '../middleware.js';

describe('3eatcru OS Hardened Platform Audit & Security Suite', () => {
  beforeEach(() => {
    centralState.devices.clear();
    centralState.companies.clear();
    centralState.appEntitlements.clear();
    centralState.appInstallations.clear();
  });

  describe('1. Device Identity & Credentials Verification', () => {
    const mockCompany = {
      id: 'comp_test_1',
      name: 'Test Tenant 1',
      balance: 1000,
      installedApps: [],
      status: 'ACTIVE' as const,
      plan: 'pro' as const,
      maxTerminals: 5,
      maxBranches: 2,
      activeTerminals: 0,
      channel: 'stable' as const,
      osTargetVersion: '1.5.0',
      licenseExpiresAt: '2027-01-01T00:00:00Z',
      branches: []
    };

    it('should allow secure deterministic web sessions without credentials check', () => {
      const req: Partial<AuthenticatedRequest> = {
        user: { id: 'usr_1', name: 'User', email: 'u@test.com', role: 'admin', companyId: 'comp_test_1' },
        query: { deviceId: 'default-web-terminal' },
        headers: {}
      };

      const context = resolveDeviceContext(req as AuthenticatedRequest, mockCompany);
      expect('error' in context).toBe(false);
      if (!('error' in context)) {
        expect(context.deviceId).toBe('web_dev_comp_test_1');
        expect(context.isWebSession || context.deviceId.startsWith('web_dev_')).toBe(true);
      }
    });

    it('should reject native terminals if unregistered', () => {
      const req: Partial<AuthenticatedRequest> = {
        user: { id: 'usr_1', name: 'User', email: 'u@test.com', role: 'admin', companyId: 'comp_test_1' },
        query: { deviceId: 'terminal_native_999' },
        headers: { 'x-device-fingerprint': 'some_fingerprint' }
      };

      const context = resolveDeviceContext(req as AuthenticatedRequest, mockCompany);
      expect('error' in context).toBe(true);
      if ('error' in context) {
        expect(context.error).toContain('Dispositivo não registrado para esta empresa');
      }
    });

    it('should reject registered native terminals with invalid or missing fingerprint credentials', () => {
      // Register device in in-memory state
      centralState.devices.set('comp_test_1:terminal_native_777', {
        id: 'dev_row_1',
        companyId: 'comp_test_1',
        deviceId: 'terminal_native_777',
        name: 'PDV Terminal',
        fingerprintHash: 'sha256_legit_credentials_hash_value',
        osVersion: '1.4.9',
        status: 'ACTIVE',
        branchId: 'branch_1',
        createdAt: new Date().toISOString()
      });

      const reqMissingFingerprint: Partial<AuthenticatedRequest> = {
        user: { id: 'usr_1', name: 'User', email: 'u@test.com', role: 'admin', companyId: 'comp_test_1' },
        query: { deviceId: 'terminal_native_777' },
        headers: {} // No x-device-fingerprint
      };

      const contextMissing = resolveDeviceContext(reqMissingFingerprint as AuthenticatedRequest, mockCompany);
      expect('error' in contextMissing).toBe(true);
      if ('error' in contextMissing) {
        expect(contextMissing.error).toContain('Device Credential inválida');
      }

      const reqWrongFingerprint: Partial<AuthenticatedRequest> = {
        user: { id: 'usr_1', name: 'User', email: 'u@test.com', role: 'admin', companyId: 'comp_test_1' },
        query: { deviceId: 'terminal_native_777' },
        headers: { 'x-device-fingerprint': 'hacker_spoofed_hash' }
      };

      const contextWrong = resolveDeviceContext(reqWrongFingerprint as AuthenticatedRequest, mockCompany);
      expect('error' in contextWrong).toBe(true);
      if ('error' in contextWrong) {
        expect(contextWrong.error).toContain('Device Credential inválida');
      }

      const reqCorrectFingerprint: Partial<AuthenticatedRequest> = {
        user: { id: 'usr_1', name: 'User', email: 'u@test.com', role: 'admin', companyId: 'comp_test_1' },
        query: { deviceId: 'terminal_native_777' },
        headers: { 'x-device-fingerprint': 'sha256_legit_credentials_hash_value' }
      };

      const contextCorrect = resolveDeviceContext(reqCorrectFingerprint as AuthenticatedRequest, mockCompany);
      expect('error' in contextCorrect).toBe(false);
    });
  });

  describe('2. Prioritized Stable/Beta Channel Release Matching', () => {
    it('should strictly filter and match releases based on tenant channel preference', () => {
      // Mock some database releases
      const mockReleases = [
        { id: 'rel_1', appId: 'app_pos', version: '1.6.0', channel: 'beta', minOsVersion: '1.0.0', releasedAt: '2026-09-18T10:00:00Z', checksum: 'hash_b' },
        { id: 'rel_2', appId: 'app_pos', version: '1.5.0', channel: 'stable', minOsVersion: '1.0.0', releasedAt: '2026-09-18T11:00:00Z', checksum: 'hash_s' }
      ];

      // Temporarily overwrite getAppReleases in centralDatabase for this test
      const originalGetAppReleases = centralDatabase.getAppReleases;
      centralDatabase.getAppReleases = (appId: string) => {
        if (appId === 'app_pos') return mockReleases as unknown as Record<string, unknown>[];
        return [];
      };

      // stable channel -> must get 1.5.0 (the stable release) even if beta 1.6.0 exists
      const stableRelease = getAuthoritativeReleaseForChannel('app_pos', 'stable');
      expect(stableRelease).not.toBeNull();
      expect(stableRelease?.version).toBe('1.5.0');
      expect(stableRelease?.releaseChannel).toBe('stable');

      // beta channel -> must get 1.6.0 (the beta release)
      const betaRelease = getAuthoritativeReleaseForChannel('app_pos', 'beta');
      expect(betaRelease).not.toBeNull();
      expect(betaRelease?.version).toBe('1.6.0');
      expect(betaRelease?.releaseChannel).toBe('beta');

      // Restore original
      centralDatabase.getAppReleases = originalGetAppReleases;
    });

    it('should fall back to stable release for beta channel if no beta release exists', () => {
      const mockReleasesOnlyStable = [
        { id: 'rel_2', appId: 'app_pos', version: '1.5.0', channel: 'stable', minOsVersion: '1.0.0', releasedAt: '2026-09-18T11:00:00Z', checksum: 'hash_s' }
      ];

      const originalGetAppReleases = centralDatabase.getAppReleases;
      centralDatabase.getAppReleases = (appId: string) => {
        if (appId === 'app_pos') return mockReleasesOnlyStable as unknown as Record<string, unknown>[];
        return [];
      };

      const betaFallbackRelease = getAuthoritativeReleaseForChannel('app_pos', 'beta');
      expect(betaFallbackRelease).not.toBeNull();
      expect(betaFallbackRelease?.version).toBe('1.5.0');
      expect(betaFallbackRelease?.releaseChannel).toBe('stable');

      centralDatabase.getAppReleases = originalGetAppReleases;
    });

    it('should strictly prefer beta release for beta channel even when stable release has higher SemVer (Stable 2.0.0 vs Beta 1.9.0)', () => {
      const mockReleases = [
        { id: 'rel_s', appId: 'app_pos', version: '2.0.0', channel: 'stable', minOsVersion: '1.0.0', releasedAt: '2026-09-18T10:00:00Z', checksum: 'hash_s' },
        { id: 'rel_b', appId: 'app_pos', version: '1.9.0', channel: 'beta', minOsVersion: '1.0.0', releasedAt: '2026-09-18T11:00:00Z', checksum: 'hash_b' }
      ];

      const originalGetAppReleases = centralDatabase.getAppReleases;
      centralDatabase.getAppReleases = (appId: string) => {
        if (appId === 'app_pos') return mockReleases as unknown as Record<string, unknown>[];
        return [];
      };

      const betaRelease = getAuthoritativeReleaseForChannel('app_pos', 'beta');
      expect(betaRelease).not.toBeNull();
      expect(betaRelease?.version).toBe('1.9.0');
      expect(betaRelease?.releaseChannel).toBe('beta');

      const stableRelease = getAuthoritativeReleaseForChannel('app_pos', 'stable');
      expect(stableRelease).not.toBeNull();
      expect(stableRelease?.version).toBe('2.0.0');
      expect(stableRelease?.releaseChannel).toBe('stable');

      centralDatabase.getAppReleases = originalGetAppReleases;
    });
  });

  describe('4. A22-03: Authoritative App Installations vs Legacy installedApps', () => {
    it('should NOT report an uninstalled app as installed even if legacy company.installedApps has it', () => {
      const companyId = 'comp_legacy_test';
      centralState.companies.set(companyId, {
        id: companyId,
        name: 'Legacy Co',
        balance: 100,
        installedApps: ['app_pos', 'app_inventory'],
        status: 'ACTIVE',
        plan: 'starter',
        maxTerminals: 2,
        maxBranches: 1,
        activeTerminals: 1,
        channel: 'stable',
        osTargetVersion: '1.4.3',
        licenseExpiresAt: '2027-01-01T00:00:00Z',
        branches: []
      });

      // Tenant has an explicit uninstalled or deleted record for app_pos
      centralState.appInstallations.set(`${companyId}:term_1:app_pos`, {
        id: 'inst_pos',
        companyId,
        deviceId: 'term_1',
        appId: 'app_pos',
        installedVersion: '1.0.0',
        status: 'UNINSTALLED',
        installedAt: '2026-09-18T10:00:00Z'
      });

      // And active installation for app_tables
      centralState.appInstallations.set(`${companyId}:term_1:app_tables`, {
        id: 'inst_tables',
        companyId,
        deviceId: 'term_1',
        appId: 'app_tables',
        installedVersion: '1.0.0',
        status: 'INSTALLED',
        installedAt: '2026-09-18T10:00:00Z'
      });

      const installed = getTenantInstalledAppIds(companyId, 'term_1');
      // app_pos was uninstalled, so it must NOT be returned even though it was in comp.installedApps
      expect(installed).not.toContain('app_pos');
      expect(installed).toContain('app_tables');
    });
  });

  describe('5. A22-07: Artifact Distribution Security & Release Association', () => {
    it('should query release by artifact ID and verify integrity attributes', () => {
      const artifactId = 'art_secure_123';
      centralDatabase.addAppArtifact(artifactId, 'app_pos', '1.0.0', 'hash_secure_sha256', 'base64_binaries');
      centralDatabase.addAppReleaseTransaction({
        appId: 'app_pos',
        version: '1.0.0',
        channel: 'stable',
        minOsVersion: '1.0.0',
        artifactId,
        checksum: 'hash_secure_sha256',
        status: 'PUBLISHED'
      });

      const release = centralDatabase.getReleaseByArtifactId(artifactId);
      expect(release).not.toBeNull();
      expect(release?.appId).toBe('app_pos');
      expect(release?.status).toBe('PUBLISHED');
      expect(release?.checksum).toBe('hash_secure_sha256');

      const artifact = centralDatabase.getAppArtifact(artifactId);
      expect(artifact).not.toBeNull();
      expect(artifact?.checksum).toBe(release?.checksum);
    });
  });
});
