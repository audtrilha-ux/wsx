import { Router, Response } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { centralState, saveCentralState, AppCatalogItem, recordHqAuditLog } from '../state.js';
import { requireHqAdmin, AuthenticatedRequest, validateBody } from '../middleware.js';
import { parseSemVer } from '../semver.js';
import { centralDatabase } from '../db/central-db.js';

export const hqAppsRouter = Router();

const CreateAppCatalogDtoSchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  developer: z.string().optional(),
  publisher: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
  pricing: z.object({
    model: z.enum(['FREE', 'ONE_TIME', 'SUBSCRIPTION_MONTHLY', 'SUBSCRIPTION_ANNUAL', 'USAGE_BASED']),
    amount: z.number().nonnegative().optional(),
    currency: z.string().optional()
  }).optional(),
  lifecycle: z.object({
    status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'SUSPENDED', 'RETIRED']).optional()
  }).optional(),
  currentRelease: z.object({
    version: z.string(),
    minOsVersion: z.string().optional(),
    releaseChannel: z.enum(['stable', 'beta']).optional(),
    checksum: z.string().optional(),
    releasedAt: z.string().optional()
  }).optional(),
  permissions: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  dependencies: z.array(z.object({
    id: z.string().min(1),
    versionRange: z.string().min(1)
  })).optional(),
  isSystemApp: z.boolean().optional()
});

const PatchAppStatusDtoSchema = z.object({
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'SUSPENDED', 'RETIRED', 'draft', 'in_review', 'approved', 'published', 'suspended', 'retired'])
});

const PatchAppPricingDtoSchema = z.object({
  pricing: z.object({
    model: z.enum(['FREE', 'ONE_TIME', 'SUBSCRIPTION_MONTHLY', 'SUBSCRIPTION_ANNUAL', 'USAGE_BASED']),
    amount: z.number().nonnegative().optional(),
    currency: z.string().optional()
  })
});

const PostAppReleaseDtoSchema = z.object({
  release: z.object({
    version: z.string().min(1, 'version is required'),
    minOsVersion: z.string().optional(),
    releaseChannel: z.enum(['stable', 'beta']).optional(),
    checksum: z.string().optional(),
    artifactBase64: z.string().optional()
  })
});

const PatchAppMetadataDtoSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().optional()
});

// Formal App Lifecycle State Machine Definition
const VALID_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  'DRAFT': ['IN_REVIEW', 'RETIRED'],
  'IN_REVIEW': ['APPROVED', 'DRAFT', 'REJECTED'],
  'APPROVED': ['PUBLISHED', 'DRAFT', 'RETIRED'],
  'PUBLISHED': ['SUSPENDED', 'RETIRED', 'APPROVED'],
  'SUSPENDED': ['PUBLISHED', 'RETIRED', 'DRAFT'],
  'REJECTED': ['DRAFT', 'IN_REVIEW'],
  'RETIRED': ['DRAFT']
};

// List all apps in the catalog
hqAppsRouter.get('/', requireHqAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json(centralState.apps);
});

// Retrieve details of a single app
hqAppsRouter.get('/:id', requireHqAdmin, (req: AuthenticatedRequest, res: Response) => {
  const appItem = centralState.apps.find(a => a.id === req.params['id']);
  if (appItem) {
    res.json(appItem);
  } else {
    res.status(404).json({ error: 'Aplicativo não encontrado no catálogo.' });
  }
});

function isAppExecutableRegistered(appId: string): boolean {
  const CORE_APPS = [
    'app_pos', 'app_inventory', 'app_crm', 'app_finance',
    'app_tables', 'app_public_space', 'app_whatsapp', 'app_telegram', 'app_ifood'
  ];
  if (CORE_APPS.includes(appId)) return true;

  // Check if app has registered releases with artifacts in central store or database
  const releases = centralDatabase.getAppReleases(appId);
  if (releases && releases.length > 0) return true;

  const artifacts = centralDatabase.getAppArtifactsByAppId(appId);
  if (artifacts && artifacts.length > 0) return true;

  return false;
}

