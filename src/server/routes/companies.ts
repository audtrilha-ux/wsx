import { Router, Response } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { 
  centralState, 
  saveCentralState, 
  centralDatabase,
  recordHqAuditLog, 
  getCentralStoreDiagnostics, 
  createCentralStoreSnapshot, 
  compactCentralStore, 
  CompanyData, 
  TenantUserData, 
  BranchData, 
  DeviceRegistrationData, 
  BillingReport, 
  CompanyLedgerEntry, 
  PlanDefinition, 
  InvoiceData, 
  PaymentOrderData,
  getEntitlementKey,
  getInstallationKey,
  getTenantInstalledAppIds
} from '../state.js';
import { requireHqAdmin, requireTenant, requireTenantRole, requirePaymentGatewaySignature, validateBody, AuthenticatedRequest } from '../middleware.js';
import { hashPassword } from '../config.js';
import { compareSemVer } from '../semver.js';
import { z } from 'zod';

export const companiesRouter = Router();

function sanitizeUser(u: TenantUserData) {
  return {
    id: u.id,
    companyId: u.companyId,
    name: u.name,
    email: u.email,
    role: u.role,
    branchIds: u.branchIds || [],
    status: u.status,
    createdAt: u.createdAt
  };
}

// Get all companies (Strictly restricted to HQ Admin)
companiesRouter.get('/companies', requireHqAdmin, (req, res) => {
  const all = Array.from(centralState.companies.values()).map(c => ({
    ...c,
    installedApps: getTenantInstalledAppIds(c.id)
  }));
  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = Math.max(1, parseInt(pageQuery as string, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeQuery as string, 10) || 50), 100);
    const start = (page - 1) * pageSize;
    const paginated = all.slice(start, start + pageSize);
    res.json({
      items: paginated,
      total: all.length,
      page,
      pageSize,
      totalPages: Math.ceil(all.length / pageSize)
    });
  } else {
    res.json(all);
  }
});

const createCompanySchema = z.object({
  name: z.string().min(1, 'Nome da empresa é obrigatório.'),
  plan: z.string().optional(),
  maxTerminals: z.number().int().optional(),
  adminEmail: z.string().email('E-mail de administrador inválido.').optional(),
  adminName: z.string().optional()
});

// Create new company (HQ Admin provision)
companiesRouter.post('/companies', requireHqAdmin, validateBody(createCompanySchema), (req, res) => {
  const { name, plan, maxTerminals, adminEmail, adminName } = req.body;

  const newId = `comp_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
  const selectedPlan = plan || 'pro';
  const planDef = centralState.plans.find(p => p.id === selectedPlan);
  const initialApps = planDef ? [...planDef.includedApps] : ['app_settings', 'app_pos', 'app_inventory', 'app_public_space', 'app_crm', 'app_finance', 'app_tables'];

  const trialDays = 30; // HQ Admin provision defaults to 30 days of standard active license
  const licenseExpiresAt = new Date(Date.now() + trialDays * 24 * 3600 * 1000).toISOString().split('T')[0];

  const newCompany: CompanyData = {
    id: newId,
    name,
    balance: 0,
    installedApps: initialApps,
    status: 'active',
    plan: selectedPlan,
    maxTerminals: maxTerminals || (planDef ? planDef.maxTerminals : 5),
    activeTerminals: 1,
    channel: 'stable',
    osTargetVersion: '1.1.0-lts',
    licenseExpiresAt,
    branches: [
      {
        id: `br_${newId}_1`,
        companyId: newId,
        name: 'Matriz Principal',
        address: 'Sede Principal',
        phone: '',
        isActive: true
      }
    ]
  };

  // Força credenciais temporárias dinâmicas, rejeitando PINs estáticos e fallbacks previsíveis (P1.1)
  const rawPin = Math.floor(100000 + (randomBytes(4).readUInt32BE(0) % 900000)).toString(); // PIN de 6 dígitos aleatório
  const rawPassword = randomBytes(6).toString('base64url') + '!A1' + (randomBytes(2).readUInt16BE(0) % 100); // Senha forte aleatória

  const adminUser: TenantUserData = {
    id: `usr_${newId}_admin`,
    companyId: newId,
    name: adminName || `Administrador (${name})`,
    email: adminEmail || `admin@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    pin: hashPassword(rawPin),
    password: hashPassword(rawPassword),
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  // Executa o provisionamento atômico no SQLite
  const result = centralDatabase.provisionCompanyTransaction(newCompany, adminUser, trialDays, 'Provisionamento Administrativo');
  if (!result.success) {
    res.status(result.code).json({ success: false, error: result.message });
    return;
  }

  const data = result.data!;

  // Sincroniza com o centralState em memória para retrocompatibilidade
  centralState.companies.set(newId, data.company);
  centralState.companyUsers.set(newId, [data.adminUser]);

  const ledgerList = centralState.companyLedger.get(newId) || [];
  ledgerList.push(data.ledgerEntry);
  centralState.companyLedger.set(newId, ledgerList);

  recordHqAuditLog({
    hqAdminId: (req as AuthenticatedRequest).user?.id || 'hq_admin',
    hqAdminEmail: (req as AuthenticatedRequest).user?.email || 'hq@3eatcru.com',
    action: 'CREATE_TENANT',
    targetCompanyId: newId,
    details: `Provisionamento do tenant '${name}' (${newId}) no plano '${selectedPlan}'.`,
    newValue: data.company
  });

  saveCentralState();

  res.status(201).json({ 
    success: true, 
    id: newId, 
    company: data.company,
    bootstrapCredentials: {
      email: data.adminUser.email,
      pin: rawPin,
      password: rawPassword
    }
  });
});

// Run recurring SaaS billing cycle for all companies (HQ Admin)
companiesRouter.post('/companies/run-billing', requireHqAdmin, (req: AuthenticatedRequest, res) => {
  const reports: BillingReport[] = [];
  const currentPeriod = new Date().toISOString().substring(0, 7); // e.g. '2026-09'
  const todayIso = new Date().toISOString().split('T')[0];
  const dueDateIso = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0];

  for (const company of centralState.companies.values()) {
    const result = centralDatabase.runSingleCompanyBillingTransaction(company.id, currentPeriod, todayIso, dueDateIso);
    if (!result.success || result.skipped) {
      continue;
    }
    const report = result.report;

    // Synchronize the in-memory cache with the atomic DB changes
    company.balance = report.newBalance;
    company.status = report.newStatus;
    company.licenseExpiresAt = report.licenseExpiresAt;
    centralState.companies.set(company.id, company);

    if (report.ledgerEntries.length > 0) {
      const ledger = centralState.companyLedger.get(company.id) || [];
      ledger.push(...report.ledgerEntries);
      centralState.companyLedger.set(company.id, ledger);
    }

    const companyInvoices = centralState.invoices.get(company.id) || [];
    companyInvoices.unshift(report.invoiceData);
    centralState.invoices.set(company.id, companyInvoices);

    centralState.billingIdempotencyLog.set(report.idempotencyKey, report.invoiceId);

    reports.push({
      companyId: company.id,
      companyName: company.name,
      previousBalance: report.prevBalance,
      newBalance: report.newBalance,
      monthlyCost: report.totalCharged,
      apps: company.installedApps,
      previousStatus: report.prevStatus,
      newStatus: report.newStatus
    });
  }

  recordHqAuditLog({
    hqAdminId: req.user?.id || 'hq_admin',
    hqAdminEmail: req.user?.email || 'hq@3eatcru.com',
    action: 'RUN_SAAS_BILLING',
    details: `Execução do ciclo de faturamento SaaS (${currentPeriod}) para ${reports.length} tenants.`
  });

  saveCentralState();
  res.json({ success: true, reports });
});

