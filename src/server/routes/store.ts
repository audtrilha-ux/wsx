import { Router } from 'express';
import { centralState, saveCentralState, AppEntitlement, AppInstallation, getEntitlementKey, getInstallationKey } from '../state.js';
import { requireAuth, requireTenantRole, AuthenticatedRequest } from '../middleware.js';
import { compareSemVer, satisfiesSemVer } from '../semver.js';
import { centralDatabase } from '../db/central-db.js';

export const storeRouter = Router();

// Helper to resolve device and authoritative OS version
export function resolveDeviceContext(req: AuthenticatedRequest, company: { id?: string; osTargetVersion?: string; channel?: 'stable' | 'beta' }) {
  const companyId = company.id || req.user?.companyId || '';
  if (!companyId) {
    return { error: 'Contexto de empresa inválido.' };
  }

  const rawDeviceId = (req.query['deviceId'] as string) || (req.headers['x-device-id'] as string);
  const clientFingerprint = (req.headers['x-device-fingerprint'] as string) || (req.query['deviceFingerprint'] as string);

  let deviceId: string;
  let registeredDevice: Record<string, unknown> | null = null;

  // Web client sessions have a secure deterministic session device ID,
  // preventing arbitrary device ID spoofing.
  if (!rawDeviceId || rawDeviceId === 'default-web-terminal' || rawDeviceId === 'web-client') {
    deviceId = `web_dev_${companyId}`;
  } else {
    deviceId = rawDeviceId;
  }

  // Look up registered device in SQLite or in-memory state
  const dbDevice = centralDatabase.getDevice(companyId, deviceId);
  const memDevice = Array.from(centralState.devices.values()).find(d => d.deviceId === deviceId && d.companyId === companyId);
  const registeredDeviceFound = dbDevice || memDevice;

  if (registeredDeviceFound) {
    registeredDevice = registeredDeviceFound as Record<string, unknown>;
  }

  if (registeredDevice) {
    if (registeredDevice['companyId'] !== companyId) {
      return { error: 'Acesso negado: ID do dispositivo pertence a outro tenant.' };
    }
    const devStatus = String(registeredDevice['status'] || 'active').toLowerCase();
    if (devStatus === 'blocked' || devStatus === 'pending') {
      return { error: `Acesso negado: Terminal com status '${devStatus.toUpperCase()}'. Apenas terminais ATIVOS podem acessar a Store.` };
    }
  }

  const isWebSession = deviceId === `web_dev_${companyId}`;

  // For native platforms, we strictly require the device to be registered AND authenticated via fingerprint credentials
  if (!isWebSession) {
    if (!registeredDevice) {
      return { error: 'Acesso negado: Dispositivo não registrado para esta empresa.' };
    }
    // Verify Device Credential (fingerprint validation to prevent spoofing)
    const dbFingerprint = (registeredDevice['fingerprint_hash'] as string) || (registeredDevice['fingerprintHash'] as string);
    if (!dbFingerprint || !clientFingerprint || clientFingerprint !== dbFingerprint) {
      return { error: 'Acesso negado: Falha de autenticação do terminal (Device Credential inválida).' };
    }
  }

  // Authoritative OS version from registered device, or '1.4.3' default for web (never client header spoofing)
  const deviceOsVersion = (registeredDevice?.['os_version'] as string) || (registeredDevice?.['osVersion'] as string) || '1.4.3';
  const channel = company.channel || 'stable';

  return { deviceId, registeredDevice, deviceOsVersion, channel };
}

