import { Router, Response } from 'express';
import { z } from 'zod';
import { centralState, saveCentralState, recordHqAuditLog, PublicOrderData } from '../state.js';
import { requireHqAdmin, AuthenticatedRequest, validateBody, getClientIp } from '../middleware.js';
import { centralDatabase } from '../db/central-db.js';

export const hqMarketplaceRouter = Router();

const ModerateStoreSchema = z.object({
  action: z.enum(['publish', 'draft', 'suspend']),
  reason: z.string().optional()
});

const UpdateOrderStatusHqSchema = z.object({
  status: z.enum(['RECEIVED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED']),
  reason: z.string().optional()
});

/**
 * GET /api/v1/hq/marketplace/overview
 * Retorna as métricas analíticas e de governança completas do Marketplace para o HQ
 */
hqMarketplaceRouter.get('/overview', requireHqAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const totalCompanies = centralState.companies.size;
  let publishedStores = 0;
  let draftStores = 0;
  let totalProductsListed = 0;

  for (const [companyId, space] of centralState.publicSpaces.entries()) {
    const comp = centralState.companies.get(companyId);
    if (!comp) continue;

    if (space.status === 'published' && comp.status === 'active') {
      publishedStores++;
    } else {
      draftStores++;
    }

    if (space.products && Array.isArray(space.products)) {
      totalProductsListed += space.products.length;
    }
  }

  // Estatísticas de pedidos do Marketplace
  const allOrders: PublicOrderData[] = Array.from(centralState.orders.values());
  const ordersByStatus: Record<string, number> = {
    RECEIVED: 0,
    PREPARING: 0,
    READY: 0,
    DELIVERING: 0,
    COMPLETED: 0,
    CANCELLED: 0
  };

  const ordersByChannel: Record<string, number> = {
    MARKETPLACE: 0,
    DIRECT: 0,
    IFOOD: 0
  };

  let totalGmv = 0;
  for (const o of allOrders) {
    const status = o.status || 'RECEIVED';
    ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;

    const channel = o.channel || 'MARKETPLACE';
    ordersByChannel[channel] = (ordersByChannel[channel] || 0) + 1;

    if (status !== 'CANCELLED') {
      totalGmv += Number(o.total || 0);
    }
  }

  const completedOrders = ordersByStatus['COMPLETED'] || 0;
  const activeOrders = (ordersByStatus['RECEIVED'] || 0) + (ordersByStatus['PREPARING'] || 0) + (ordersByStatus['READY'] || 0) + (ordersByStatus['DELIVERING'] || 0);
  const averageTicket = allOrders.length > 0 ? totalGmv / allOrders.length : 0;

  // 15 pedidos mais recentes
  const sortedOrders = [...allOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recentOrders = sortedOrders.slice(0, 15);

  res.json({
    success: true,
    stats: {
      totalCompanies,
      publishedStores,
      draftStores,
      totalProductsListed,
      totalOrders: allOrders.length,
      activeOrders,
      completedOrders,
      totalGmv,
      averageTicket,
      ordersByStatus,
      ordersByChannel
    },
    recentOrders
  });
});

/**
 * GET /api/v1/hq/marketplace/stores
 * Lista todos os estabelecimentos com presença no Marketplace para auditoria administrativa
 */
hqMarketplaceRouter.get('/stores', requireHqAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const stores = [];

  for (const [companyId, comp] of centralState.companies.entries()) {
    const space = centralState.publicSpaces.get(companyId);
    
    // Calcula pedidos e receita gerada por este tenant no marketplace
    const tenantOrders = Array.from(centralState.orders.values()).filter(o => o.companyId === companyId);
    const tenantGmv = tenantOrders
      .filter(o => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const template = space?.templateId === 'modern-bistro' ? 'restaurant' : (space?.templateId || 'restaurant');
    let category = 'Restaurante';
    if (template === 'retail') category = 'Varejo';
    else if (template === 'business') category = 'Serviços';

    stores.push({
      companyId,
      companyName: comp.name,
      companySlug: space?.companySlug || comp.slug || comp.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      companyStatus: comp.status,
      spaceStatus: space?.status || 'draft',
      title: space?.title || comp.name,
      category,
      templateId: template,
      logo: space?.logo || '',
      phone: space?.phone || comp.branches?.[0]?.phone || '',
      address: space?.address || comp.branches?.[0]?.address || '',
      hours: space?.hours || '',
      productsCount: space?.products ? space.products.length : 0,
      publishedAt: space?.publishedAt || null,
      ordersCount: tenantOrders.length,
      gmv: tenantGmv
    });
  }

  // Ordena por faturamento decrescente
  stores.sort((a, b) => b.gmv - a.gmv);

  res.json(stores);
});

/**
 * POST /api/v1/hq/marketplace/stores/:companyId/moderate
 * Ação de moderação do Superadmin HQ sobre a vitrine pública de uma empresa
 */