// GET /companies/:id/invoices - List invoices for tenant
companiesRouter.get('/companies/:id/invoices', requireTenantRole(['admin', 'manager']), (req, res) => {
  const id = req.params['id'] as string;
  const invoices = centralState.invoices.get(id) || [];

  // Sort by date descending
  invoices.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = Math.max(1, parseInt(pageQuery as string, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeQuery as string, 10) || 50), 100);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedInvoices = invoices.slice(start, end);
    res.json({
      items: paginatedInvoices,
      total: invoices.length,
      page,
      pageSize,
      totalPages: Math.ceil(invoices.length / pageSize)
    });
  } else {
    res.json(invoices);
  }
});

// GET /companies/:id/payment-orders - List payment orders for tenant
companiesRouter.get('/companies/:id/payment-orders', requireTenantRole(['admin', 'manager']), (req, res) => {
  const companyId = req.params['id'] as string;
  const list: PaymentOrderData[] = [];
  for (const order of centralState.paymentOrders.values()) {
    if (order.companyId === companyId) {
      list.push(order);
    }
  }
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(list);
});

const payInvoiceSchema = z.object({
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD', 'BANK_SLIP']).optional()
});

// POST /companies/:id/invoices/:invoiceId/pay - Create a payment order for an invoice
companiesRouter.post('/companies/:id/invoices/:invoiceId/pay', requireTenantRole(['admin', 'manager']), validateBody(payInvoiceSchema), (req, res) => {
  const companyId = req.params['id'] as string;
  const invoiceId = req.params['invoiceId'] as string;
  const { paymentMethod } = req.body || {};

  const invoices = centralState.invoices.get(companyId) || [];
  const invoice = invoices.find(inv => inv.id === invoiceId);

  if (!invoice) {
    res.status(404).json({ success: false, message: 'Fatura não encontrada.' });
    return;
  }

  const method = paymentMethod || 'PIX';
  const qrCodeString = method === 'PIX' ? `00020101021226830014br.gov.bcb.pix2561pix.3eatcru.com.br/v2/cob/mock-qr-code5204000053039865405${invoice.totalAmount.toFixed(2)}5802BR59113EATCRU_OS6009SAO_PAULO62070503***6304` : undefined;

  const result = centralDatabase.createPaymentOrderTransaction(invoiceId, companyId, method, invoice.totalAmount, qrCodeString);
  
  if (!result.success) {
    res.status(result.code || 500).json({ success: false, message: result.message || 'Erro ao criar ordem de pagamento.' });
    return;
  }

  if (result.reused) {
    res.json({ success: true, paymentOrder: result.paymentOrder, reused: true });
    return;
  }

  // Sincroniza cache
  centralState.paymentOrders.set(result.paymentOrder.id, result.paymentOrder);
  invoice.status = 'PAYMENT_CREATED';
  saveCentralState();

  res.json({ success: true, paymentOrder: result.paymentOrder });
});

// POST /companies/:id/payment-orders/:paymentOrderId/confirm - HQ Admin confirmation
companiesRouter.post('/companies/:id/payment-orders/:paymentOrderId/confirm-hq', requireHqAdmin, (req, res) => {
  confirmPaymentOrder(req.params['id'] as string, req.params['paymentOrderId'] as string, res, true);
});

// POST /companies/:id/payment-orders/:paymentOrderId/confirm-webhook - Gateway webhook confirmation
companiesRouter.post('/companies/:id/payment-orders/:paymentOrderId/confirm-webhook', requirePaymentGatewaySignature, (req, res) => {
  confirmPaymentOrder(req.params['id'] as string, req.params['paymentOrderId'] as string, res, false, req.headers['x-webhook-event-id'] as string | undefined || req.body?.eventId);
});

function confirmPaymentOrder(companyId: string, paymentOrderId: string, res: Response, isHqAdmin: boolean, eventId?: string) {
  const result = centralDatabase.confirmPaymentOrderTransaction(companyId, paymentOrderId, eventId);
  
  if (!result.success) {
    res.status(result.code).json({ success: false, message: result.message });
    return;
  }

  const data = result.data!;

  // 1. Processed Webhook Event ID
  if (eventId) {
    centralState.processedWebhookEvents.add(eventId);
  }

  // 2. Company status, balance, licenseExpiresAt
  const company = centralState.companies.get(companyId);
  if (company) {
    company.balance = data.company.balance;
    company.licenseExpiresAt = data.company.license_expires_at;
    company.status = data.company.status;
    centralState.companies.set(companyId, company);
  }

  // 3. Update payment orders status in memory
  const po = centralState.paymentOrders.get(paymentOrderId);
  if (po) {
    po.status = data.paymentOrder.status;
    po.confirmedAt = data.paymentOrder.confirmed_at;
    centralState.paymentOrders.set(paymentOrderId, po);
  }

  // Cancel any other pending payment orders for this invoice to prevent concurrent double-settlement
  for (const otherOrder of centralState.paymentOrders.values()) {
    if (otherOrder.invoiceId === data.paymentOrder.invoice_id && otherOrder.id !== paymentOrderId && otherOrder.status === 'PENDING') {
      otherOrder.status = 'CANCELLED';
    }
  }

  // 4. Update Invoice status in memory
  const invoices = centralState.invoices.get(companyId) || [];
  const invoice = invoices.find(inv => inv.id === data.paymentOrder.invoice_id);
  if (invoice) {
    invoice.status = data.invoice.status;
    invoice.paidAt = data.invoice.paid_at;
    centralState.invoices.set(companyId, invoices);
  }

  // 5. Update Ledger in memory
  const companyLedger = centralState.companyLedger.get(companyId) || [];
  companyLedger.unshift(...data.ledgerEntries);
  centralState.companyLedger.set(companyId, companyLedger);

  recordHqAuditLog({
    hqAdminId: isHqAdmin ? 'hq_admin_override' : 'system_gateway',
    hqAdminEmail: isHqAdmin ? 'admin@hq.3eatcru' : 'pix-gateway@3eatcru.com',
    action: 'RECEIVE_GATEWAY_PAYMENT',
    targetCompanyId: companyId,
    details: `Confirmação de pagamento via ${isHqAdmin ? 'HQ Admin' : 'gateway'} para tenant ${company?.name || companyId}. Valor: R$ ${data.paymentOrder.amount}. Fatura liquidada e licença prorrogada.`
  });

  saveCentralState();

  res.json({ 
    success: true, 
    message: 'Pagamento verificado e confirmado com sucesso!', 
    paymentOrder: centralState.paymentOrders.get(paymentOrderId),
    companyStatus: company?.status || data.company.status,
    newBalance: company?.balance ?? data.company.balance
  });
}

