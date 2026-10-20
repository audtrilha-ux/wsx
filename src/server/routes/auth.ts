import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { centralState, recordHqAuditLog, recordUserAuditLog, centralDatabase } from '../state.js';
import { signJwt, verifyPassword, revokeToken, refreshJwt, verifyJwt, verifyTotpCode } from '../config.js';
import { requireAuth, validateBody, AuthenticatedRequest, getClientIp } from '../middleware.js';

export const authRouter = Router();

function checkRateLimit(ip: string, maxAttempts = 10, windowMs = 60000): boolean {
  return centralDatabase.checkRateLimit(ip, maxAttempts, windowMs);
}

// Resolves company by identifier (id, slug, or CNPJ) without leaking sensitive secrets
authRouter.get('/resolve-company', (req, res) => {
  const identifier = String(req.query['identifier'] || '').trim().toLowerCase();
  if (!identifier) {
    res.status(400).json({ error: 'Identificador de empresa (código, slug ou ID) é obrigatório.' });
    return;
  }

  const companiesList = Array.from(centralState.companies.values());
  const matched = companiesList.find(c => 
    c.id.toLowerCase() === identifier ||
    (c.slug && c.slug.toLowerCase() === identifier) ||
    (c.cnpj && c.cnpj.replace(/\D/g, '') === identifier.replace(/\D/g, '')) ||
    c.name.toLowerCase() === identifier
  );

  if (!matched) {
    res.status(404).json({ error: 'Empresa não encontrada no sistema central 3eatcru.' });
    return;
  }

  res.json({
    success: true,
    company: {
      id: matched.id,
      name: matched.name,
      slug: matched.slug || matched.id,
      status: matched.status,
      plan: matched.plan || 'pro',
      logoUrl: matched.logoUrl,
      branches: (matched.branches || [])
        .filter(b => b.isActive !== false)
        .map(b => ({
          id: b.id,
          name: b.name,
          isMain: !!b.isMain
        }))
    }
  });
});

// Role-based permission matrix for strict RBAC
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['sales.*', 'inventory.*', 'finance.*', 'crm.*', 'tables.*', 'settings.*', 'reports.*', 'users.*'],
  manager: ['sales.*', 'inventory.*', 'finance.read', 'crm.*', 'tables.*', 'reports.read'],
  operator: ['sales.create', 'sales.read', 'tables.read', 'tables.update', 'crm.read', 'customers.create']
};

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
  companyId: z.string().optional(),
  companyIdentifier: z.string().optional(),
  branchId: z.string().optional()
}).refine(data => data.companyId || data.companyIdentifier, {
  message: "A identificação da empresa (companyId ou código) é estritamente obrigatória.",
  path: ["companyId", "companyIdentifier"]
});

