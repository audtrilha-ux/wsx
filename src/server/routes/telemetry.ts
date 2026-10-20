import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { centralState, saveCentralState, recordHqAuditLog, TelemetryReport, OsReleaseData } from '../state.js';
import { requireHqAdmin, requireTenant, AuthenticatedRequest, validateBody } from '../middleware.js';
import { centralDatabase } from '../db/central-db.js';

export const telemetryRouter = Router();

const TelemetryReportDtoSchema = z.object({
  overallStatus: z.enum(['healthy', 'warning', 'critical']).optional(),
  checks: z.array(z.object({
    subsystem: z.string(),
    status: z.enum(['healthy', 'warning', 'critical']),
    details: z.string()
  })).optional(),
  platform: z.string().optional(),
  version: z.string().optional(),
  companyName: z.string().optional(),
  deviceId: z.string().optional()
});

const PublishOsReleaseDtoSchema = z.object({
  id: z.string().optional(),
  version: z.string().min(1, 'version is required'),
  channel: z.enum(['stable', 'beta']),
  changelog: z.union([z.string().min(1), z.array(z.string()).min(1)]),
  releaseNotes: z.array(z.string()).optional(),
  minRequiredByApps: z.string().optional(),
  minCoreVersion: z.string().optional(),
  minOsVersion: z.string().optional(),
  status: z.string().optional(),
  mandatory: z.boolean().optional(),
  isMandatory: z.boolean().optional(),
  checksum: z.string().optional()
});

const RolloutOsReleaseDtoSchema = z.object({
  version: z.string().min(1, 'version is required'),
  channel: z.string().optional(),
  targetCompanyId: z.string().optional()
});

const RollbackOsReleaseDtoSchema = z.object({
  targetCompanyId: z.string().optional(),
  targetVersion: z.string().optional()
});

// Public minimal Heartbeat endpoint (unauthenticated)
telemetryRouter.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// GET /telemetry/system - Real-time container metrics for Client OS (Task Manager)
telemetryRouter.get('/telemetry/system', requireTenant, (_req, res) => {
  const memUsage = process.memoryUsage();
  const heapUsedMb = Math.round(memUsage.heapUsed / 1024 / 1024);
  const totalMemMb = Math.round(memUsage.heapTotal / 1024 / 1024);
  
  const cpu = process.cpuUsage();
  const uptime = process.uptime();
  const totalCpuTimeUs = cpu.user + cpu.system;
  const totalUptimeUs = uptime * 1000 * 1000;
  const cpuPercent = totalUptimeUs > 0 ? Math.min(100, Math.round((totalCpuTimeUs / totalUptimeUs) * 100)) : 1;

  res.json({
    success: true,
    cpuUsage: Math.max(2, Math.min(99, cpuPercent)),
    memoryUsedMb: Math.max(20, heapUsedMb),
    memoryTotalMb: Math.max(totalMemMb, 128),
    uptime: Math.round(uptime)
  });
});

// Protected HQ Detailed Health endpoint
telemetryRouter.get('/hq/health', requireHqAdmin, (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version,
    osPlatform: process.platform,
    kernelVersion: '3eatcru-kernel-v1.1.0',
    stats: {
      companiesTotal: centralState.companies.size,
      devicesTotal: centralState.devices.size,
      appsTotal: centralState.apps.length
    }
  });
});