function checkDependenciesRecursive(appId: string, companyId: string, deviceId: string, visited: Set<string> = new Set<string>()): { success: boolean; missing: string[] } {
  if (visited.has(appId)) {
    return { success: true, missing: [] };
  }
  visited.add(appId);

  const app = centralState.apps.find(a => a.id === appId);
  if (!app) {
    return { success: true, missing: [] };
  }

  const missingDeps: string[] = [];
  if (app.dependencies && app.dependencies.length > 0) {
    for (const dep of app.dependencies) {
      const depInstallKey = getInstallationKey(companyId, deviceId, dep.id);
      const depLegacyInstallKey = getInstallationKey(companyId, null, dep.id);
      const inst = centralState.appInstallations.get(depInstallKey) || centralState.appInstallations.get(depLegacyInstallKey);

      const entKey = getEntitlementKey(companyId, dep.id);
      const ent = centralState.appEntitlements.get(entKey);
      const hasActiveEntitlement = ent && ent.status === 'ACTIVE' && (!ent.expiresAt || new Date(ent.expiresAt).getTime() >= Date.now());

      let isInstalledAndCompatible = false;

      if (inst && inst.status === 'INSTALLED' && hasActiveEntitlement) {
        const installedVer = inst.installedVersion || '1.0.0';
        isInstalledAndCompatible = satisfiesSemVer(installedVer, dep.versionRange);
      }

      if (!isInstalledAndCompatible) {
        missingDeps.push(dep.id);
      } else {
        const sub = checkDependenciesRecursive(dep.id, companyId, deviceId, visited);
        if (!sub.success) {
          missingDeps.push(...sub.missing);
        }
      }
    }
  }

  if (missingDeps.length > 0) {
    return { success: false, missing: Array.from(new Set(missingDeps)) };
  }
  return { success: true, missing: [] };
}

export function getAuthoritativeReleaseForChannel(appId: string, companyChannel: 'stable' | 'beta') {
  // Query all releases for this app from SQLite
  let releases = centralDatabase.getAppReleases(appId);
  if (releases.length === 0) {
    // Fallback to in-memory app catalog currentRelease if SQLite is empty
    const app = centralState.apps.find(a => a.id === appId);
    return app?.currentRelease;
  }

  // 1. Filter by status === 'PUBLISHED'
  releases = releases.filter(r => (r.status || 'PUBLISHED').toUpperCase() === 'PUBLISHED');

  // 2. Filter by channel: Beta prefers latest beta (fallback to stable), Stable requires stable
  let matchedRelease = null;
  if (companyChannel === 'stable') {
    const stableReleases = releases.filter(r => r.channel === 'stable');
    stableReleases.sort((a, b) => compareSemVer(b.version, a.version));
    matchedRelease = stableReleases[0] || null;
  } else {
    const betaReleases = releases.filter(r => r.channel === 'beta');
    if (betaReleases.length > 0) {
      betaReleases.sort((a, b) => compareSemVer(b.version, a.version));
      matchedRelease = betaReleases[0];
    } else {
      const stableReleases = releases.filter(r => r.channel === 'stable');
      stableReleases.sort((a, b) => compareSemVer(b.version, a.version));
      matchedRelease = stableReleases[0] || null;
    }
  }

  if (!matchedRelease) {
    return null;
  }

  return {
    version: matchedRelease.version,
    minOsVersion: matchedRelease.minOsVersion,
    releaseChannel: matchedRelease.channel,
    artifactId: matchedRelease.artifactId,
    checksum: matchedRelease.checksum,
    signature: matchedRelease.signature,
    releasedAt: matchedRelease.releasedAt
  };
}