authRouter.post('/login', validateBody(loginSchema), (req, res) => {
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 10, 60000)) {
    res.status(429).json({ error: 'Muitas tentativas de login. Aguarde 1 minuto antes de tentar novamente.' });
    return;
  }

  const { email, password, companyId, companyIdentifier, branchId } = req.body;

  // Resolve target company strictly
  let targetCompanyId = (companyId || companyIdentifier) as string | undefined;
  if (!targetCompanyId) {
    res.status(400).json({ error: 'A identificação da empresa (companyId ou código) é estritamente obrigatória.' });
    return;
  }

  // Resolve if companyIdentifier is a slug or name
  let targetCompany = centralState.companies.get(targetCompanyId);
  if (!targetCompany) {
    const companiesList = Array.from(centralState.companies.values());
    const matched = companiesList.find(c => 
      c.id.toLowerCase() === targetCompanyId!.toLowerCase() ||
      (c.slug && c.slug.toLowerCase() === targetCompanyId!.toLowerCase()) ||
      (c.cnpj && c.cnpj.replace(/\D/g, '') === targetCompanyId!.replace(/\D/g, ''))
    );
    if (matched) {
      targetCompany = matched;
      targetCompanyId = matched.id;
    }
  }

  if (!targetCompany) {
    res.status(404).json({ error: 'Empresa não encontrada no sistema central.' });
    return;
  }

  if (targetCompany.status === 'suspended') {
    res.status(403).json({ error: 'O acesso desta empresa encontra-se suspenso no HQ. Entre em contato com a administração.' });
    return;
  }

  // Strictly search users ONLY within the matched tenant boundary
  const companyUsers = centralState.companyUsers.get(targetCompanyId) || [];
  const matchedUser = companyUsers.find(u => 
    u.email.toLowerCase() === String(email).toLowerCase().trim()
  );

  if (!matchedUser) {
    res.status(401).json({ error: 'Credenciais inválidas para esta empresa.' });
    return;
  }

  if (matchedUser.status === 'suspended') {
    res.status(403).json({ error: 'Conta de operador suspensa nesta empresa.' });
    return;
  }

  // Strict session authentication: password only (PIN is strictly for terminal operator-unlock)
  if (!matchedUser.password || !verifyPassword(String(password), matchedUser.password)) {
    res.status(401).json({ error: 'Credenciais inválidas para esta empresa.' });
    return;
  }

  // Branch validation and access restriction
  let selectedBranchId = branchId as string | undefined;
  let selectedBranchName: string | undefined;

  if (targetCompany.branches && targetCompany.branches.length > 0) {
    if (selectedBranchId) {
      const foundBranch = targetCompany.branches.find(b => b.id === selectedBranchId);
      if (!foundBranch) {
        res.status(400).json({ error: 'A unidade/filial selecionada não pertence a esta empresa.' });
        return;
      }
      if (foundBranch.isActive === false) {
        res.status(403).json({ error: 'A unidade/filial selecionada está temporariamente desativada.' });
        return;
      }
      selectedBranchName = foundBranch.name;
    } else {
      // Pick first allowed branch or first active branch
      const allowedBranches = matchedUser.branchIds && matchedUser.branchIds.length > 0
        ? targetCompany.branches.filter(b => matchedUser.branchIds?.includes(b.id))
        : targetCompany.branches;

      const defaultBranch = allowedBranches.find(b => b.isActive !== false) || allowedBranches[0];
      if (defaultBranch) {
        selectedBranchId = defaultBranch.id;
        selectedBranchName = defaultBranch.name;
      }
    }

    // If user has specific branch restrictions, ensure selectedBranchId is in their allowed list
    if (matchedUser.branchIds && matchedUser.branchIds.length > 0 && selectedBranchId) {
      if (!matchedUser.branchIds.includes(selectedBranchId)) {
        res.status(403).json({ error: 'Acesso negado: Este operador não possui permissão para atuar nesta unidade/filial.' });
        return;
      }
    }
  }

  const permissions = ROLE_PERMISSIONS[matchedUser.role] || ['sales.read'];

  const userBranchIds = Array.isArray(matchedUser.branchIds) && matchedUser.branchIds.length > 0 
    ? matchedUser.branchIds 
    : (selectedBranchId ? [selectedBranchId] : []);

  const token = signJwt({
    id: matchedUser.id,
    name: matchedUser.name,
    email: matchedUser.email,
    role: matchedUser.role,
    authPlane: 'CLIENT',
    companyId: targetCompanyId,
    branchId: selectedBranchId,
    branchIds: userBranchIds
  });

  res.cookie('3eatcru_client_token', token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    maxAge: 86400 * 1000 // 24 hours
  });

  const sessionId = `sess_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;

  recordUserAuditLog({
    userId: matchedUser.id,
    userEmail: matchedUser.email,
    companyId: targetCompanyId!,
    action: 'USER_LOGIN',
    details: `Operador '${matchedUser.name}' efetuou login no sistema (Filial: ${selectedBranchName || 'Principal'}).`,
    ip: clientIp
  });

  res.json({
    success: true,
    token,
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
    session: {
      sessionId,
      identity: {
        id: matchedUser.id,
        username: matchedUser.email.split('@')[0],
        displayName: matchedUser.name,
        email: matchedUser.email,
        role: matchedUser.role,
        permissions,
        branchIds: matchedUser.branchIds || []
      },
      tenant: {
        tenantId: targetCompany.id,
        tenantName: targetCompany.name,
        balance: targetCompany.balance,
        status: targetCompany.status,
        plan: targetCompany.plan || 'pro',
        installedApps: targetCompany.installedApps || [],
        branchId: selectedBranchId,
        branchName: selectedBranchName
      },
      sessionType: 'CLIENT',
      authVersion: '2.0.0'
    },
    // Backwards compatibility for existing client callers
    user: {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
      companyId: targetCompanyId,
      branchId: selectedBranchId
    },
    tenant: {
      tenantId: targetCompany.id,
      tenantName: targetCompany.name,
      balance: targetCompany.balance,
      status: targetCompany.status,
      plan: targetCompany.plan || 'pro',
      installedApps: targetCompany.installedApps,
      branchId: selectedBranchId,
      branchName: selectedBranchName
    }
  });
});

const recoverySchema = z.object({
  email: z.string().email('Informe um e-mail válido para a recuperação de acesso.')
});

authRouter.post('/recovery', validateBody(recoverySchema), (req, res) => {
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 5, 60000)) {
    res.status(429).json({ error: 'Muitas solicitações de recuperação de acesso. Aguarde 1 minuto.' });
    return;
  }

  // Neutral security response to prevent account enumeration
  res.json({
    success: true,
    message: 'Se o e-mail informado estiver registrado em nossa plataforma, as instruções para redefinição de senha foram encaminhadas com segurança.'
  });
});

const hqLoginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(1, 'Senha é obrigatória.'),
  mfaCode: z.string().optional()
});

authRouter.post('/hq-login', validateBody(hqLoginSchema), (req, res) => {
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 6, 60000)) {
    recordHqAuditLog({
      hqAdminId: 'system_rate_limit',
      hqAdminEmail: 'security@3eatcru.com.br',
      action: 'HQ_LOGIN_RATE_LIMITED',
      details: `Tentativa de login de controle HQ bloqueada por excesso de requisições. IP: ${clientIp}`,
      ip: clientIp
    });
    res.status(429).json({ error: 'Muitas tentativas de login de controle HQ. Aguarde 1 minuto.' });
    return;
  }

  const { email, password, mfaCode } = req.body;

  if (process.env['NODE_ENV'] === 'production' && !process.env['HQ_ADMIN_PASSWORD'] && !process.env['HQ_ADMIN_SECRET']) {
    res.status(500).json({ error: 'Erro crítico de configuração do servidor: A variável de ambiente HQ_ADMIN_PASSWORD é obrigatória no ambiente de produção.' });
    return;
  }

  const admin = centralState.hqAdmins.find(a => a.email.toLowerCase() === String(email).toLowerCase().trim());
  if (!admin || !verifyPassword(String(password), admin.password)) {
    if (admin) {
      recordHqAuditLog({
        hqAdminId: admin.id,
        hqAdminEmail: admin.email,
        action: 'HQ_LOGIN_FAILED',
        details: `Tentativa de login malsucedida (senha incorreta) para o e-mail: ${email}`,
        ip: clientIp
      });
    } else {
      recordHqAuditLog({
        hqAdminId: 'system_security',
        hqAdminEmail: String(email),
        action: 'HQ_LOGIN_UNKNOWN_USER',
        details: `Tentativa de login de controle HQ com e-mail inexistente: ${email}`,
        ip: clientIp
      });
    }
    res.status(401).json({ error: 'Credenciais de HQ Admin inválidas.' });
    return;
  }

  // MFA Verification check (Mandatory for HQ Admins in production)
  const isProduction = process.env['NODE_ENV'] === 'production';
  if (isProduction && !mfaCode) {
    res.status(401).json({ error: 'Código de autenticação multifator (MFA) é estritamente obrigatório para o HQ Admin em produção.' });
    return;
  }

  if (mfaCode) {
    const totpSecret = admin.mfaSecret || process.env['HQ_ADMIN_MFA_SECRET'];
    if (!totpSecret) {
      res.status(500).json({ error: 'Erro crítico de configuração do servidor: Segredo MFA do HQ Admin não configurado.' });
      return;
    }
    
    if (!verifyTotpCode(totpSecret, String(mfaCode))) {
      recordHqAuditLog({
        hqAdminId: admin.id,
        hqAdminEmail: admin.email,
        action: 'HQ_LOGIN_MFA_FAILED',
        details: `Código de verificação MFA incorreto ou expirado para o HQ Admin '${admin.name}'.`,
        ip: clientIp
      });
      res.status(401).json({ error: 'Código de autenticação multifator (MFA) incorreto ou expirado.' });
      return;
    }
  }

  const token = signJwt({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: 'hq_admin',
    authPlane: 'HQ',
    isImpersonating: false
  });

  res.cookie('3eatcru_hq_token', token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    maxAge: 86400 * 1000 // 24 hours
  });

  recordHqAuditLog({
    hqAdminId: admin.id,
    hqAdminEmail: admin.email,
    action: 'HQ_LOGIN_SUCCESS',
    details: `HQ Admin '${admin.name}' efetuou login com sucesso no painel de controle central.${mfaCode ? ' [MFA Verificado]' : ''}`,
    ip: clientIp
  });

  const sessionId = `hq_sess_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;

  res.json({
    success: true,
    token,
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
    session: {
      sessionId,
      identity: {
        id: admin.id,
        username: admin.email.split('@')[0],
        displayName: admin.name,
        email: admin.email,
        role: 'hq_admin',
        permissions: ['hq:all', 'hq:tenants', 'hq:billing', 'hq:catalog', 'hq:telemetry', 'hq:impersonate']
      },
      mfaVerified: !!mfaCode,
      sessionType: 'HQ',
      authVersion: '2.0.0'
    },
    user: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: 'hq_admin'
    }
  });
});

