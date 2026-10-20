import { Router } from 'express';
import { centralState, FinanceTransactionData } from '../state.js';
import { requireTenantRole, AuthenticatedRequest, resolveEffectiveTenant, assertBranchAccess } from '../middleware.js';

export const financeRouter = Router();

financeRouter.get('/finance/transactions', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
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

  const txs: FinanceTransactionData[] = [];
  for (const t of centralState.financeTransactions.values()) {
    if (t.companyId === companyId) {
      if (targetBranchId && t.branchId && t.branchId !== targetBranchId) {
        continue;
      }
      txs.push(t);
    }
  }

  // Sort by date descending
  txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = Math.max(1, parseInt(pageQuery as string, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeQuery as string, 10) || 50), 100);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedTxs = txs.slice(start, end);
    res.json({
      items: paginatedTxs,
      total: txs.length,
      page,
      pageSize,
      totalPages: Math.ceil(txs.length / pageSize)
    });
  } else {
    res.json(txs);
  }
});