// GET /hq/invoices - List all platform invoices (HQ Admin)
companiesRouter.get('/hq/invoices', requireHqAdmin, (req, res) => {
  const allInvoices: InvoiceData[] = [];
  for (const list of centralState.invoices.values()) {
    allInvoices.push(...list);
  }
  allInvoices.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = Math.max(1, parseInt(pageQuery as string, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeQuery as string, 10) || 50), 100);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedInvoices = allInvoices.slice(start, end);
    res.json({
      items: paginatedInvoices,
      total: allInvoices.length,
      page,
      pageSize,
      totalPages: Math.ceil(allInvoices.length / pageSize)
    });
  } else {
    res.json(allInvoices);
  }
});

const adjustBalanceSchema = z.object({
  amount: z.number(),
  description: z.string().optional(),
  type: z.enum(['CREDIT_ADDED', 'PLAN_CHARGE', 'MANUAL_ADJUSTMENT', 'EXTRA_APP_CHARGE']).optional()
});

// Adjust balance alias for HQ Admin
companiesRouter.post('/companies/:id/adjust-balance', requireHqAdmin, validateBody(adjustBalanceSchema), (req, res) => {
  const id = req.params['id'] as string;
  const { amount, description, type } = req.body || {};

  const company = centralState.companies.get(id);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  try {
    const desc = description || 'Ajuste de saldo via HQ Control Plane';
    const ledgerType = (type as CompanyLedgerEntry['type']) || (amount >= 0 ? 'CREDIT_ADDED' : 'PLAN_CHARGE');
    
    const result = centralDatabase.adjustCompanyBalanceTransaction(id, amount, desc, ledgerType);
    
    // Synchronize in-memory cache
    company.balance = result.data.newBalance;
    if (result.data.newBalance >= 0 && company.status === 'suspended') {
      company.status = 'active';
      centralDatabase.updateTenantStatusTransaction(id, 'active');
    }
    centralState.companies.set(id, company);

    const ledger = centralState.companyLedger.get(id) || [];
    ledger.push(result.data.ledgerEntry);
    centralState.companyLedger.set(id, ledger);

    saveCentralState();
    res.json({ success: true, company, newBalance: result.data.newBalance });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg || 'Falha ao processar transação de ajuste de saldo no banco de dados.' });
  }
});

// Get branches for a company (Tenant isolated or HQ Admin)
companiesRouter.get('/companies/:id/branches', requireTenant, (req, res) => {
  const compId = req.params['id'] as string;
  const company = centralState.companies.get(compId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }
  res.json(company.branches || []);
});

const createBranchSchema = z.object({
  name: z.string().min(1, 'Nome da filial é obrigatório.'),
  address: z.string().optional(),
  phone: z.string().optional(),
  code: z.string().optional(),
  isMain: z.boolean().optional(),
  settings: z.any().optional()
});

// Create new branch for a company (Admin role or HQ Admin)
companiesRouter.post('/companies/:id/branches', requireTenantRole(['admin']), validateBody(createBranchSchema), (req: AuthenticatedRequest, res) => {
  const compId = req.params['id'] as string;
  const company = centralState.companies.get(compId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const { name, address, phone, code, isMain, settings } = req.body;

  const existingBranches = company.branches || [];

  // Enforce branch quotas based on plan (maxBranches)
  const planDef = centralState.plans.find(p => p.id === company.plan);
  const maxBranches = company.maxBranches ?? (planDef ? planDef.maxBranches : 2);
  const activeBranches = existingBranches.filter(b => b.isActive !== false);

  if (activeBranches.length >= maxBranches && req.user?.role !== 'hq_admin') {
    res.status(403).json({
      error: `Limite de filiais atingido (${activeBranches.length}/${maxBranches}) para o plano atual (${(company.plan || 'starter').toUpperCase()}). Faça upgrade no Central HQ para adicionar mais filiais.`
    });
    return;
  }

  const branchId = `br_${compId}_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 6)}`;
  
  // If isMain is set, remove isMain from previous branches
  if (isMain) {
    for (const b of existingBranches) {
      b.isMain = false;
    }
  }

  const newBranch: BranchData = {
    id: branchId,
    companyId: compId,
    name,
    code: code || `FIL-${existingBranches.length + 1}`,
    address: address || 'Endereço não informado',
    phone: phone || '',
    isActive: true,
    isMain: isMain || existingBranches.length === 0,
    settings: settings || {},
    createdAt: new Date().toISOString()
  };

  company.branches = [...existingBranches, newBranch];
  centralDatabase.updateTenantBranchesTransaction(compId, company.branches);
  centralState.companies.set(compId, company);

  if (req.user?.role === 'hq_admin') {
    recordHqAuditLog({
      hqAdminId: req.user.id,
      hqAdminEmail: req.user.email,
      action: 'CREATE_BRANCH',
      targetCompanyId: compId,
      details: `Nova filial '${name}' (${branchId}) criada para a empresa '${company.name}'.`
    });
  }

  saveCentralState();
  res.status(201).json({ success: true, branch: newBranch });
});

const updateBranchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  code: z.string().optional(),
  isActive: z.boolean().optional(),
  isMain: z.boolean().optional(),
  settings: z.any().optional()
});