const operatorUnlockSchema = z.object({
  companyId: z.string().min(1, 'companyId é obrigatório.'),
  userId: z.string().min(1, 'userId é obrigatório.'),
  pin: z.string().min(1, 'pin é obrigatório.')
});

authRouter.post('/operator-unlock', validateBody(operatorUnlockSchema), (req, res) => {
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 10, 60000)) {
    res.status(429).json({ error: 'Muitas tentativas de desbloqueio de operador por este endereço IP. Aguarde 1 minuto.' });
    return;
  }

  // Security Check: Require terminal session bearer token or authenticated session
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sessão do terminal não autenticada. Cabeçalho de autorização é obrigatório.' });
    return;
  }

  const token = authHeader.substring(7);
  const decoded = verifyJwt(token);
  if (!decoded) {
    res.status(401).json({ error: 'Token de sessão do terminal inválido ou expirado.' });
    return;
  }

  // SEC-001: Require an operational session (CLIENT plane) or HQ admin. Reject customer tokens.
  const authPlane = decoded['authPlane'];
  const callerRole = decoded['role'];
  if (authPlane !== 'CLIENT' && callerRole !== 'hq_admin') {
    res.status(403).json({ error: 'Sessão operacional inválida. Tokens de consumidor ou externos não possuem permissão de terminal.' });
    return;
  }

  const { companyId, userId, pin } = req.body;

  // SEC-001: Strict company verification on server. Tokens without matching companyId are rejected.
  const tokenCompanyId = decoded['companyId'];
  if (callerRole !== 'hq_admin') {
    if (!tokenCompanyId) {
      res.status(403).json({ error: 'Token sem identificação de empresa válida.' });
      return;
    }
    if (tokenCompanyId !== companyId) {
      res.status(403).json({ error: 'Acesso não autorizado para esta empresa.' });
      return;
    }
  }

  // SEC-001: Rate limiting protection per account and per operator against PIN brute-force
  const opRateKey = `op_unlock_${companyId}_${userId}`;
  const compRateKey = `comp_unlock_${companyId}`;
  if (!checkRateLimit(opRateKey, 5, 300000)) {
    res.status(429).json({ error: 'Muitas tentativas de desbloqueio para este operador. Bloqueado temporariamente por 5 minutos.' });
    return;
  }
  if (!checkRateLimit(compRateKey, 30, 300000)) {
    res.status(429).json({ error: 'Limite de tentativas de desbloqueio excedido para esta empresa. Tente novamente mais tarde.' });
    return;
  }

  const users = centralState.companyUsers.get(companyId);
  if (!users) {
    res.status(404).json({ error: 'Empresa não encontrada ou sem operadores cadastrados.' });
    return;
  }

  const user = users.find(u => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'Operador não encontrado.' });
    return;
  }

  if (user.status === 'suspended') {
    res.status(403).json({ error: 'Este operador está suspenso.' });
    return;
  }

  // SEC-001: Verify branch access restriction on the server
  const sessionBranchId = decoded['branchId'] as string | undefined;
  if (sessionBranchId && Array.isArray(user.branchIds) && user.branchIds.length > 0) {
    if (!user.branchIds.includes(sessionBranchId)) {
      res.status(403).json({ error: 'Acesso negado: Este operador não possui permissão para atuar na unidade/filial deste terminal.' });
      return;
    }
  }

  // P0.2 Security Hardening: Strictly require cryptographic verification. Reject plaintext pins.
  if (!user.pin || !verifyPassword(String(pin), user.pin)) {
    res.status(401).json({ error: 'PIN incorreto.' });
    return;
  }

  res.json({
    success: true,
    operator: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email
    }
  });
});