// Get All Apps with authoritative state calculation
storeRouter.get('/apps', requireAuth, (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  if (!companyId) {
    res.status(400).json({ error: 'Contexto de empresa inválido.' });
    return;
  }

  const company = centralState.companies.get(companyId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const context = resolveDeviceContext(req, company);
  if ('error' in context) {
    res.status(403).json({ error: context.error });
    return;
  }
  const { deviceId, deviceOsVersion, channel } = context;
  const available = centralState.apps.filter(a => a.lifecycle.status === 'PUBLISHED' || a.isSystemApp);

  const responseList = available.map(app => {
    const entitlementKey = `${companyId}:${app.id}`;
    const deviceInstallKey = `${companyId}:${deviceId}:${app.id}`;
    const legacyInstallKey = `${companyId}:${app.id}`;

    const entitlement: AppEntitlement | undefined = centralState.appEntitlements.get(entitlementKey);
    const installation: AppInstallation | undefined = centralState.appInstallations.get(deviceInstallKey) || centralState.appInstallations.get(legacyInstallKey);

    let status: 'AVAILABLE' | 'INSTALLED' | 'UPDATE_AVAILABLE' | 'INCOMPATIBLE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED' = 'AVAILABLE';

    // 1. Technical requirement check (OS compatibility & Channel)
    const activeRelease = getAuthoritativeReleaseForChannel(app.id, channel as 'stable' | 'beta') || app.currentRelease;
    const releaseChannel = activeRelease?.releaseChannel || 'stable';
    const isChannelCompatible = channel !== 'stable' || releaseChannel === 'stable';
    const isOsCompatible = !activeRelease?.minOsVersion || compareSemVer(deviceOsVersion, activeRelease.minOsVersion) >= 0;
    const isCompatible = isChannelCompatible && isOsCompatible;

    if (!isCompatible) {
      status = 'INCOMPATIBLE';
    } else if (entitlement) {
      // 2. Entitlement billing state check
      const isExpired = entitlement.status === 'EXPIRED' || 
                        (entitlement.status === 'ACTIVE' && entitlement.expiresAt && new Date(entitlement.expiresAt) < new Date());
      if (entitlement.status === 'SUSPENDED') {
        status = 'SUSPENDED';
      } else if (isExpired) {
        status = 'EXPIRED';
      } else if (entitlement.status === 'REVOKED') {
        status = 'REVOKED';
      } else if (entitlement.status === 'ACTIVE') {
        // 3. Installation state check
        if (installation) {
          if (activeRelease) {
            const semverDiff = compareSemVer(activeRelease.version, installation.installedVersion);
            if (semverDiff > 0) {
              status = 'UPDATE_AVAILABLE';
            } else {
              status = 'INSTALLED';
            }
          } else {
            status = 'INSTALLED';
          }
        } else {
          status = 'AVAILABLE'; // Entitled but not installed on this device yet
        }
      }
    }

    return {
      app,
      status,
      installedVersion: installation ? installation.installedVersion : null,
      entitlement: entitlement || null,
      installation: installation || null
    };
  });

  res.json(responseList);
});

// Get Pending Updates for installed apps
storeRouter.get('/updates', requireAuth, (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  if (!companyId) {
    res.status(400).json({ error: 'Contexto de empresa inválido.' });
    return;
  }

  const company = centralState.companies.get(companyId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const context = resolveDeviceContext(req, company);
  if ('error' in context) {
    res.status(403).json({ error: context.error });
    return;
  }
  const { deviceId, deviceOsVersion } = context;
  const channel = company.channel || 'stable';
  const updates: Record<string, unknown>[] = [];

  for (const app of centralState.apps) {
    const entitlementKey = `${companyId}:${app.id}`;
    const deviceInstallKey = `${companyId}:${deviceId}:${app.id}`;
    const legacyInstallKey = `${companyId}:${app.id}`;

    const entitlement: AppEntitlement | undefined = centralState.appEntitlements.get(entitlementKey);
    const installation: AppInstallation | undefined = centralState.appInstallations.get(deviceInstallKey) || centralState.appInstallations.get(legacyInstallKey);

    const activeRelease = getAuthoritativeReleaseForChannel(app.id, channel as 'stable' | 'beta') || app.currentRelease;

    const isEntitlementActive = entitlement && entitlement.status === 'ACTIVE' && 
                                (!entitlement.expiresAt || new Date(entitlement.expiresAt) >= new Date());

    if (isEntitlementActive && installation && activeRelease) {
      const releaseChannel = activeRelease.releaseChannel || 'stable';
      if (compareSemVer(activeRelease.version, installation.installedVersion) > 0) {
        const isCompatible = !activeRelease.minOsVersion || compareSemVer(deviceOsVersion, activeRelease.minOsVersion) >= 0;
        if (isCompatible) {
          updates.push({
            id: app.id,
            name: app.name,
            icon: app.icon,
            category: app.category,
            description: app.description,
            installedVersion: installation.installedVersion,
            newVersion: activeRelease.version,
            releaseChannel,
            changelog: 'Melhorias de segurança, usabilidade e estabilidade transacional.',
            checksum: activeRelease.checksum
          });
        }
      }
    }
  }

  res.json(updates);
});

// Install/Acquire app
storeRouter.post('/apps/:id/install', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  const appId = req.params['id'] as string;

  if (!companyId) {
    res.status(400).json({ error: 'Companhia inválida.' });
    return;
  }

  const company = centralState.companies.get(companyId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const appItem = centralState.apps.find(a => a.id === appId);
  if (!appItem) {
    res.status(404).json({ error: 'App não encontrado no catálogo.' });
    return;
  }

  if (appItem.lifecycle.status !== 'PUBLISHED' && !appItem.isSystemApp) {
    res.status(400).json({ error: 'Este aplicativo não está disponível para instalação.' });
    return;
  }

  const context = resolveDeviceContext(req, company);
  if ('error' in context) {
    res.status(403).json({ error: context.error });
    return;
  }
  const { deviceId, deviceOsVersion, channel } = context;

  // 1. Technical requirement check
  const activeRelease = getAuthoritativeReleaseForChannel(appId, channel as 'stable' | 'beta') || appItem.currentRelease;
  const releaseChannel = activeRelease?.releaseChannel || 'stable';
  if (channel === 'stable' && releaseChannel !== 'stable') {
    res.status(400).json({ error: `Este terminal está no canal 'stable' e não pode instalar releases 'beta'.` });
    return;
  }

  if (activeRelease?.minOsVersion && compareSemVer(deviceOsVersion, activeRelease.minOsVersion) < 0) {
    res.status(400).json({ error: `Incompatibilidade: Este aplicativo requer versão mínima ${activeRelease.minOsVersion} do 3eatcru OS.` });
    return;
  }

  // 2. Upfront entitlement status check
  const entitlementKeyCheck = `${companyId}:${appId}`;
  const existingEntitlement = centralState.appEntitlements.get(entitlementKeyCheck);
  if (existingEntitlement) {
    const isExpired = existingEntitlement.status === 'EXPIRED' || 
                      (existingEntitlement.status === 'ACTIVE' && existingEntitlement.expiresAt && new Date(existingEntitlement.expiresAt) < new Date());
    if (isExpired) {
      res.status(403).json({ error: `O direito de uso (entitlement) para este aplicativo está expirado.` });
      return;
    }
    if (existingEntitlement.status !== 'ACTIVE') {
      res.status(403).json({ error: `O direito de uso (entitlement) para este aplicativo não está ativo (Status: ${existingEntitlement.status}).` });
      return;
    }
  }

  // 3. Upfront billing validation check
  const isPaid = !existingEntitlement && (
    appItem.pricing?.model === 'ONE_TIME' || 
    appItem.pricing?.model === 'SUBSCRIPTION_MONTHLY' || 
    appItem.pricing?.model === 'SUBSCRIPTION_ANNUAL'
  ) && (appItem.pricing?.amount || 0) > 0;

  if (isPaid) {
    const cost = appItem.pricing.amount || 0;
    if (company.balance < cost) {
      res.status(402).json({ error: 'Saldo insuficiente para realizar a compra deste aplicativo.' });
      return;
    }
  }

  // 4. Authoritative Recursive Dependency Check
  const depCheck = checkDependenciesRecursive(appId, companyId, deviceId);
  if (!depCheck.success) {
    res.status(400).json({ 
      error: `Falha de dependência recursiva: Módulo '${appItem.name}' requer os seguintes módulos instalados neste terminal: ${depCheck.missing.join(', ')}.` 
    });
    return;
  }

  const companyChannel = company.channel || 'stable';
  const authoritativeRelease = getAuthoritativeReleaseForChannel(appId, companyChannel);
  const targetVersion = authoritativeRelease?.version || appItem.currentRelease?.version || '1.0.0';

  let result;
  try {
    result = centralDatabase.installStoreAppTransaction(companyId, deviceId, appId, appItem, targetVersion);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg === 'INSUFFICIENT_FUNDS') {
      res.status(402).json({ error: 'Saldo insuficiente para realizar a compra deste aplicativo.' });
      return;
    }
    if (errMsg.startsWith('ENTITLEMENT_INACTIVE:')) {
      const status = errMsg.split(':')[1];
      res.status(403).json({ error: `O direito de uso (entitlement) para este aplicativo não está ativo (Status: ${status}).` });
      return;
    }
    res.status(500).json({ error: `Falha ao processar transação no banco central: ${errMsg}` });
    return;
  }

  if (!result || !result.success) {
    res.status(500).json({ error: 'Falha ao processar instalação do aplicativo.' });
    return;
  }

  const entitlementKey = `${companyId}:${appId}`;
  const deviceInstallKey = `${companyId}:${deviceId}:${appId}`;

  if (result.ledgerEntry) {
    company.balance -= result.ledgerEntry.amount;
    const ledger = centralState.companyLedger.get(companyId) || [];
    ledger.unshift(result.ledgerEntry);
    centralState.companyLedger.set(companyId, ledger);
  }

  centralState.appEntitlements.set(entitlementKey, result.entitlement);
  centralState.appInstallations.set(deviceInstallKey, result.installation);

  if (!company.installedApps.includes(appId)) {
    company.installedApps.push(appId);
  }

  saveCentralState();

  res.json({
    success: true,
    status: 'INSTALLED',
    app: appItem,
    entitlement: result.entitlement,
    installation: result.installation,
    newBalance: company.balance
  });
});

// Update app to latest version
storeRouter.post('/apps/:id/update', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  const appId = req.params['id'] as string;

  if (!companyId) {
    res.status(400).json({ error: 'Contexto de empresa inválido.' });
    return;
  }

  const company = centralState.companies.get(companyId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const appItem = centralState.apps.find(a => a.id === appId);
  if (!appItem) {
    res.status(404).json({ error: 'App não encontrado no catálogo.' });
    return;
  }

  const context = resolveDeviceContext(req, company);
  if ('error' in context) {
    res.status(403).json({ error: context.error });
    return;
  }
  const { deviceId, deviceOsVersion, channel } = context;
  const entitlementKey = `${companyId}:${appId}`;
  const deviceInstallKey = `${companyId}:${deviceId}:${appId}`;
  const legacyInstallKey = `${companyId}:${appId}`;

  const entitlement = centralState.appEntitlements.get(entitlementKey);
  const installation = centralState.appInstallations.get(deviceInstallKey) || centralState.appInstallations.get(legacyInstallKey);

  if (!entitlement || entitlement.status !== 'ACTIVE') {
    res.status(403).json({ error: 'Acesso negado: Licença comercial inativa ou inexistente.' });
    return;
  }

  if (!installation) {
    res.status(404).json({ error: 'App não instalado no dispositivo.' });
    return;
  }

  const activeRelease = (getAuthoritativeReleaseForChannel(appId, channel as 'stable' | 'beta') || appItem.currentRelease) as {
    version: string;
    minOsVersion?: string;
    releaseChannel?: string;
    artifactId?: string;
    checksum?: string;
    releasedAt?: string;
  } | undefined;
  if (!activeRelease) {
    res.status(400).json({ error: 'Não há releases cadastradas para este app.' });
    return;
  }

  // 1. Technical Requirements Validation
  const releaseChannel = activeRelease.releaseChannel || 'stable';
  if (channel === 'stable' && releaseChannel !== 'stable') {
    res.status(400).json({ error: `Este terminal está no canal 'stable' e não pode atualizar para releases 'beta'.` });
    return;
  }

  if (activeRelease.minOsVersion && compareSemVer(deviceOsVersion, activeRelease.minOsVersion) < 0) {
    res.status(400).json({ error: `OS Incompatível: Atualização requer 3eatcru OS >= ${activeRelease.minOsVersion}.` });
    return;
  }

  // 2. Authoritative Recursive Dependency Check before updating
  const depCheck = checkDependenciesRecursive(appId, companyId, deviceId);
  if (!depCheck.success) {
    res.status(400).json({ 
      error: `Falha de dependência recursiva: Módulo '${appItem.name}' requer os seguintes módulos instalados neste terminal: ${depCheck.missing.join(', ')}.` 
    });
    return;
  }

  // 3. OTA Artifact Integrity Verification (Download & Checksum Stage)
  let artifactVerified = false;
  if (activeRelease.artifactId) {
    const artifact = centralDatabase.getAppArtifact(activeRelease.artifactId);
    if (!artifact) {
      res.status(500).json({ error: 'Falha de integridade OTA: pacote do artefato não encontrado no repositório de distribuição.' });
      return;
    }
    if (artifact.checksum.toLowerCase() !== (activeRelease.checksum || '').toLowerCase()) {
      res.status(500).json({ error: 'Falha de integridade OTA: o checksum SHA-256 do artefato não confere com o manifesto assinado da release.' });
      return;
    }
    artifactVerified = true;
  }

  // 4. Staged Activation
  installation.installedVersion = activeRelease.version;
  installation.updatedAt = new Date().toISOString();
  installation.deviceId = deviceId;
  installation.status = 'INSTALLED';

  centralDatabase.updateStoreAppTransaction(companyId, deviceId, appId, activeRelease.version);
  centralState.appInstallations.set(deviceInstallKey, installation);
  saveCentralState();

  res.json({
    success: true,
    otaStage: 'ACTIVATED',
    artifactVerified,
    installedVersion: installation.installedVersion,
    installation,
    release: {
      version: activeRelease.version,
      channel: activeRelease.releaseChannel || 'stable',
      artifactId: activeRelease.artifactId,
      checksum: activeRelease.checksum
    }
  });
});

// Uninstall app (removes device installation record but keeps Entitlement/License intact)
storeRouter.delete('/apps/:id', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  const appId = req.params['id'] as string;

  if (!companyId) {
    res.status(400).json({ error: 'Companhia inválida.' });
    return;
  }

  const company = centralState.companies.get(companyId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const context = resolveDeviceContext(req, company);
  if ('error' in context) {
    res.status(403).json({ error: context.error });
    return;
  }
  const { deviceId } = context;
  const entitlementKey = `${companyId}:${appId}`;
  const deviceInstallKey = `${companyId}:${deviceId}:${appId}`;
  const legacyInstallKey = `${companyId}:${appId}`;
  
  // Remove the installation record
  const removedDevice = centralState.appInstallations.delete(deviceInstallKey);
  const removedLegacy = centralState.appInstallations.delete(legacyInstallKey);
  centralDatabase.uninstallStoreAppTransaction(companyId, deviceId, appId);
  
  // Sync with legacy cache array: only remove if no other device has this app installed
  const hasOtherInstallations = Array.from(centralState.appInstallations.values()).some(inst => 
    inst.companyId === companyId && inst.appId === appId && inst.deviceId !== deviceId
  );
  if (!hasOtherInstallations) {
    const idx = company.installedApps.indexOf(appId);
    if (idx !== -1) {
      company.installedApps.splice(idx, 1);
    }
  }

  saveCentralState();

  res.json({
    success: true,
    removedFromDevice: removedDevice || removedLegacy,
    licenseIntact: centralState.appEntitlements.has(entitlementKey)
  });
});

// Download artifact by artifactId
storeRouter.get('/artifacts/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const artifactId = req.params['id'] as string;
  if (!artifactId) {
    res.status(400).json({ error: 'ID de artefato inválido.' });
    return;
  }
  const artifact = centralDatabase.getAppArtifact(artifactId);
  if (!artifact) {
    res.status(404).json({ error: 'Artefato não encontrado.' });
    return;
  }

  // C-05 / A22-07: Authorization and Release Verification check
  // HQ Admin has global access to all artifacts.
  // Tenants can only download artifacts for apps they have an ACTIVE entitlement for,
  // matching active release channel, published status, and compliant device identity.
  if (req.user?.role !== 'hq_admin') {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ error: 'Acesso negado: contexto de empresa ausente.' });
      return;
    }
    const entitlementKey = getEntitlementKey(companyId, artifact.appId);
    const entitlement = centralState.appEntitlements.get(entitlementKey);
    if (!entitlement || entitlement.status !== 'ACTIVE') {
      res.status(403).json({ error: 'Acesso negado: o tenant não possui licença comercial ativa (Entitlement) para este aplicativo.' });
      return;
    }
    if (entitlement.expiresAt && new Date(entitlement.expiresAt).getTime() < Date.now()) {
      res.status(403).json({ error: 'Acesso negado: licença de assinatura expirada para este aplicativo.' });
      return;
    }

    // A22-07: Verify release lifecycle status and channel compliance
    const release = centralDatabase.getReleaseByArtifactId(artifactId);
    if (release) {
      if (release.status !== 'PUBLISHED') {
        res.status(403).json({ error: `Acesso negado: a release deste artefato não está publicada (status: ${release.status}).` });
        return;
      }
      const company = centralState.companies.get(companyId);
      const tenantChannel = company?.channel || 'stable';
      if (tenantChannel === 'stable' && release.channel === 'beta') {
        res.status(403).json({ error: 'Acesso negado: artefato pertencente ao canal beta não está autorizado para tenants no canal estável.' });
        return;
      }
    }

    // A22-07: Validate device status if provided
    const deviceId = (req.headers['x-device-id'] as string) || (req.query['deviceId'] as string);
    if (deviceId) {
      const device = centralDatabase.getDevice(companyId, deviceId);
      if (device && (device.status === 'BLOCKED' || device.status === 'PENDING')) {
        res.status(403).json({ error: `Acesso negado: terminal ${device.status.toLowerCase()} não pode receber binários.` });
        return;
      }
    }
  }

  res.json({
    id: artifact.id,
    appId: artifact.appId,
    version: artifact.version,
    checksum: artifact.checksum,
    artifactBase64: artifact.artifactBase64
  });
});