// Create new app in catalog with audit logging
hqAppsRouter.post('/', requireHqAdmin, validateBody(CreateAppCatalogDtoSchema), (req: AuthenticatedRequest, res: Response) => {
  const body = req.body;

  if (centralState.apps.some(a => a.id === body.id)) {
    res.status(409).json({ error: `Aplicativo com ID '${body.id}' já existe no catálogo.` });
    return;
  }

  const newAppStatus = (body.lifecycle?.status || 'DRAFT').toUpperCase();
  if (newAppStatus === 'PUBLISHED' && !isAppExecutableRegistered(body.id)) {
    res.status(400).json({ error: `Não é possível publicar diretamente o aplicativo '${body.id}'. Ele não possui uma implementação registrada no Runtime do Client OS nem artefatos de release.` });
    return;
  }

  const newApp: AppCatalogItem = {
    id: body.id,
    name: body.name,
    description: body.description || '',
    developer: body.developer || '3eatcru',
    publisher: body.publisher,
    category: body.category || 'misc',
    icon: body.icon || 'apps',
    pricing: body.pricing || { model: 'FREE', amount: 0, currency: 'BRL' },
    lifecycle: body.lifecycle || { status: 'DRAFT' },
    currentRelease: body.currentRelease,
    permissions: body.permissions || [],
    capabilities: body.capabilities || [],
    dependencies: body.dependencies || [],
    isSystemApp: !!body.isSystemApp
  };

  centralDatabase.upsertAppCatalogItemTransaction(newApp);
  centralState.apps.push(newApp);

  // Record audit log
  if (req.user) {
    recordHqAuditLog({
      hqAdminId: req.user.id,
      hqAdminEmail: req.user.email,
      action: 'APP_CATALOG_CREATE',
      details: `Cadastrou o aplicativo '${newApp.name}' (${newApp.id}) no catálogo central.`,
      newValue: newApp
    });
  }

  saveCentralState();
  res.status(201).json(newApp);
});

// PATCH status: Strict lifecycle state machine transition
hqAppsRouter.patch('/:id/status', requireHqAdmin, validateBody(PatchAppStatusDtoSchema), (req: AuthenticatedRequest, res: Response) => {
  const idx = centralState.apps.findIndex(a => a.id === req.params['id']);
  if (idx === -1) {
    res.status(404).json({ error: 'Aplicativo não encontrado.' });
    return;
  }

  const currentStatus = centralState.apps[idx].lifecycle.status || 'DRAFT';
  const newStatus = (req.body.status as string).toUpperCase();

  const allowedTransitions = VALID_LIFECYCLE_TRANSITIONS[currentStatus] || ['DRAFT'];
  if (currentStatus !== newStatus && !allowedTransitions.includes(newStatus)) {
    res.status(400).json({
      error: `Transição de ciclo de vida inválida: '${currentStatus}' -> '${newStatus}'. Transições permitidas: ${allowedTransitions.join(', ')}`
    });
    return;
  }

  if (newStatus === 'PUBLISHED') {
    const app = centralState.apps[idx];
    if (!isAppExecutableRegistered(app.id)) {
      res.status(400).json({
        error: `Não é possível publicar o aplicativo '${app.id}'. Ele não possui uma implementação registrada no Runtime do Client OS nem artefatos de release.`
      });
      return;
    }
  }

  const previousValue = { status: currentStatus };
  const newValue = { status: newStatus };

  centralState.apps[idx].lifecycle.status = newStatus as 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'SUSPENDED' | 'RETIRED';

  // Record audit log
  if (req.user) {
    recordHqAuditLog({
      hqAdminId: req.user.id,
      hqAdminEmail: req.user.email,
      action: 'APP_CATALOG_PATCH_STATUS',
      details: `Alterou status do aplicativo '${centralState.apps[idx].name}' (${centralState.apps[idx].id}) de '${currentStatus}' para '${newStatus}'.`,
      previousValue,
      newValue
    });
  }

  centralDatabase.upsertAppCatalogItemTransaction(centralState.apps[idx]);
  saveCentralState();
  res.json(centralState.apps[idx]);
});