authRouter.post('/logout', (req, res) => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies['3eatcru_hq_token']) {
    token = req.cookies['3eatcru_hq_token'];
  } else if (req.cookies && req.cookies['3eatcru_client_token']) {
    token = req.cookies['3eatcru_client_token'];
  }

  res.clearCookie('3eatcru_client_token');
  res.clearCookie('3eatcru_hq_token');

  if (token) {
    // Attempt decoding of token BEFORE revoking to see if it was an HQ Admin
    const decoded = verifyJwt(token);
    revokeToken(token);

    if (decoded && decoded['role'] === 'hq_admin') {
      recordHqAuditLog({
        hqAdminId: decoded['id'] as string,
        hqAdminEmail: decoded['email'] as string,
        action: 'HQ_LOGOUT',
        details: `HQ Admin '${decoded['name']}' encerrou a sessão com sucesso.`,
        ip: getClientIp(req)
      });
    }
  }
  res.json({ success: true, message: 'Sessão encerrada com sucesso e token revogado.' });
});

authRouter.post('/refresh', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autorização ausente para renovação.' });
    return;
  }
  const oldToken = authHeader.substring(7);
  
  // Extract user details before revoking/refreshing the token
  const decoded = verifyJwt(oldToken);
  if (decoded && (decoded['isImpersonating'] === true || decoded['authPlane'] === 'SUPPORT' || (typeof decoded['id'] === 'string' && decoded['id'].startsWith('support_')))) {
    res.status(403).json({ error: 'Tokens de suporte e impersonação temporários não podem ser renovados. Por favor, solicite nova janela de atendimento.' });
    return;
  }

  const newToken = refreshJwt(oldToken);
  if (!newToken) {
    res.status(401).json({ error: 'Token inválido ou expirado para renovação.' });
    return;
  }

  if (decoded && decoded['role'] === 'hq_admin') {
    recordHqAuditLog({
      hqAdminId: decoded['id'] as string,
      hqAdminEmail: decoded['email'] as string,
      action: 'HQ_TOKEN_REFRESH',
      details: `HQ Admin '${decoded['name']}' renovou a validade do seu token JWT.`,
      ip: getClientIp(req)
    });
  }

  res.json({
    success: true,
    token: newToken,
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString()
  });
});