// Update branch details (Admin role or HQ Admin)
companiesRouter.put('/companies/:id/branches/:branchId', requireTenantRole(['admin']), validateBody(updateBranchSchema), (req: AuthenticatedRequest, res) => {
  const compId = req.params['id'] as string;
  const branchId = req.params['branchId'] as string;
  const company = centralState.companies.get(compId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const existingBranches = company.branches || [];
  const idx = existingBranches.findIndex(b => b.id === branchId);
  if (idx === -1) {
    res.status(404).json({ error: 'Filial não encontrada nesta empresa.' });
    return;
  }

  const { name, address, phone, code, isActive, isMain, settings } = req.body || {};
  const branch = existingBranches[idx];

  if (name !== undefined) branch.name = name;
  if (address !== undefined) branch.address = address;
  if (phone !== undefined) branch.phone = phone;
  if (code !== undefined) branch.code = code;
  if (isActive !== undefined) branch.isActive = Boolean(isActive);
  if (settings !== undefined) branch.settings = settings;

  if (isMain === true) {
    for (const b of existingBranches) {
      b.isMain = false;
    }
    branch.isMain = true;
  }

  existingBranches[idx] = branch;
  company.branches = existingBranches;
  centralDatabase.updateTenantBranchesTransaction(compId, company.branches);
  centralState.companies.set(compId, company);

  saveCentralState();
  res.json({ success: true, branch });
});

// Delete branch (Admin role or HQ Admin)
companiesRouter.delete('/companies/:id/branches/:branchId', requireTenantRole(['admin']), (req: AuthenticatedRequest, res) => {
  const compId = req.params['id'] as string;
  const branchId = req.params['branchId'] as string;
  const company = centralState.companies.get(compId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const existingBranches = company.branches || [];
  if (existingBranches.length <= 1) {
    res.status(400).json({ error: 'Não é permitido excluir a única filial existente da empresa.' });
    return;
  }

  const branchToDelete = existingBranches.find(b => b.id === branchId);
  if (!branchToDelete) {
    res.status(404).json({ error: 'Filial não encontrada.' });
    return;
  }

  if (branchToDelete.isMain) {
    res.status(400).json({ error: 'Não é permitido excluir a filial principal. Defina outra filial como principal antes de excluir.' });
    return;
  }

  company.branches = existingBranches.filter(b => b.id !== branchId);
  centralDatabase.updateTenantBranchesTransaction(compId, company.branches);
  centralState.companies.set(compId, company);

  saveCentralState();
  res.json({ success: true, message: 'Filial removida com sucesso.' });
});

// Get single company by ID (Tenant isolated or HQ Admin)
companiesRouter.get('/companies/:id', requireTenant, (req, res) => {
  const compId = req.params['id'] as string;
  const company = centralState.companies.get(compId);
  if (company) {
    res.json({
      ...company,
      installedApps: getTenantInstalledAppIds(compId)
    });
  } else {
    res.status(404).json({ error: 'Empresa não encontrada no sistema central.' });
  }
});

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  balance: z.number().optional(),
  installedApps: z.array(z.string()).optional(),
  status: z.enum(['active', 'suspended', 'trial', 'cancelled']).optional(),
  plan: z.string().optional(),
  maxTerminals: z.number().int().positive().optional(),
  channel: z.enum(['stable', 'beta']).optional(),
  osTargetVersion: z.string().optional()
});

// Update company details (Admin role required - restricted fields for non-HQ)
companiesRouter.put('/companies/:id', requireTenantRole(['admin']), validateBody(updateCompanySchema), (req: AuthenticatedRequest, res) => {
  const id = req.params['id'] as string;
  const existing = centralState.companies.get(id);
  if (!existing) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const isHq = req.user?.role === 'hq_admin';
  const { name, balance, installedApps, status, plan, maxTerminals, channel, osTargetVersion } = req.body || {};
  
  let finalBalance = existing.balance;
  let finalInstalledApps = [...existing.installedApps];

  if (isHq) {
    if (balance !== undefined) finalBalance = balance;
    if (Array.isArray(installedApps)) {
      const added = installedApps.filter(appId => !existing.installedApps.includes(appId));
      const removed = existing.installedApps.filter(appId => !installedApps.includes(appId));
      const deviceId = `web_dev_${id}`;

      for (const appId of added) {
        const app = centralState.apps.find(a => a.id === appId);
        if (app) {
          const res = centralDatabase.installStoreAppTransaction(id, deviceId, appId, app);
          if (res && res.success) {
            const entKey = getEntitlementKey(id, appId);
            centralState.appEntitlements.set(entKey, res.entitlement);
            const instKey = getInstallationKey(id, deviceId, appId);
            centralState.appInstallations.set(instKey, res.installation);
          }
        }
      }

      for (const appId of removed) {
        centralDatabase.uninstallStoreAppTransaction(id, deviceId, appId);
        const instKey = getInstallationKey(id, deviceId, appId);
        centralState.appInstallations.delete(instKey);
      }

      finalInstalledApps = installedApps;
    }
  } else {
    // Non-HQ clients cannot arbitrarily change balance, status, plan, maxTerminals, or installedApps
    if (installedApps !== undefined) {
      res.status(403).json({ 
        error: 'Operação proibida: a instalação e desinstalação de aplicativos deve ser realizada exclusivamente através da 3eatcru Store (/api/v1/store/apps/:id/install).' 
      });
      return;
    }
  }

  const updated: CompanyData = {
    ...existing,
    id,
    name: name !== undefined ? name : existing.name,
    balance: finalBalance,
    status: (isHq && status) ? status : existing.status,
    plan: (isHq && plan) ? plan : existing.plan,
    maxTerminals: (isHq && maxTerminals !== undefined) ? maxTerminals : existing.maxTerminals,
    installedApps: finalInstalledApps,
    channel: (isHq && channel) ? channel : (existing.channel || 'stable'),
    osTargetVersion: (isHq && osTargetVersion) ? osTargetVersion : (existing.osTargetVersion || '1.1.0-lts')
  };

  centralDatabase.updateTenantProfileTransaction(id, updated);
  centralState.companies.set(id, updated);
  saveCentralState();
  res.json({ success: true, company: updated });
});

// Company users management (Protected with admin/manager role requirement)
companiesRouter.get('/companies/:id/users', requireTenantRole(['admin', 'manager']), (req, res) => {
  const id = req.params['id'] as string;
  const users = centralState.companyUsers.get(id) || [];
  // Return sanitized users without exposing password hashes or raw pins
  res.json(users.map(sanitizeUser));
});

const TenantRoleSchema = z.enum(['admin', 'manager', 'operator']);

const createCompanyUserSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório.'),
  email: z.string().email().optional().or(z.literal('')),
  pin: z.string().optional(),
  password: z.string().optional(),
  role: TenantRoleSchema.optional(),
  branchIds: z.array(z.string()).optional(),
  status: z.enum(['active', 'suspended']).optional()
}).refine(data => data.pin || data.password, {
  message: 'Nome e PIN/Senha são obrigatórios.',
  path: ['pin']
});

const updateCompanyUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  pin: z.string().optional(),
  password: z.string().optional(),
  role: TenantRoleSchema.optional(),
  branchIds: z.array(z.string()).optional(),
  status: z.enum(['active', 'suspended']).optional()
});