// Telemetry report intake from Client OS terminals (alias /telemetry/report and /telemetry/:companyId)
telemetryRouter.post(['/telemetry/report', '/telemetry/:companyId'], requireTenant, validateBody(TelemetryReportDtoSchema), (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const companyId = (req.params['companyId'] as string) || req.user.companyId;
  const { overallStatus, checks, platform, version, companyName, deviceId } = req.body;

  const checkList: { subsystem: string; status: 'healthy' | 'warning' | 'critical'; details: string }[] = Array.isArray(checks) ? checks : [];
  
  // Calculate server-authoritative health from check list
  let centralCalculatedHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (checkList.some(c => c.status === 'critical')) {
    centralCalculatedHealth = 'critical';
  } else if (checkList.some(c => c.status === 'warning')) {
    centralCalculatedHealth = 'warning';
  }

  const clientReportedStatus: 'healthy' | 'warning' | 'critical' = overallStatus || 'healthy';

  const report: TelemetryReport = {
    companyId: companyId || req.user.companyId || 'comp_unknown',
    companyName: companyName || req.user.name || 'Terminal Local',
    deviceId: deviceId || 'dev_primary',
    timestamp: new Date().toISOString(),
    overallStatus: centralCalculatedHealth,
    clientReportedStatus,
    centralCalculatedHealth,
    checks: checkList,
    platform: platform || 'web',
    version: version || '1.1.0-lts'
  };

  // Key per-device: companyId:deviceId to avoid overwriting reports from multiple terminals
  const telemetryKey = deviceId ? `${report.companyId}:${deviceId}` : report.companyId;
  centralDatabase.saveTelemetryTransaction(report);
  centralState.telemetry.set(telemetryKey, report);

  // If deviceId provided, update device record
  if (deviceId && centralState.devices.has(deviceId)) {
    const dev = centralState.devices.get(deviceId)!;
    dev.lastSeenAt = new Date().toISOString();
    dev.osVersion = version || dev.osVersion;
    dev.status = centralCalculatedHealth === 'critical' ? 'blocked' : 'active';
    centralState.devices.set(deviceId, dev);
  }

  // Atomic SQLite transaction handled by saveTelemetryTransaction above without full-database rewrite

  res.json({ success: true, timestamp: report.timestamp, centralCalculatedHealth });
});

// HQ Telemetry dashboard (both /telemetry and /telemetry/all)
telemetryRouter.get(['/telemetry', '/telemetry/all'], requireHqAdmin, (_req, res) => {
  res.json(Array.from(centralState.telemetry.values()));
});

// OS Releases catalog (support both /releases, /distribution/os-releases, and /os-releases)
telemetryRouter.get(['/releases', '/distribution/os-releases', '/os-releases'], (req, res) => {
  const channelQuery = (req.query['channel'] as string | undefined)?.toLowerCase();

  // Normalize releases so that all clients receive both array and string representations
  const normalized = centralState.osReleases
    .filter(r => !channelQuery || r.channel === channelQuery)
    .map(r => {
      const rawChangelog = r.changelog || '';
      const notesArray = Array.isArray(r.releaseNotes) && r.releaseNotes.length > 0
        ? r.releaseNotes
        : (typeof rawChangelog === 'string' && rawChangelog.includes('\n')
          ? rawChangelog.split('\n').filter(Boolean)
          : [rawChangelog].filter(Boolean));
      
      const checksum = r.checksum || crypto.createHash('sha256').update(`${r.version}_${r.channel}_${rawChangelog}`).digest('hex');

      return {
        id: r.id || `rel_${r.version.replace(/[^a-zA-Z0-9]/g, '_')}`,
        version: r.version,
        channel: r.channel,
        releaseDate: r.releaseDate,
        status: r.status,
        changelog: notesArray,
        changelogText: typeof rawChangelog === 'string' ? rawChangelog : notesArray.join('\n'),
        releaseNotes: notesArray,
        minRequiredByApps: r.minRequiredByApps || '1.0.0',
        minCoreVersion: r.minRequiredByApps || '1.0.0',
        minOsVersion: r.minRequiredByApps || '1.0.0',
        mandatory: Boolean(r.mandatory),
        isMandatory: Boolean(r.mandatory),
        checksum,
        publishedAt: r.publishedAt || r.releaseDate
      };
    });

  res.json(normalized);
});