// PATCH pricing: Granular commercial model modification
hqAppsRouter.patch('/:id/pricing', requireHqAdmin, validateBody(PatchAppPricingDtoSchema), (req: AuthenticatedRequest, res: Response) => {
  const idx = centralState.apps.findIndex(a => a.id === req.params['id']);
  if (idx === -1) {
    res.status(404).json({ error: 'Aplicativo não encontrado.' });
    return;
  }

  const pricing = req.body.pricing;

  const previousValue = { pricing: { ...centralState.apps[idx].pricing } };
  const newValue = { pricing: { ...pricing } };

  centralState.apps[idx].pricing = {
    model: pricing.model,
    amount: pricing.amount || 0,
    currency: pricing.currency || 'BRL'
  };

  // Record audit log
  if (req.user) {
    recordHqAuditLog({
      hqAdminId: req.user.id,
      hqAdminEmail: req.user.email,
      action: 'APP_CATALOG_PATCH_PRICING',
      details: `Alterou precificação do aplicativo '${centralState.apps[idx].name}' (${centralState.apps[idx].id}) para '${pricing.model}' (R$ ${pricing.amount || 0}).`,
      previousValue,
      newValue
    });
  }

  centralDatabase.upsertAppCatalogItemTransaction(centralState.apps[idx]);
  saveCentralState();
  res.json(centralState.apps[idx]);
});