companiesRouter.post('/companies/:id/users', requireTenantRole(['admin', 'manager']), validateBody(createCompanyUserSchema), (req: AuthenticatedRequest, res) => {
  const id = req.params['id'] as string;
  const { name, email, pin, password, role, branchIds, status } = req.body || {};

  if (!name || (!pin && !password)) {
    res.status(400).json({ error: 'Nome e PIN/Senha são obrigatórios.' });
    return;
  }

  // Security RBAC Check: Strict role validation to prevent privilege escalation to hq_admin or arbitrary roles
  const roleParsed = TenantRoleSchema.safeParse(role || 'operator');
  if (!roleParsed.success) {
    res.status(400).json({ error: 'Papel (role) inválido. Papéis permitidos para usuários do tenant: admin, manager, operator.' });
    return;
  }
  const targetRole = roleParsed.data;

  // Security RBAC Check: Manager cannot create or elevate to 'admin' or 'manager' role
  const requestingRole = req.user?.role;
  if (requestingRole === 'manager' && (targetRole === 'admin' || targetRole === 'manager')) {
    res.status(403).json({ error: 'Acesso negado: Gerentes só possuem permissão para criar usuários do tipo Operador.' });
    return;
  }

  const users = centralState.companyUsers.get(id) || [];
  const rawPin = pin || Math.floor(100000 + (randomBytes(4).readUInt32BE(0) % 900000)).toString(); // Gera PIN aleatório seguro em vez de fallback 1234
  const hashedPin = hashPassword(rawPin);
  const hashedPassword = password ? hashPassword(password) : hashPassword(randomBytes(16).toString('hex'));

  const newUser: TenantUserData = {
    id: `usr_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 6)}`,
    companyId: id,
    name,
    email: email || '',
    pin: hashedPin,
    password: hashedPassword,
    role: targetRole,
    branchIds: Array.isArray(branchIds) ? branchIds : undefined,
    status: status === 'suspended' ? 'suspended' : 'active',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  centralDatabase.upsertCompanyUserTransaction(id, newUser);
  centralState.companyUsers.set(id, users);
  saveCentralState();

  res.status(201).json({ success: true, user: sanitizeUser(newUser) });
});

// Update user in company (Admin role or Manager updating Operators)
companiesRouter.put('/companies/:id/users/:userId', requireTenantRole(['admin', 'manager']), validateBody(updateCompanyUserSchema), (req: AuthenticatedRequest, res) => {
  const compId = req.params['id'] as string;
  const userId = req.params['userId'] as string;

  const users = centralState.companyUsers.get(compId) || [];
  const userIdx = users.findIndex(u => u.id === userId);
  if (userIdx === -1) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  const existingUser = users[userIdx];
  const requestingRole = req.user?.role;

  // Manager restrictions
  if (requestingRole === 'manager') {
    if (existingUser.role === 'admin' || existingUser.role === 'manager') {
      res.status(403).json({ error: 'Acesso negado: Gerentes não podem alterar Administradores ou outros Gerentes.' });
      return;
    }
  }

  const { name, email, pin, password, role, branchIds, status } = req.body || {};

  // Security RBAC Check: Strict role validation when updating role
  if (role !== undefined) {
    const roleParsed = TenantRoleSchema.safeParse(role);
    if (!roleParsed.success) {
      res.status(400).json({ error: 'Papel (role) inválido. Papéis permitidos para usuários do tenant: admin, manager, operator.' });
      return;
    }
    if (requestingRole === 'manager' && (roleParsed.data === 'admin' || roleParsed.data === 'manager')) {
      res.status(403).json({ error: 'Acesso negado: Gerentes não podem promover usuários a Administrador ou Gerente.' });
      return;
    }
    existingUser.role = roleParsed.data;
  }

  if (name !== undefined) existingUser.name = name;
  if (email !== undefined) existingUser.email = email;
  if (status !== undefined) existingUser.status = status;
  if (branchIds !== undefined) existingUser.branchIds = Array.isArray(branchIds) ? branchIds : undefined;

  if (pin) {
    existingUser.pin = hashPassword(pin);
  }
  if (password) {
    existingUser.password = hashPassword(password);
  }

  users[userIdx] = existingUser;
  centralDatabase.upsertCompanyUserTransaction(compId, existingUser);
  centralState.companyUsers.set(compId, users);
  saveCentralState();

  res.json({ success: true, user: sanitizeUser(existingUser) });
});

// Delete user from company
companiesRouter.delete('/companies/:id/users/:userId', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  const compId = req.params['id'] as string;
  const userId = req.params['userId'] as string;

  if (req.user && req.user.id === userId) {
    res.status(400).json({ error: 'Acesso negado: Você não pode remover sua própria conta de usuário.' });
    return;
  }

  const users = centralState.companyUsers.get(compId) || [];
  const targetUser = users.find(u => u.id === userId);
  if (!targetUser) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  // Prevent manager from deleting an admin
  if (req.user?.role === 'manager' && targetUser.role === 'admin') {
    res.status(403).json({ error: 'Acesso negado: Gerentes não podem remover usuários Administradores.' });
    return;
  }

  const updatedUsers = users.filter(u => u.id !== userId);
  centralDatabase.deleteCompanyUserTransaction(compId, userId);
  centralState.companyUsers.set(compId, updatedUsers);
  saveCentralState();

  res.json({ success: true, message: 'Usuário removido com sucesso.' });
});

// Company ledger and billing reports
companiesRouter.get('/companies/:id/ledger', requireTenantRole(['admin', 'manager']), (req, res) => {
  const id = req.params['id'] as string;
  const ledger = centralState.companyLedger.get(id) || [];

  // Sort by date descending
  ledger.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = Math.max(1, parseInt(pageQuery as string, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeQuery as string, 10) || 50), 100);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedLedger = ledger.slice(start, end);
    res.json({
      items: paginatedLedger,
      total: ledger.length,
      page,
      pageSize,
      totalPages: Math.ceil(ledger.length / pageSize)
    });
  } else {
    res.json(ledger);
  }
});

const creditCompanySchema = z.object({
  amount: z.number().positive('Valor de crédito inválido.'),
  description: z.string().optional()
});

companiesRouter.post('/companies/:id/credit', requireHqAdmin, validateBody(creditCompanySchema), (req, res) => {
  const id = req.params['id'] as string;
  const { amount, description } = req.body || {};

  const company = centralState.companies.get(id);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  try {
    const desc = description || 'Crédito inserido via HQ Control Plane';
    const result = centralDatabase.adjustCompanyBalanceTransaction(id, amount, desc, 'CREDIT_ADDED');

    // Synchronize cache
    company.balance = result.data.newBalance;
    centralState.companies.set(id, company);

    const ledger = centralState.companyLedger.get(id) || [];
    ledger.push(result.data.ledgerEntry);
    centralState.companyLedger.set(id, ledger);

    saveCentralState();
    res.json({ success: true, company, newBalance: result.data.newBalance });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg || 'Falha ao processar transação de crédito no banco de dados.' });
  }
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  branches: z.array(z.any()).optional()
});

// PATCH /companies/:id/profile - Update ONLY non-financial operational details (Tenant Admin/Manager)
companiesRouter.patch('/companies/:id/profile', requireTenantRole(['admin', 'manager']), validateBody(updateProfileSchema), (req, res) => {
  const id = req.params['id'] as string;
  const company = centralState.companies.get(id);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const { name, branches } = req.body || {};
  if (name !== undefined) company.name = name;
  if (branches !== undefined && Array.isArray(branches)) {
    company.branches = branches;
  }

  centralDatabase.updateTenantProfileTransaction(id, { name: company.name, branches: company.branches });
  centralState.companies.set(id, company);
  saveCentralState();
  res.json({ success: true, company });
});

