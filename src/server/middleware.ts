import { Response, NextFunction, Request } from 'express';
import crypto from 'node:crypto';
import { verifyJwt } from './config.js';
import { centralState } from './state.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: 'hq_admin' | 'admin' | 'manager' | 'operator' | 'customer';
    authPlane?: 'HQ' | 'CLIENT' | 'SUPPORT' | 'CUSTOMER';
    companyId?: string;
    branchId?: string;
    branchIds?: string[];
    customerAccountId?: string;
    performedBy?: string;
    isImpersonating?: boolean;
    actingAs?: string;
  };
}

export function getClientIp(req: Request): string {
  // Com app.set('trust proxy', 1), req.ip conterá o IP real do cliente sanitizado pelo Express.
  let ip = req.ip || req.socket.remoteAddress || 'unknown_ip';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  return ip;
}

export function resolveEffectiveTenant(req: AuthenticatedRequest): string | null {
  if (!req.user) return null;
  // Support impersonation sessions are strictly locked to actingAs company:
  if (req.user.isImpersonating || req.user.authPlane === 'SUPPORT') {
    return req.user.actingAs || req.user.companyId || null;
  }
  // True HQ admins (not in impersonation/support mode) can specify a target tenant via query or header:
  if (req.user.authPlane === 'HQ' || (req.user.role === 'hq_admin' && !req.user.isImpersonating)) {
    const queryComp = (req.query?.['companyId'] as string) || (req.headers?.['x-company-id'] as string);
    return queryComp || req.user.companyId || null;
  }
  return req.user.companyId || null;
}

export function assertBranchAccess(
  user: AuthenticatedRequest['user'],
  targetBranchId?: string
): { allowed: boolean; effectiveBranchId: string; error?: string } {
  if (!user) {
    return { allowed: false, effectiveBranchId: '', error: 'Usuário não autenticado.' };
  }

  const defaultBranchId = user.branchId || 'main';
  const requestedBranchId = targetBranchId || defaultBranchId;

  // HQ Admins and Tenant Admins have full access to all branches within their tenant
  if (user.role === 'hq_admin' || user.role === 'admin' || user.authPlane === 'HQ') {
    return { allowed: true, effectiveBranchId: requestedBranchId };
  }

  // Operators/Managers with branchIds restriction
  const allowedBranchIds = (user as Record<string, unknown>)['branchIds'] as string[] | undefined;
  if (allowedBranchIds && Array.isArray(allowedBranchIds) && allowedBranchIds.length > 0) {
    if (!allowedBranchIds.includes('*') && !allowedBranchIds.includes(requestedBranchId)) {
      return {
        allowed: false,
        effectiveBranchId: defaultBranchId,
        error: `Acesso negado: Operador não possui autorização para a filial '${requestedBranchId}'.`
      };
    }
  } else if (user.branchId && requestedBranchId !== user.branchId) {
    return {
      allowed: false,
      effectiveBranchId: defaultBranchId,
      error: `Acesso negado: Operador não possui autorização para a filial '${requestedBranchId}'.`
    };
  }

  return { allowed: true, effectiveBranchId: requestedBranchId };
}

function getCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token: string | null = null;
  const path = req.path || req.url || '';
  const isHqPath = path.includes('/hq/') || path.includes('/hq-');

  // 1. Try to read from Cookie header (highly secure HttpOnly)
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const clientToken = getCookie(cookieHeader, '3eatcru_client_token');
    const hqToken = getCookie(cookieHeader, '3eatcru_hq_token');
    
    if (isHqPath) {
      token = hqToken;
    } else {
      token = clientToken;
    }
  }

  // 2. Fall back to Authorization header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Acesso negado. Token de autenticação não fornecido.' });
    return;
  }

  const decoded = verifyJwt(token) as AuthenticatedRequest['user'];
  if (!decoded) {
    res.status(401).json({ error: 'Sessão expirada ou token inválido. Por favor, faça login novamente.' });
    return;
  }

  req.user = decoded;
  next();
};

export const requireHqAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  requireAuth(req, res, () => {
    // Reject support impersonation sessions from calling global HQ admin routes!
    if (req.user?.isImpersonating || req.user?.authPlane === 'SUPPORT') {
      res.status(403).json({ error: 'Permissão negada. Sessões de suporte não possuem acesso a rotas globais do HQ Control Plane.' });
      return;
    }
    if (req.user && (req.user.authPlane === 'HQ' || req.user.role === 'hq_admin')) {
      next();
    } else {
      res.status(403).json({ error: 'Permissão negada. Recurso exclusivo do HQ Control Plane.' });
    }
  });
};

