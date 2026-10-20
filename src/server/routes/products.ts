import { Router } from 'express';
import { centralState, ProductData } from '../state.js';
import { requireTenantRole, AuthenticatedRequest, resolveEffectiveTenant, assertBranchAccess } from '../middleware.js';

export const productsRouter = Router();

productsRouter.get('/products', requireTenantRole(['admin', 'manager', 'operator']), (req: AuthenticatedRequest, res) => {
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

  const prods: ProductData[] = [];
  for (const p of centralState.products.values()) {
    if (p.companyId === companyId) {
      if (targetBranchId && (p as unknown as { branchId?: string }).branchId && (p as unknown as { branchId?: string }).branchId !== targetBranchId) {
        continue;
      }
      prods.push(p);
    }
  }

  // Sort by name ascending
  prods.sort((a, b) => a.name.localeCompare(b.name));

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = Math.max(1, parseInt(pageQuery as string, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeQuery as string, 10) || 50), 100);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedProducts = prods.slice(start, end);
    res.json({
      items: paginatedProducts,
      total: prods.length,
      page,
      pageSize,
      totalPages: Math.ceil(prods.length / pageSize)
    });
  } else {
    res.json(prods);
  }
});