const tenantEntitlementsSchema = z.object({
  plan: z.string().optional(),
  maxTerminals: z.number().int().positive().optional(),
  maxBranches: z.number().int().positive().optional(),
  channel: z.enum(['stable', 'beta']).optional(),
  osTargetVersion: z.string().optional(),
  licenseExpiresAt: z.string().optional()
});

// POST /tenants/:id/entitlements - Update plans, terminal limits and OTA channels (HQ Admin only)
companiesRouter.post('/tenants/:id/entitlements', requireHqAdmin, validateBody(tenantEntitlementsSchema), (req, res) => {
  const id = req.params['id'] as string;
  const company = centralState.companies.get(id);
  if (!company) {
    res.status(404).json({ error: 'Tenant não encontrado.' });
    return;
  }

  const prev = { ...company };
  const { plan, maxTerminals, maxBranches, channel, osTargetVersion, licenseExpiresAt } = req.body || {};

  try {
    const result = centralDatabase.updateTenantEntitlementsTransaction(id, {
      plan,
      maxTerminals: maxTerminals !== undefined ? Number(maxTerminals) : undefined,
      maxBranches: maxBranches !== undefined ? Number(maxBranches) : undefined,
      channel,
      osTargetVersion,
      licenseExpiresAt
    });

    const updatedCompany = result.data;

    // Synchronize cache
    centralState.companies.set(id, updatedCompany);

    recordHqAuditLog({
      hqAdminId: (req as AuthenticatedRequest).user?.id || 'hq_admin',
      hqAdminEmail: (req as AuthenticatedRequest).user?.email || 'hq@3eatcru.com',
      action: 'UPDATE_ENTITLEMENTS',
      targetCompanyId: id,
      details: `Atualização de direitos/limites para o tenant '${updatedCompany.name}'.`,
      previousValue: prev,
      newValue: updatedCompany
    });

    saveCentralState();
    res.json({ success: true, message: 'Direitos e limites do tenant atualizados com sucesso.', company: updatedCompany });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg || 'Falha ao atualizar direitos no banco de dados.' });
  }
});

// POST /tenants/:id/credits - Adjust credits & financial balance (HQ Admin only)
companiesRouter.post('/tenants/:id/credits', requireHqAdmin, validateBody(adjustBalanceSchema), (req, res) => {
  const id = req.params['id'] as string;
  const { amount, description, type } = req.body || {};

  const company = centralState.companies.get(id);
  if (!company) {
    res.status(404).json({ error: 'Tenant não encontrado.' });
    return;
  }

  try {
    const prevBalance = company.balance;
    const desc = description || 'Ajuste de saldo efetuado pelo HQ Control Plane';
    const ledgerType = (type as CompanyLedgerEntry['type']) || (amount >= 0 ? 'CREDIT_ADDED' : 'PLAN_CHARGE');

    const result = centralDatabase.adjustCompanyBalanceTransaction(id, amount, desc, ledgerType);

    // Synchronize cache
    company.balance = result.data.newBalance;
    centralState.companies.set(id, company);

    const ledger = centralState.companyLedger.get(id) || [];
    ledger.push(result.data.ledgerEntry);
    centralState.companyLedger.set(id, ledger);

    recordHqAuditLog({
      hqAdminId: (req as AuthenticatedRequest).user?.id || 'hq_admin',
      hqAdminEmail: (req as AuthenticatedRequest).user?.email || 'hq@3eatcru.com',
      action: 'ADJUST_CREDITS',
      targetCompanyId: id,
      details: `Ajuste financeiro de R$ ${amount.toFixed(2)} (${description || 'Ajuste de saldo'}) no tenant '${company.name}'.`,
      previousValue: prevBalance,
      newValue: result.data.newBalance
    });

    saveCentralState();
    res.json({ success: true, company, newBalance: result.data.newBalance });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg || 'Falha ao processar ajuste financeiro no banco de dados.' });
  }
});

const tenantSuspendSchema = z.object({
  status: z.enum(['active', 'suspended'])
});

// POST /tenants/:id/suspend - Suspend or reactivate a tenant (HQ Admin only)
companiesRouter.post('/tenants/:id/suspend', requireHqAdmin, validateBody(tenantSuspendSchema), (req, res) => {
  const id = req.params['id'] as string;
  const { status } = req.body || {};

  const company = centralState.companies.get(id);
  if (!company) {
    res.status(404).json({ error: 'Tenant não encontrado.' });
    return;
  }

  try {
    const prevStatus = company.status;
    centralDatabase.updateTenantStatusTransaction(id, status);

    // Synchronize cache
    company.status = status;
    centralState.companies.set(id, company);

    recordHqAuditLog({
      hqAdminId: (req as AuthenticatedRequest).user?.id || 'hq_admin',
      hqAdminEmail: (req as AuthenticatedRequest).user?.email || 'hq@3eatcru.com',
      action: 'CHANGE_TENANT_STATUS',
      targetCompanyId: id,
      details: `Status do tenant '${company.name}' alterado de ${prevStatus} para ${status}.`,
      previousValue: prevStatus,
      newValue: status
    });

    saveCentralState();
    res.json({ success: true, message: `Status do tenant alterado para ${status}.`, company });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg || 'Falha ao atualizar status do tenant no banco de dados.' });
  }
});

const tenantAppActionSchema = z.object({
  action: z.enum(['install', 'uninstall']).default('install')
});

// POST /tenants/:id/apps/:appId/install - Force-install/uninstall an app on behalf of tenant (HQ Admin only)
companiesRouter.post('/tenants/:id/apps/:appId/install', requireHqAdmin, validateBody(tenantAppActionSchema), (req, res) => {
  const id = req.params['id'] as string;
  const appId = req.params['appId'] as string;
  const { action } = req.body || { action: 'install' }; // install or uninstall

  const company = centralState.companies.get(id);
  if (!company) {
    res.status(404).json({ error: 'Tenant não encontrado.' });
    return;
  }

  try {
    const deviceId = `web_dev_${id}`;

    if (action === 'install') {
      // Validate minOsVersion compatibility against tenant's osTargetVersion
      const targetApp = centralState.apps.find(a => a.id === appId);
      if (!targetApp) {
        res.status(404).json({ error: 'Aplicativo não encontrado no catálogo.' });
        return;
      }

      if (targetApp.currentRelease?.minOsVersion) {
        const tenantOsVersion = company.osTargetVersion || '1.0.0';
        if (compareSemVer(tenantOsVersion, targetApp.currentRelease.minOsVersion) < 0) {
          res.status(400).json({ 
            error: `Incompatibilidade de Versão do OS: O aplicativo '${targetApp.name}' requer no mínimo o 3eatcru OS ${targetApp.currentRelease.minOsVersion}, mas o tenant está na versão ${tenantOsVersion}. Atualize a versão alvo do OS do tenant antes de instalar.` 
          });
          return;
        }
      }

      const resDb = centralDatabase.installStoreAppTransaction(id, deviceId, appId, targetApp);
      if (resDb && resDb.success) {
        const entKey = getEntitlementKey(id, appId);
        centralState.appEntitlements.set(entKey, resDb.entitlement);
        const instKey = getInstallationKey(id, deviceId, appId);
        centralState.appInstallations.set(instKey, resDb.installation);
      }

      if (!company.installedApps.includes(appId)) {
        company.installedApps.push(appId);
      }
      centralDatabase.updateTenantAppsTransaction(id, appId, 'install');
    } else {
      centralDatabase.uninstallStoreAppTransaction(id, deviceId, appId);
      const instKey = getInstallationKey(id, deviceId, appId);
      centralState.appInstallations.delete(instKey);

      company.installedApps = company.installedApps.filter(a => a !== appId);
      centralDatabase.updateTenantAppsTransaction(id, appId, 'uninstall');
    }

    centralState.companies.set(id, company);

    recordHqAuditLog({
      hqAdminId: (req as AuthenticatedRequest).user?.id || 'hq_admin',
      hqAdminEmail: (req as AuthenticatedRequest).user?.email || 'hq@3eatcru.com',
      action: action === 'install' ? 'INSTALL_APP_TENANT' : 'UNINSTALL_APP_TENANT',
      targetCompanyId: id,
      details: `Aplicativo '${appId}' ${action === 'install' ? 'instalado' : 'desinstalado'} no tenant '${company.name}'.`
    });

    saveCentralState();
    res.json({ success: true, message: `Aplicativo '${appId}' ${action === 'install' ? 'instalado' : 'desinstalado'} com sucesso.`, company });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg || 'Falha ao gerenciar aplicativo do tenant no banco de dados.' });
  }
});