export const requireTenant = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  requireAuth(req, res, () => {
    if (!req.user) return;

    // Support impersonation sessions must be strictly scoped to actingAs company
    if (req.user.isImpersonating || req.user.authPlane === 'SUPPORT') {
      const allowedCompanyId = req.user.actingAs || req.user.companyId;
      if (!allowedCompanyId) {
        res.status(403).json({ error: 'Sessão de suporte sem empresa-alvo autorizada.' });
        return;
      }

      const requestedCompanyId = req.params['id'] || 
        req.params['companyId'] || 
        (req.body && req.body.companyId) || 
        (req.query && (req.query['companyId'] as string)) || 
        (req.headers['x-company-id'] as string);

      if (requestedCompanyId && requestedCompanyId !== allowedCompanyId) {
        res.status(403).json({ error: 'Acesso negado. A sessão de suporte está restrita exclusivamente à empresa autorizada.' });
        return;
      }

      req.user.companyId = allowedCompanyId;
      next();
      return;
    }

    if (req.user.authPlane === 'HQ' || (req.user.role === 'hq_admin' && !req.user.companyId)) {
      res.status(403).json({ error: 'Acesso negado. Administradores HQ devem usar sessão de suporte auditada para acessar recursos de tenant.' });
      return;
    }

    if (!req.user.companyId) {
      res.status(403).json({ error: 'Usuário sem empresa associada.' });
      return;
    }

    // Isolate by companyId for parameterized paths (IDOR prevention)
    if (req.params['id'] && req.params['id'] !== req.user.companyId) {
      res.status(403).json({ error: 'Acesso negado. Tentativa de violação de limite de tenant (IDOR).' });
      return;
    }

    if (req.params['companyId'] && req.params['companyId'] !== req.user.companyId) {
      res.status(403).json({ error: 'Acesso negado. Tentativa de violação de limite de tenant (IDOR).' });
      return;
    }

    // Verify if companyId supplied in body matches authenticated user companyId
    if (req.body && req.body.companyId && req.body.companyId !== req.user.companyId) {
      res.status(403).json({ error: 'Acesso negado. Tentativa de modificação de dados de outro tenant (IDOR).' });
      return;
    }

    // Real-time suspension & expiration enforcement
    const company = centralState.companies.get(req.user.companyId);
    if (company) {
      if (company.status === 'suspended') {
        res.status(403).json({ error: 'Acesso negado. Sua licença corporativa está suspensa. Favor regularizar o saldo na central HQ.' });
        return;
      }
      if (company.licenseExpiresAt) {
        const expiry = new Date(company.licenseExpiresAt + 'T23:59:59Z');
        if (!isNaN(expiry.getTime()) && Date.now() > expiry.getTime()) {
          res.status(403).json({ error: 'Acesso negado. Sua licença corporativa expirou. Favor renovar a assinatura no Central HQ.' });
          return;
        }
      }
    }

    next();
  });
};

export const requireTenantRole = (allowedRoles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  requireTenant(req, res, () => {
    if (!req.user) return;
    if (req.user.role === 'hq_admin') {
      next();
      return;
    }
    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: `Permissão negada. Requer um dos seguintes perfis: ${allowedRoles.join(', ')}` });
    }
  });
};

export const requirePaymentGatewaySignature = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const gatewaySig = (req.headers['x-gateway-signature'] || req.headers['x-webhook-signature']) as string | undefined;
  
  if (!gatewaySig) {
    res.status(401).json({ error: 'Assinatura do gateway ausente.' });
    return;
  }

  const gatewaySecret = process.env['PAYMENT_GATEWAY_SECRET'];
  if (!gatewaySecret) {
    res.status(500).json({ error: 'Configuração de segurança do gateway ausente no servidor.' });
    return;
  }

  try {
    const hmac = crypto.createHmac('sha256', gatewaySecret);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawBody = (req as any).rawBody;
    if (Buffer.isBuffer(rawBody)) {
      hmac.update(rawBody);
    } else {
      hmac.update(JSON.stringify(req.body || {}));
    }
    const calculatedSig = hmac.digest('hex');

    const bufSig = Buffer.from(gatewaySig);
    const bufExp = Buffer.from(calculatedSig);

    if (bufSig.length === bufExp.length && crypto.timingSafeEqual(bufSig, bufExp)) {
      next();
    } else {
      res.status(403).json({ error: 'Assinatura do gateway inválida.' });
    }
  } catch {
    res.status(403).json({ error: 'Falha na validação da assinatura do gateway.' });
  }
};

import { ZodError, ZodTypeAny, ZodIssue } from 'zod';

export const validateBody = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ 
          error: 'Erro de validação de Schema (DTO).', 
          details: error.issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`)
        });
        return;
      }
      next(error);
    }
  };
};

export const requireCustomerAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token: string | null = null;

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    token = getCookie(cookieHeader, '3eatcru_customer_token');
  }

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Acesso negado. Token de consumidor 3eatcru ID não fornecido.' });
    return;
  }

  const decoded = verifyJwt(token) as AuthenticatedRequest['user'];
  if (!decoded || (decoded.role !== 'customer' && decoded.authPlane !== 'CUSTOMER')) {
    res.status(401).json({ error: 'Sessão de consumidor inválida ou expirada.' });
    return;
  }

  req.user = decoded;
  next();
};
