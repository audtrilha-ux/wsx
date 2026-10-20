import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { centralState, saveCentralState, CompanyData, TenantUserData, PlanDefinition, centralDatabase, recordHqAuditLog } from '../state.js';
import { hashPassword } from '../config.js';
import { getClientIp } from '../middleware.js';

export const onboardingRouter = Router();

// Rate limiting in-memory store for public onboarding endpoint
const onboardingIpTracker = new Map<string, { count: number; firstSeen: number }>();

const onboardingSchema = z.object({
  name: z.string().optional(),
  companyName: z.string().optional(),
  adminEmail: z.string().email('E-mail corporativo válido é obrigatório para o cadastro.'),
  whatsapp: z.string().min(8, 'Número de WhatsApp corporativo é obrigatório para contato.'),
  password: z.string().min(6, 'A senha administrativa deve conter no mínimo 6 caracteres.'),
  pin: z.string().regex(/^\d{4,6}$/, 'O PIN do terminal é obrigatório e deve ter entre 4 e 6 dígitos numéricos.'),
  segment: z.string().optional()
}).refine(data => {
  const comp = (data.companyName || data.name)?.trim();
  return !!comp && comp.length >= 3;
}, {
  message: 'O nome da empresa deve conter pelo menos 3 caracteres.',
  path: ['companyName']
});

onboardingRouter.post('/provision', (req, res) => {
  const clientIp = getClientIp(req);
  const now = Date.now();
  const track = onboardingIpTracker.get(clientIp) || { count: 0, firstSeen: now };

  // Reset window every 15 minutes
  if (now - track.firstSeen > 15 * 60 * 1000) {
    track.count = 0;
    track.firstSeen = now;
  }

  track.count += 1;
  onboardingIpTracker.set(clientIp, track);

  if (track.count > 5) {
    res.status(429).json({ success: false, error: 'Muitas tentativas de provisionamento. Por segurança, aguarde 15 minutos.' });
    return;
  }

  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Dados de provisionamento inválidos.';
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  const { name, companyName, adminEmail, whatsapp, password, pin, segment } = parsed.data;
  const targetName = (companyName || name)!.trim();
  const email = adminEmail.trim();
  const phone = whatsapp.trim();
  const rawPin = pin.trim();
  const rawPassword = password.trim();
  const businessSegment = segment?.trim() || 'geral';

  // Check if company name is already registered to prevent duplicates/slug collisions
  for (const c of centralState.companies.values()) {
    if (c.name.toLowerCase() === targetName.toLowerCase()) {
      res.status(409).json({ success: false, error: 'Já existe uma empresa registrada com este nome corporativo.' });
      return;
    }
  }

  // Check if email is already registered in any company
  for (const users of centralState.companyUsers.values()) {
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      res.status(409).json({ success: false, error: 'Este e-mail já está cadastrado em um workspace corporativo.' });
      return;
    }
  }

  // Generate unique company ID
  const newId = `comp_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
  
  // HQ Policy: All self-service on-boardings enter a standard 7-day PRO trial with 0 initial balance debt
  const selectedPlan = 'pro';
  const planDef = centralState.plans.find((p: PlanDefinition) => p.id === selectedPlan);

  const initialApps = planDef 
    ? [...planDef.includedApps]
    : ['app_settings', 'app_pos', 'app_inventory', 'app_public_space', 'app_crm', 'app_finance', 'app_tables'];

  const trialDays = 7;
  const expirationDate = new Date(Date.now() + trialDays * 24 * 3600 * 1000).toISOString().split('T')[0];

  const newCompany: CompanyData = {
    id: newId,
    name: targetName,
    balance: 0, // Balance is strictly managed by Central Billing / HQ, never chosen by client
    installedApps: initialApps,
    status: 'active',
    plan: selectedPlan,
    maxTerminals: planDef ? planDef.maxTerminals : 5,
    activeTerminals: 1,
    channel: 'stable',
    osTargetVersion: '1.1.0-lts',
    licenseExpiresAt: expirationDate,
    branches: [
      {
        id: `br_${newId}_1`,
        companyId: newId,
        name: 'Matriz Principal',
        address: 'Endereço Comercial Cadastrado no Onboarding',
        phone: phone,
        isActive: true
      }
    ]
  };

  const hashedPin = hashPassword(rawPin);
  const hashedPassword = hashPassword(rawPassword);

  const adminUser: TenantUserData = {
    id: `usr_${newId}_admin`,
    companyId: newId,
    name: `Administrador (${targetName})`,
    email: email,
    pin: hashedPin,
    password: hashedPassword,
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  // Run SQLite transactional provision
  const result = centralDatabase.provisionCompanyTransaction(newCompany, adminUser, trialDays, businessSegment);
  if (!result.success) {
    res.status(result.code).json({ success: false, error: result.message });
    return;
  }

  const data = result.data!;

  // Sincroniza o centralState em memória com as mutações atômicas persistidas no SQLite
  centralState.companies.set(newId, data.company);
  centralState.companyUsers.set(newId, [data.adminUser]);

  const ledgerList = centralState.companyLedger.get(newId) || [];
  ledgerList.push(data.ledgerEntry);
  centralState.companyLedger.set(newId, ledgerList);

  recordHqAuditLog({
    hqAdminId: 'system_onboarding',
    hqAdminEmail: email,
    action: 'CREATE_TENANT',
    targetCompanyId: newId,
    details: `Autocadastro via portal de onboarding para '${targetName}' (${newId}) no plano '${selectedPlan}'.`,
    newValue: data.company
  });

  saveCentralState();

  res.status(201).json({
    success: true,
    company: {
      id: data.company.id,
      name: data.company.name,
      plan: data.company.plan,
      trialDays,
      licenseExpiresAt: data.company.licenseExpiresAt,
      installedApps: data.company.installedApps
    },
    adminUser: {
      id: data.adminUser.id,
      name: data.adminUser.name,
      email: data.adminUser.email,
      role: data.adminUser.role
    },
    message: `Workspace corporativo criado com sucesso! Seu período de testes de ${trialDays} dias está ativo.`
  });
});