// GET /plans - Retrieve SaaS Plans Catalog
companiesRouter.get('/plans', (_req, res) => {
  res.json(centralState.plans);
});

const planCatalogSchema = z.object({
  id: z.string().min(1, 'id do plano é obrigatório.'),
  name: z.string().min(1, 'name do plano é obrigatório.'),
  monthlyPrice: z.number().min(0, 'monthlyPrice deve ser um valor positivo.'),
  maxTerminals: z.number().int().positive().optional(),
  maxBranches: z.number().int().positive().optional(),
  description: z.string().optional(),
  includedApps: z.array(z.string()).optional(),
  features: z.array(z.string()).optional()
});

// POST /plans - Create or Update Plan in HQ Catalog (HQ Admin only)
companiesRouter.post('/plans', requireHqAdmin, validateBody(planCatalogSchema), (req, res) => {
  const { id, name, monthlyPrice, maxTerminals, maxBranches, description, includedApps, features } = req.body || {};

  const idx = centralState.plans.findIndex(p => p.id === id);
  const planData: PlanDefinition = {
    id,
    name,
    monthlyPrice,
    maxTerminals: maxTerminals || 5,
    maxBranches: maxBranches || 1,
    description: description || '',
    includedApps: Array.isArray(includedApps) ? includedApps : [],
    features: Array.isArray(features) ? features : []
  };

  if (idx >= 0) {
    centralState.plans[idx] = planData;
  } else {
    centralState.plans.push(planData);
  }

  recordHqAuditLog({
    hqAdminId: (req as AuthenticatedRequest).user?.id || 'hq_admin',
    hqAdminEmail: (req as AuthenticatedRequest).user?.email || 'hq@3eatcru.com',
    action: 'SAVE_PLAN_CATALOG',
    details: `Plano '${name}' (${id}) atualizado no catálogo oficial de planos SaaS.`
  });

  centralDatabase.upsertPlanTransaction(planData);
  saveCentralState();
  res.json({ success: true, plan: planData });
});





// GET /hq/audit-logs - Query HQ Administrative Audit Trail (HQ Admin only)
companiesRouter.get('/hq/audit-logs', requireHqAdmin, (req, res) => {
  const list = centralState.hqAuditLogs;

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = Math.max(1, parseInt(pageQuery as string, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeQuery as string, 10) || 50), 100);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedLogs = list.slice(start, end);
    res.json({
      items: paginatedLogs,
      total: list.length,
      page,
      pageSize,
      totalPages: Math.ceil(list.length / pageSize)
    });
  } else {
    res.json(list);
  }
});

// GET /companies/:id/devices - List registered devices/terminals for a tenant (Tenant Admin or HQ Admin)
companiesRouter.get('/companies/:id/devices', requireTenantRole(['admin', 'manager']), (req, res) => {
  const compId = req.params['id'] as string;
  const companyDevices = Array.from(centralState.devices.values()).filter(d => d.companyId === compId);
  res.json(companyDevices);
});

const deviceRegisterSchema = z.object({
  name: z.string().min(1, 'Nome do terminal é obrigatório.'),
  branchId: z.string().optional(),
  installationId: z.string().min(1, 'ID de instalação é obrigatório.'),
  fingerprintHash: z.string().min(1, 'Fingerprint Hash é obrigatório.'),
  platform: z.enum(['web', 'android', 'windows', 'ios']).optional(),
  osVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$/, 'Versão do OS inválida. Deve seguir o formato SemVer x.y.z').default('1.4.3')
});