// POST /distribution/os-releases - Publish new OS release (HQ Admin only)
telemetryRouter.post('/distribution/os-releases', requireHqAdmin, validateBody(PublishOsReleaseDtoSchema), (req: AuthenticatedRequest, res) => {
  const { version, channel, changelog, minRequiredByApps, minCoreVersion, minOsVersion, status, mandatory, isMandatory, checksum } = req.body;

  const rawChangelog = changelog;
  const changelogStr = typeof rawChangelog === 'string' ? rawChangelog : (Array.isArray(rawChangelog) ? rawChangelog.join('\n') : '');
  const changelogArr = Array.isArray(rawChangelog) ? rawChangelog : (typeof rawChangelog === 'string' ? rawChangelog.split('\n').filter(Boolean) : []);
  const minRequired = minRequiredByApps || minCoreVersion || minOsVersion || '1.0.0';
  const mandatoryFlag = Boolean(mandatory ?? isMandatory);

  const existingIdx = centralState.osReleases.findIndex(r => r.version === version);
  const contentToHash = `${version}_${channel}_${changelogStr}`;
  const computedChecksum = crypto.createHash('sha256').update(contentToHash).digest('hex');

  const releaseData: OsReleaseData = {
    id: req.body.id || `rel_${version.replace(/[^a-zA-Z0-9]/g, '_')}`,
    version,
    channel: channel === 'beta' ? 'beta' : 'stable',
    releaseDate: new Date().toISOString().split('T')[0] || '2026-09-15',
    status: status || 'active',
    changelog: changelogStr,
    minRequiredByApps: minRequired,
    mandatory: mandatoryFlag,
    checksum: checksum || computedChecksum,
    releaseNotes: changelogArr,
    publishedAt: new Date().toISOString(),
    releaseChannel: channel === 'beta' ? 'beta' : 'stable'
  };

  if (existingIdx >= 0) {
    centralState.osReleases[existingIdx] = releaseData;
  } else {
    centralState.osReleases.unshift(releaseData);
  }

  // Transactional persistence directly to SQLite
  centralDatabase.upsertOsReleaseTransaction(releaseData);

  recordHqAuditLog({
    hqAdminId: req.user?.id || 'hq_admin',
    hqAdminEmail: req.user?.email || 'hq@3eatcru.com',
    action: 'PUBLISH_OS_RELEASE',
    details: `Release do OS '${version}' publicada no canal '${channel}' (Mandatory: ${mandatoryFlag}).`
  });

  saveCentralState();
  res.status(201).json({ success: true, release: releaseData });
});

// Distribution OTA rollout
telemetryRouter.post('/distribution/rollout-os', requireHqAdmin, validateBody(RolloutOsReleaseDtoSchema), (req: AuthenticatedRequest, res) => {
  const { version, channel, targetCompanyId } = req.body;

  if (targetCompanyId) {
    const comp = centralState.companies.get(targetCompanyId);
    if (comp) {
      comp.osTargetVersion = version;
      if (channel) comp.channel = channel;
      centralState.companies.set(targetCompanyId, comp);
      centralDatabase.updateTenantEntitlementsTransaction(targetCompanyId, { osTargetVersion: version, channel: comp.channel });
    }
  } else {
    for (const [id, comp] of centralState.companies.entries()) {
      if (!channel || comp.channel === channel) {
        comp.osTargetVersion = version;
        centralState.companies.set(id, comp);
        centralDatabase.updateTenantEntitlementsTransaction(id, { osTargetVersion: version, channel: comp.channel });
      }
    }
  }

  recordHqAuditLog({
    hqAdminId: req.user?.id || 'hq_admin',
    hqAdminEmail: req.user?.email || 'hq@3eatcru.com',
    action: 'ROLLOUT_OS_RELEASE',
    targetCompanyId,
    details: `Rollout da versão '${version}' (Canal: ${channel || 'todos'}, Alvo: ${targetCompanyId || 'global'}).`
  });

  saveCentralState();
  res.json({ success: true, version, channel, targetCompanyId });
});

// Distribution OTA rollback
telemetryRouter.post('/distribution/rollback-os', requireHqAdmin, validateBody(RollbackOsReleaseDtoSchema), (req: AuthenticatedRequest, res) => {
  const { targetCompanyId, targetVersion } = req.body;
  const fallbackVersion = targetVersion || '1.1.0-lts';

  if (targetCompanyId) {
    const comp = centralState.companies.get(targetCompanyId);
    if (comp) {
      comp.osTargetVersion = fallbackVersion;
      centralState.companies.set(targetCompanyId, comp);
      centralDatabase.updateTenantEntitlementsTransaction(targetCompanyId, { osTargetVersion: fallbackVersion });
    }
  } else {
    for (const [id, comp] of centralState.companies.entries()) {
      comp.osTargetVersion = fallbackVersion;
      centralState.companies.set(id, comp);
      centralDatabase.updateTenantEntitlementsTransaction(id, { osTargetVersion: fallbackVersion });
    }
  }

  recordHqAuditLog({
    hqAdminId: req.user?.id || 'hq_admin',
    hqAdminEmail: req.user?.email || 'hq@3eatcru.com',
    action: 'ROLLBACK_OS_RELEASE',
    targetCompanyId,
    details: `Rollback do OS para a versão '${fallbackVersion}' (Alvo: ${targetCompanyId || 'global'}).`
  });

  saveCentralState();
  res.json({ success: true, fallbackVersion, targetCompanyId });
});