authRouter.get('/client/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const company = req.user.companyId ? centralState.companies.get(req.user.companyId) : null;
  const branch = (company && req.user.branchId) ? company.branches?.find(b => b.id === req.user?.branchId) : null;

  res.json({
    valid: true,
    user: req.user,
    tenant: company ? {
      tenantId: company.id,
      tenantName: company.name,
      balance: company.balance,
      status: company.status,
      plan: company.plan || 'pro',
      installedApps: company.installedApps,
      branchId: req.user.branchId || branch?.id,
      branchName: branch?.name
    } : null
  });
});

authRouter.get('/hq/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user || req.user.role !== 'hq_admin' || req.user.isImpersonating === true || req.user.authPlane === 'SUPPORT') {
    res.status(403).json({ error: 'Recurso restrito exclusivamente a sessões primárias do HQ Admin.' });
    return;
  }
  res.json({
    valid: true,
    user: req.user
  });
});

const impersonateSchema = z.object({
  companyId: z.string().min(1, 'companyId é obrigatório para iniciar a impersonação de suporte.'),
  reason: z.string().max(500).optional()
});

/**
 * HQ Impersonation (Support Mode) with Full Auditing
 */
authRouter.post('/impersonate', requireAuth, validateBody(impersonateSchema), (req: AuthenticatedRequest, res) => {
  if (!req.user || req.user.role !== 'hq_admin' || req.user.isImpersonating === true || req.user.authPlane === 'SUPPORT') {
    res.status(403).json({ error: 'Acesso negado: Apenas Administradores nativos do HQ OS (sessão primária) podem iniciar sessões de suporte.' });
    return;
  }

  const { companyId, reason } = req.body as z.infer<typeof impersonateSchema>;

  const targetCompany = centralState.companies.get(companyId);
  if (!targetCompany) {
    res.status(404).json({ error: 'Empresa de destino não encontrada no catálogo de tenants.' });
    return;
  }

  const clientIp = getClientIp(req);

  // Record audit log for security accountability
  recordHqAuditLog({
    hqAdminId: req.user.id,
    hqAdminEmail: req.user.email,
    action: 'SUPPORT_SESSION_STARTED',
    details: `HQ Admin '${req.user.name}' iniciou sessão de suporte para o tenant '${targetCompany.name}' (${targetCompany.id}). Motivo: ${reason || 'Atendimento técnico de suporte'}`,
    ip: clientIp
  });

  const supportPayload = {
    id: `support_${req.user.id}`,
    name: `Suporte HQ (${req.user.name})`,
    email: req.user.email,
    role: 'hq_admin',
    authPlane: 'SUPPORT',
    isImpersonating: true,
    performedBy: req.user.id,
    actingAs: targetCompany.id,
    companyId: targetCompany.id,
    companyName: targetCompany.name
  };

  const supportToken = signJwt(supportPayload, 8 * 3600); // 8 hours duration for support window

  res.cookie('3eatcru_client_token', supportToken, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    maxAge: 8 * 3600 * 1000 // 8 hours
  });

  res.json({
    success: true,
    token: supportToken,
    expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    session: {
      identity: {
        id: supportPayload.id,
        username: req.user.email.split('@')[0] || 'hq_admin',
        displayName: supportPayload.name,
        email: req.user.email,
        role: 'hq_admin'
      },
      tenant: {
        tenantId: targetCompany.id,
        tenantName: targetCompany.name,
        plan: targetCompany.plan || 'pro',
        status: targetCompany.status,
        balance: targetCompany.balance
      }
    }
  });
});

authRouter.post('/impersonate/exit', requireAuth, (req: AuthenticatedRequest, res) => {
  res.clearCookie('3eatcru_client_token');
  if (req.user) {
    const clientIp = getClientIp(req);
    recordHqAuditLog({
      hqAdminId: req.user.performedBy || req.user.id,
      hqAdminEmail: req.user.email,
      action: 'SUPPORT_SESSION_ENDED',
      details: `HQ Admin encerrou a sessão de suporte para o tenant '${req.user.companyId || 'Desconhecido'}'.`,
      ip: clientIp
    });
  }
  res.json({ success: true, message: 'Sessão de suporte encerrada com sucesso.' });
});