// POST /companies/:id/devices - Register new hardware terminal/device for a tenant branch
companiesRouter.post('/companies/:id/devices', requireTenantRole(['admin']), validateBody(deviceRegisterSchema), (req: AuthenticatedRequest, res) => {
  const compId = req.params['id'] as string;
  const company = centralState.companies.get(compId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const { name, branchId, installationId, fingerprintHash, platform, osVersion } = req.body;

  // Validate stable channel against pre-release versions
  if (company.channel === 'stable' && osVersion && osVersion.includes('-')) {
    res.status(400).json({ error: 'Terminais de empresas no canal estável (stable) não podem registrar versões de desenvolvimento ou beta.' });
    return;
  }

  // Check branch existence
  const branches = company.branches || [];
  const targetBranch = branches.find(b => b.id === (branchId || branches[0]?.id));
  if (!targetBranch) {
    res.status(400).json({ error: 'Filial de destino não encontrada para vincular o dispositivo.' });
    return;
  }

  // Check if already registered
  const existingDevice = Array.from(centralState.devices.values()).find(
    d => d.companyId === compId && (d.installationId === installationId || d.fingerprintHash === fingerprintHash)
  );

  if (existingDevice) {
    // Update existing device info
    existingDevice.name = name;
    existingDevice.branchId = targetBranch.id;
    existingDevice.lastSeenAt = new Date().toISOString();
    existingDevice.platform = platform || existingDevice.platform;
    existingDevice.osVersion = osVersion || existingDevice.osVersion;

    centralDatabase.registerDeviceTransaction({
      id: existingDevice.deviceId,
      companyId: compId,
      branchId: targetBranch.id,
      name,
      status: existingDevice.status,
      platform: existingDevice.platform,
      osVersion: existingDevice.osVersion,
      fingerprintHash: existingDevice.fingerprintHash,
      installationId: existingDevice.installationId,
      createdAt: existingDevice.registeredAt,
      lastActiveAt: existingDevice.lastSeenAt
    });

    centralState.devices.set(existingDevice.deviceId, existingDevice);
    saveCentralState();
    res.json({ success: true, device: existingDevice, updated: true });
    return;
  }

  // Enforce company terminal quotas (maxTerminals)
  const activeCount = Array.from(centralState.devices.values()).filter(d => d.companyId === compId && d.status === 'active').length;
  const maxAllowed = company.maxTerminals || 5;
  if (activeCount >= maxAllowed) {
    res.status(403).json({ error: `Limite de terminais atingido (${activeCount}/${maxAllowed}) para o plano atual.` });
    return;
  }

  const deviceId = `dev_${compId}_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 6)}`;
  const newDevice: DeviceRegistrationData = {
    deviceId,
    companyId: compId,
    branchId: targetBranch.id,
    name,
    installationId,
    fingerprintHash,
    platform: platform || 'web',
    osVersion: osVersion || '1.1.0-lts',
    status: 'active',
    lastSeenAt: new Date().toISOString(),
    registeredAt: new Date().toISOString(),
    ipAddress: req.ip || req.socket.remoteAddress
  };

  try {
    centralDatabase.registerDeviceTransaction({
      id: deviceId,
      companyId: compId,
      branchId: targetBranch.id,
      name,
      status: 'active',
      platform: platform || 'web',
      osVersion: osVersion || '1.1.0-lts',
      fingerprintHash,
      installationId,
      createdAt: newDevice.registeredAt,
      lastActiveAt: newDevice.lastSeenAt
    });

    // Synchronize cache
    centralState.devices.set(deviceId, newDevice);
    company.activeTerminals = (company.activeTerminals || 0) + 1;
    centralState.companies.set(compId, company);

    if (req.user?.role === 'hq_admin') {
      recordHqAuditLog({
        hqAdminId: req.user.id,
        hqAdminEmail: req.user.email,
        action: 'REGISTER_DEVICE',
        targetCompanyId: compId,
        details: `Terminal '${name}' (${deviceId}) registrado na filial '${targetBranch.name}'.`
      });
    }

    saveCentralState();
    res.status(201).json({ success: true, device: newDevice });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg || 'Falha ao registrar terminal no banco de dados.' });
  }
});

const updateDeviceStatusSchema = z.object({
  status: z.enum(['active', 'blocked', 'pending'])
});

// PATCH /companies/:id/devices/:deviceId/status - Block or activate terminal
companiesRouter.patch('/companies/:id/devices/:deviceId/status', requireTenantRole(['admin']), validateBody(updateDeviceStatusSchema), (req: AuthenticatedRequest, res) => {
  const compId = req.params['id'] as string;
  const deviceId = req.params['deviceId'] as string;
  const { status } = req.body || {};

  const device = centralState.devices.get(deviceId);
  if (!device || device.companyId !== compId) {
    res.status(404).json({ error: 'Terminal não encontrado nesta empresa.' });
    return;
  }

  try {
    const prevStatus = device.status;
    centralDatabase.updateDeviceStatusTransaction(compId, deviceId, status);

    // Adjust in-memory company activeTerminals count
    const company = centralState.companies.get(compId);
    if (company) {
      if (prevStatus === 'active' && status !== 'active') {
        company.activeTerminals = Math.max(0, (company.activeTerminals || 0) - 1);
      } else if (prevStatus !== 'active' && status === 'active') {
        company.activeTerminals = (company.activeTerminals || 0) + 1;
      }
      centralState.companies.set(compId, company);
    }

    device.status = status;
    centralState.devices.set(deviceId, device);
    saveCentralState();

    res.json({ success: true, device });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg || 'Falha ao alterar status do terminal no banco de dados.' });
  }
});

// DELETE /companies/:id/devices/:deviceId - Unregister hardware terminal
companiesRouter.delete('/companies/:id/devices/:deviceId', requireTenantRole(['admin']), (req: AuthenticatedRequest, res) => {
  const compId = req.params['id'] as string;
  const deviceId = req.params['deviceId'] as string;

  const device = centralState.devices.get(deviceId);
  if (!device || device.companyId !== compId) {
    res.status(404).json({ error: 'Terminal não encontrado nesta empresa.' });
    return;
  }

  try {
    const prevStatus = device.status;
    centralDatabase.deleteDeviceTransaction(compId, deviceId);

    centralState.devices.delete(deviceId);
    const company = centralState.companies.get(compId);
    if (company && prevStatus === 'active' && company.activeTerminals && company.activeTerminals > 0) {
      company.activeTerminals -= 1;
      centralState.companies.set(compId, company);
    }

    saveCentralState();
    res.json({ success: true, message: 'Terminal desvinculado com sucesso.' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg || 'Falha ao remover terminal no banco de dados.' });
  }
});

// GET /hq/store/diagnostics - Central Store health and entity metrics (HQ Admin)
companiesRouter.get('/hq/store/diagnostics', requireHqAdmin, (_req, res) => {
  const diagnostics = getCentralStoreDiagnostics();
  res.json(diagnostics);
});

// POST /hq/store/backup - Trigger immediate immutable snapshot of Central Store (HQ Admin)
companiesRouter.post('/hq/store/backup', requireHqAdmin, (req: AuthenticatedRequest, res) => {
  const { note } = req.body || {};
  try {
    const result = createCentralStoreSnapshot(note);
    recordHqAuditLog({
      hqAdminId: req.user?.id || 'hq_admin',
      hqAdminEmail: req.user?.email || 'admin@3eatcru.com',
      action: 'CENTRAL_STORE_BACKUP',
      details: `Snapshot criado com sucesso: ${result.snapshotFile} (${(result.sizeBytes / 1024).toFixed(1)} KB)`
    });
    res.json({
      success: true,
      message: 'Snapshot de backup da Central Store gerado com sucesso.',
      ...result
    });
  } catch (err) {
    console.error('Error generating central store snapshot:', err);
    res.status(500).json({ error: 'Erro ao criar snapshot de backup da Central Store.' });
  }
});

// POST /hq/store/compact - Trigger compaction, prune stale logs and flush (HQ Admin)
companiesRouter.post('/hq/store/compact', requireHqAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const diagnostics = compactCentralStore();
    recordHqAuditLog({
      hqAdminId: req.user?.id || 'hq_admin',
      hqAdminEmail: req.user?.email || 'admin@3eatcru.com',
      action: 'CENTRAL_STORE_COMPACT',
      details: `Central Store compactada e reindexada. Status: ${diagnostics.status}, Tamanho: ${(diagnostics.fileSizeBytes / 1024).toFixed(1)} KB`
    });
    res.json({
      success: true,
      message: 'Central Store compactada e validada com sucesso.',
      diagnostics
    });
  } catch (err) {
    console.error('Error compacting central store:', err);
    res.status(500).json({ error: 'Erro ao compactar Central Store.' });
  }
});