hqMarketplaceRouter.post('/stores/:companyId/moderate', requireHqAdmin, validateBody(ModerateStoreSchema), (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.params['companyId'] as string;
  const { action, reason } = req.body;
  const comp = centralState.companies.get(companyId);

  if (!comp) {
    res.status(404).json({ error: 'Empresa não encontrada no ecossistema.' });
    return;
  }

  let space = centralState.publicSpaces.get(companyId);
  if (!space) {
    space = {
      companyId,
      companySlug: comp.slug || comp.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      title: comp.name,
      description: 'Presença digital oficial',
      logo: '',
      templateId: 'restaurant',
      themeColor: '#4f46e5',
      status: 'draft',
      publishedAt: null,
      phone: comp.branches?.[0]?.phone || '',
      email: '',
      address: comp.branches?.[0]?.address || '',
      hours: '08h às 18h',
      products: []
    };
  }

  const previousStatus = space.status;
  const newStatus = action === 'publish' ? 'published' : 'draft';
  space.status = newStatus;
  if (newStatus === 'published' && !space.publishedAt) {
    space.publishedAt = new Date().toISOString();
  }

  // Persiste no SQLite e na memória do servidor
  centralDatabase.upsertPublicSpaceTransaction(space);
  centralState.publicSpaces.set(companyId, space);
  saveCentralState();

  // Registra trilha auditável de governança HQ
  const adminEmail = req.user?.email || 'admin@3eatcru.internal';
  const adminId = req.user?.id || 'hq_admin_sys';
  const clientIp = getClientIp(req);

  recordHqAuditLog({
    hqAdminId: adminId,
    hqAdminEmail: adminEmail,
    action: `MARKETPLACE_STORE_${action.toUpperCase()}`,
    targetCompanyId: companyId,
    details: `Vitrine comercial de '${comp.name}' alterada de '${previousStatus}' para '${newStatus}'. Motivo: ${reason || 'Ação deliberada de moderação pelo Gabinete Administrativo.'}`,
    previousValue: { status: previousStatus },
    newValue: { status: newStatus },
    ip: clientIp
  });

  res.json({
    success: true,
    message: `Vitrine de '${comp.name}' atualizada com sucesso para '${newStatus}'.`,
    space
  });
});

/**
 * GET /api/v1/hq/marketplace/orders
 * Retorna os pedidos online do Marketplace para auditoria do HQ
 */
hqMarketplaceRouter.get('/orders', requireHqAdmin, (req: AuthenticatedRequest, res: Response) => {
  const companyIdFilter = req.query['companyId'] as string | undefined;
  const statusFilter = req.query['status'] as string | undefined;
  const channelFilter = req.query['channel'] as string | undefined;

  let orders = Array.from(centralState.orders.values());

  if (companyIdFilter) {
    orders = orders.filter(o => o.companyId === companyIdFilter);
  }
  if (statusFilter) {
    orders = orders.filter(o => o.status === statusFilter);
  }
  if (channelFilter) {
    orders = orders.filter(o => o.channel === channelFilter);
  }

  // Ordena por data decrescente
  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(orders);
});

/**
 * PATCH /api/v1/hq/marketplace/orders/:orderId/status
 * Intervenção de governança do HQ no status de um pedido online
 */
hqMarketplaceRouter.patch('/orders/:orderId/status', requireHqAdmin, validateBody(UpdateOrderStatusHqSchema), (req: AuthenticatedRequest, res: Response) => {
  const orderId = req.params['orderId'] as string;
  const { status: targetStatus, reason } = req.body;

  try {
    const dbResult = centralDatabase.updateMarketplaceOrderStatusTransaction(orderId, targetStatus);
    
    // Atualiza estado em memória se existir
    const memoryOrder = centralState.orders.get(orderId);
    if (memoryOrder) {
      memoryOrder.status = targetStatus;
      memoryOrder.updatedAt = new Date().toISOString();
      centralState.orders.set(orderId, memoryOrder);
      saveCentralState();
    }

    const adminEmail = req.user?.email || 'admin@3eatcru.internal';
    const adminId = req.user?.id || 'hq_admin_sys';
    const clientIp = getClientIp(req);

    recordHqAuditLog({
      hqAdminId: adminId,
      hqAdminEmail: adminEmail,
      action: 'MARKETPLACE_ORDER_STATUS_OVERRIDE',
      targetCompanyId: memoryOrder?.companyId || dbResult.order?.company_id,
      details: `Pedido #${orderId} alterado administrativamente para status '${targetStatus}'. Motivo: ${reason || 'Intervenção pelo painel HQ.'}`,
      previousValue: { orderId },
      newValue: { status: targetStatus },
      ip: clientIp
    });

    res.json({
      success: true,
      message: `Status do pedido #${orderId} atualizado para '${targetStatus}'.`,
      order: dbResult.order || memoryOrder
    });
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || 'Erro ao atualizar status do pedido.';
    res.status(400).json({ error: errorMsg });
  }
});
