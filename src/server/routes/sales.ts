import { Router } from 'express';
import { centralState, SaleData } from '../state.js';
import { requireTenantRole, requireHqAdmin, AuthenticatedRequest, resolveEffectiveTenant, assertBranchAccess } from '../middleware.js';

export const salesRouter = Router();

// HQ Analytics Sales Endpoint (Ecosystem-wide metrics for HQ Control Plane)
salesRouter.get('/hq/analytics/sales', requireHqAdmin, (_req: AuthenticatedRequest, res) => {
  const sales: SaleData[] = Array.from(centralState.sales.values());
  sales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(sales);
});

salesRouter.get('/sales', requireTenantRole(['admin', 'manager', 'operator']), (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const companyId = resolveEffectiveTenant(req);
  const branchCheck = assertBranchAccess(req.user, req.query['branchId'] as string | undefined);
  if (!branchCheck.allowed) {
    res.status(403).json({ error: branchCheck.error });
    return;
  }
  const targetBranchId = branchCheck.effectiveBranchId;

  const sales: SaleData[] = [];
  for (const s of centralState.sales.values()) {
    if (s.companyId === companyId) {
      if (targetBranchId && s.branchId && s.branchId !== targetBranchId) {
        continue;
      }
      sales.push(s);
    }
  }

  // Sort by date descending
  sales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = Math.max(1, parseInt(pageQuery as string, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeQuery as string, 10) || 50), 100);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedSales = sales.slice(start, end);
    res.json({
      items: paginatedSales,
      total: sales.length,
      page,
      pageSize,
      totalPages: Math.ceil(sales.length / pageSize)
    });
  } else {
    res.json(sales);
  }
});