// POST releases: Granular release creation with SemVer validation and SHA-256 integrity checksum
hqAppsRouter.post('/:id/releases', requireHqAdmin, validateBody(PostAppReleaseDtoSchema), (req: AuthenticatedRequest, res: Response) => {
  const idx = centralState.apps.findIndex(a => a.id === req.params['id']);
  if (idx === -1) {
    res.status(404).json({ error: 'Aplicativo não encontrado.' });
    return;
  }

  const release = req.body.release;

  const parsedSemVer = parseSemVer(release.version);
  if (!parsedSemVer) {
    res.status(400).json({ error: `Versão de release inválida: '${release.version}'. Deve seguir o padrão SemVer 2.0.0 (ex: 1.0.0).` });
    return;
  }

  if (release.minOsVersion && !parseSemVer(release.minOsVersion)) {
    res.status(400).json({ error: `Versão mínima de OS inválida: '${release.minOsVersion}'. Deve seguir o padrão SemVer (ex: 2.0.0).` });
    return;
  }

  // Determine artifact bytes and calculate authoritative SHA-256 checksum
  let artifactBase64 = release.artifactBase64;
  let artifactBuffer: Buffer;
  const isProduction = process.env['NODE_ENV'] === 'production';

  if (artifactBase64) {
    try {
      artifactBuffer = Buffer.from(artifactBase64, 'base64');
    } catch {
      artifactBuffer = Buffer.from(artifactBase64, 'utf-8');
    }
  } else {
    if (isProduction) {
      res.status(400).json({ 
        error: 'Em ambiente de produção, o pacote binário do artefato (artifactBase64) é estritamente obrigatório para publicar uma release.' 
      });
      return;
    }
    const simulatedBundle = {
      appId: centralState.apps[idx].id,
      version: release.version,
      minOsVersion: release.minOsVersion || '1.0.0',
      channel: release.releaseChannel || 'stable',
      compiledAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(simulatedBundle);
    artifactBase64 = Buffer.from(jsonStr).toString('base64');
    artifactBuffer = Buffer.from(jsonStr, 'utf-8');
  }

  // Calculate authoritative SHA-256 hash of the artifact
  const calculatedChecksum = createHash('sha256').update(artifactBuffer).digest('hex');

  // C-06: If client provided a checksum, verify that it strictly matches
  if (release.checksum && release.checksum.toLowerCase() !== calculatedChecksum.toLowerCase()) {
    res.status(400).json({ 
      error: `Inconsistência de integridade: o checksum fornecido (${release.checksum}) não corresponde ao SHA-256 autêntico do artefato (${calculatedChecksum}).` 
    });
    return;
  }

  const checksum = calculatedChecksum;

  const artifactId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  centralDatabase.addAppArtifact(
    artifactId,
    centralState.apps[idx].id,
    release.version,
    checksum,
    artifactBase64
  );

  const previousValue = centralState.apps[idx].currentRelease 
    ? { currentRelease: { ...centralState.apps[idx].currentRelease } }
    : undefined;

  const newValue = {
    version: release.version,
    minOsVersion: release.minOsVersion || '1.0.0',
    releaseChannel: release.releaseChannel || 'stable',
    checksum,
    releasedAt: new Date().toISOString()
  };

  // H-03: Only stable channel updates the main catalog currentRelease
  if ((release.releaseChannel || 'stable') === 'stable') {
    centralState.apps[idx].currentRelease = newValue;
  }

  centralDatabase.addAppReleaseTransaction({
    appId: centralState.apps[idx].id,
    version: release.version,
    channel: release.releaseChannel || 'stable',
    minOsVersion: release.minOsVersion || '1.0.0',
    artifactId: artifactId,
    checksum,
    signature: null,
    releasedAt: newValue.releasedAt,
    status: 'PUBLISHED'
  });

  // Record audit log
  if (req.user) {
    recordHqAuditLog({
      hqAdminId: req.user.id,
      hqAdminEmail: req.user.email,
      action: 'APP_CATALOG_POST_RELEASE',
      details: `Injetou e ativou nova release 'v${release.version}' (${release.releaseChannel || 'stable'}) para o aplicativo '${centralState.apps[idx].name}' com integridade SHA-256: ${checksum.slice(0, 12)}...`,
      previousValue,
      newValue
    });
  }

  centralDatabase.upsertAppCatalogItemTransaction(centralState.apps[idx]);
  saveCentralState();
  res.json(centralState.apps[idx]);
});

// PATCH metadata: Granular modifications to naming, descriptions and categories
hqAppsRouter.patch('/:id/metadata', requireHqAdmin, validateBody(PatchAppMetadataDtoSchema), (req: AuthenticatedRequest, res: Response) => {
  const idx = centralState.apps.findIndex(a => a.id === req.params['id']);
  if (idx === -1) {
    res.status(404).json({ error: 'Aplicativo não encontrado.' });
    return;
  }

  const body = req.body;
  const previousValue = {
    name: centralState.apps[idx].name,
    description: centralState.apps[idx].description,
    category: centralState.apps[idx].category,
    icon: centralState.apps[idx].icon
  };

  if (body.name) centralState.apps[idx].name = body.name;
  if (body.description) centralState.apps[idx].description = body.description;
  if (body.category) centralState.apps[idx].category = body.category;
  if (body.icon) centralState.apps[idx].icon = body.icon;

  const newValue = {
    name: centralState.apps[idx].name,
    description: centralState.apps[idx].description,
    category: centralState.apps[idx].category,
    icon: centralState.apps[idx].icon
  };

  // Record audit log
  if (req.user) {
    recordHqAuditLog({
      hqAdminId: req.user.id,
      hqAdminEmail: req.user.email,
      action: 'APP_CATALOG_PATCH_METADATA',
      details: `Atualizou os metadados descritivos de '${centralState.apps[idx].name}' (${centralState.apps[idx].id}).`,
      previousValue,
      newValue
    });
  }

  centralDatabase.upsertAppCatalogItemTransaction(centralState.apps[idx]);
  saveCentralState();
  res.json(centralState.apps[idx]);
});
