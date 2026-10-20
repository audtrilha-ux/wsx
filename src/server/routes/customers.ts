import { Router } from 'express';
import { centralState, CustomerData } from '../state.js';
import { requireTenantRole, AuthenticatedRequest, resolveEffectiveTenant, assertBranchAccess } from '../middleware.js';

export const customersRouter = Router();

customersRouter.get('/customers', requireTenantRole(['admin', 'manager', 'operator']), (req: AuthenticatedRequest, res) => {
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

  const customers: CustomerData[] = [];
  for (const c of centralState.customers.values()) {
    if (c.companyId === companyId) {
      if (targetBranchId && (c as unknown as { branchId?: string }).branchId && (c as unknown as { branchId?: string }).branchId !== targetBranchId) {
        continue;
      }
      customers.push(c);
    }
  }

  // Sort by name ascending
  customers.sort((a, b) => a.name.localeCompare(b.name));

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = Math.max(1, parseInt(pageQuery as string, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeQuery as string, 10) || 50), 100);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedCustomers = customers.slice(start, end);
    res.json({
      items: paginatedCustomers,
      total: customers.length,
      page,
      pageSize,
      totalPages: Math.ceil(customers.length / pageSize)
    });
  } else {
    res.json(customers);
  }
});
