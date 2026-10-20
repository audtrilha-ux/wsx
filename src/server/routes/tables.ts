import { Router } from 'express';
import { centralState, TableData } from '../state.js';
import { requireTenantRole, AuthenticatedRequest, resolveEffectiveTenant, assertBranchAccess } from '../middleware.js';

export const tablesRouter = Router();

tablesRouter.get('/tables', requireTenantRole(['admin', 'manager', 'operator']), (req: AuthenticatedRequest, res) => {
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

  const tables: TableData[] = [];
  for (const t of centralState.tables.values()) {
    if (t.companyId === companyId) {
      if (targetBranchId && t.branchId && t.branchId !== targetBranchId) {
        continue;
      }
      tables.push(t);
    }
  }

  // Sort by number / name
  tables.sort((a, b) => (a.number || 0) - (b.number || 0));

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = Math.max(1, parseInt(pageQuery as string, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeQuery as string, 10) || 50), 100);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedTables = tables.slice(start, end);
    res.json({
      items: paginatedTables,
      total: tables.length,
      page,
      pageSize,
      totalPages: Math.ceil(tables.length / pageSize)
    });
  } else {
    res.json(tables);
  }
});
