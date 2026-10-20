import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { centralState, saveCentralState, PublicSpaceData, PublicOrderData } from '../state.js';
import { verifyJwt } from '../config.js';
import { requireTenantRole, requireTenant, AuthenticatedRequest, validateBody, getClientIp } from '../middleware.js';

function getCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )\\s*${name}\\s*=\\s*([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
import { centralDatabase } from '../db/central-db.js';

export const publicSpaceRouter = Router();

function checkPublicOrderRateLimit(ip: string): boolean {
  return centralDatabase.checkRateLimit(ip, 15, 60000);
}

const UpdatePublicSpaceSchema = z.object({
  companySlug: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  templateId: z.string().optional(),
  themeColor: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  publishedAt: z.string().nullable().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  hours: z.string().optional(),
  products: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    price: z.number().nonnegative(),
    category: z.string().optional(),
    imageUrl: z.string().optional(),
    available: z.boolean().optional()
  })).optional()
});

const CreatePublicOrderSchema = z.object({
  companyId: z.string().min(1, 'companyId é obrigatório'),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().optional(),
    name: z.string().optional(),
    quantity: z.number().positive(),
    price: z.number().optional()
  })).min(1, 'O pedido deve conter pelo menos 1 item'),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
  channel: z.enum(['MARKETPLACE', 'DIRECT', 'IFOOD']).optional()
});

const UpdateOrderStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED'])
});

// Known coordinates for established demonstration flagship branches
const KNOWN_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'comp_burger': { lat: -23.5580, lng: -46.6620 },   // Rua Augusta, 1500 (Consolação)
  'comp_fashion': { lat: -23.5651, lng: -46.6685 },  // Rua Oscar Freire, 800 (Jardins)
  'comp_pet': { lat: -23.5670, lng: -46.6610 }       // Al. Lorena, 1200 (Jardins)
};

// Evaluate whether the business is currently open based on hours string
function evaluateIsOpen(hoursStr: string): boolean {
  if (!hoursStr) return true;
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const normalized = hoursStr.toLowerCase();

    let dayAllowed = false;
    if (normalized.includes('dom') || normalized.includes('diariamente') || normalized.includes('todos')) {
      dayAllowed = true;
    } else if (normalized.includes('seg a sab') || normalized.includes('seg - sab')) {
      dayAllowed = currentDay >= 1 && currentDay <= 6;
    } else if (normalized.includes('seg a sex') || normalized.includes('seg - sex')) {
      dayAllowed = currentDay >= 1 && currentDay <= 5;
    } else {
      dayAllowed = true;
    }

    if (!dayAllowed) return false;

    // Parse hour formats: "11h30 às 23h30", "08h00 às 18h00", "08:00 às 18:00", "11:30 - 23:30"
    const match = normalized.match(/(\d{1,2})(?:h|:)?(\d{2})?\s*(?:às|as|-)\s*(\d{1,2})(?:h|:)?(\d{2})?/);
    if (match) {
      const openHour = parseInt(match[1], 10);
      const openMin = match[2] ? parseInt(match[2], 10) : 0;
      const closeHour = parseInt(match[3], 10);
      const closeMin = match[4] ? parseInt(match[4], 10) : 0;

      const currentTotalMin = currentHour * 60 + currentMinute;
      const openTotalMin = openHour * 60 + openMin;
      const closeTotalMin = closeHour * 60 + closeMin;

      if (closeTotalMin > openTotalMin) {
        return currentTotalMin >= openTotalMin && currentTotalMin < closeTotalMin;
      } else {
        // Crosses midnight (e.g. 18h00 às 02h00)
        return currentTotalMin >= openTotalMin || currentTotalMin < closeTotalMin;
      }
    }
  } catch {
    return true;
  }
  return true;
}

// Public Space by Slug (for public web catalog/menu)
publicSpaceRouter.get('/public-space/slug/:companySlug', (req, res) => {
  const companySlug = req.params['companySlug']?.toLowerCase();
  
  const targetCompany = Array.from(centralState.companies.values()).find(comp => {
    const spaceData = centralState.publicSpaces.get(comp.id);
    const slug = (spaceData?.companySlug || comp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')).toLowerCase();
    return slug === companySlug;
  });

  if (!targetCompany) {
    res.status(404).json({ error: 'Espaço público do cliente não encontrado.' });
    return;
  }

  if (targetCompany.status !== 'active') {
    res.status(403).json({ error: 'Espaço público indisponível ou suspenso comercialmente.' });
    return;
  }
  
  const spaceData = centralState.publicSpaces.get(targetCompany.id);
  if (spaceData?.status !== 'published') {
    res.status(404).json({ error: 'Este espaço público ainda não foi publicado pelo estabelecimento (Rascunho).' });
    return;
  }

  const templateId = (spaceData.templateId === 'modern-bistro' ? 'restaurant' : spaceData.templateId) || 'restaurant';

  res.json({
    id: targetCompany.id,
    name: targetCompany.name,
    slug: companySlug,
    branches: targetCompany.branches || [],
    space: spaceData || null,
    title: spaceData.title || targetCompany.name,
    description: spaceData.description || '',
    logo: spaceData.logo || '',
    templateId,
    themeColor: spaceData.themeColor || '#4f46e5',
    status: spaceData.status,
    phone: spaceData.phone || targetCompany.branches?.[0]?.phone || '',
    email: spaceData.email || '',
    address: spaceData.address || targetCompany.branches?.[0]?.address || '',
    hours: spaceData.hours || '',
    products: spaceData.products || []
  });
});

// Public Space by Company ID (For Internal Tenant Preview and Editing)
publicSpaceRouter.get('/public-space/:companyId', requireTenant, (req: AuthenticatedRequest, res) => {
  const companyId = req.params['companyId'] as string;
  
  if (req.user?.role !== 'hq_admin' && req.user?.companyId !== companyId) {
    res.status(403).json({ error: 'Acesso negado. Você só pode visualizar as configurações do seu próprio espaço público.' });
    return;
  }
  
  const space = centralState.publicSpaces.get(companyId);
  if (space) {
    const activeTemplate = (space.templateId === 'modern-bistro' ? 'restaurant' : space.templateId) || 'restaurant';
    res.json({ ...space, templateId: activeTemplate });
  } else {
    // Generate in-memory default response without persisting to central store
    const company = centralState.companies.get(companyId);
    const defaultSpace: PublicSpaceData = {
      companyId,
      companySlug: (company?.name || 'loja').toLowerCase().replace(/[^a-z0-9]/g, '-'),
      title: company?.name || 'Catálogo Digital',
      description: 'Presença digital oficial powered by 3eatcru OS',
      logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150',
      templateId: 'restaurant',
      themeColor: '#4f46e5',
      status: 'published',
      publishedAt: new Date().toISOString(),
      phone: company?.branches?.[0]?.phone || '(11) 99999-9999',
      email: 'contato@empresa.com',
      address: company?.branches?.[0]?.address || 'Av. Principal, 1000',
      hours: 'Seg - Sex: 08h às 18h',
      products: []
    };
    res.json(defaultSpace);
  }
});

// Update Public Space Configuration (Tenant Admin / Manager)
publicSpaceRouter.put('/public-space/:companyId', requireTenantRole(['admin', 'manager']), validateBody(UpdatePublicSpaceSchema), (req: AuthenticatedRequest, res) => {
  const companyId = req.params['companyId'] as string;
  const existing = centralState.publicSpaces.get(companyId);
  const data = req.body;

  const inputTemplate = data.templateId || existing?.templateId || 'restaurant';
  const activeTemplate = inputTemplate === 'modern-bistro' ? 'restaurant' : inputTemplate;

  const updated: PublicSpaceData = {
    companyId,
    companySlug: data.companySlug || existing?.companySlug || 'loja',
    title: data.title || existing?.title || 'Catálogo Digital',
    description: data.description || existing?.description || '',
    logo: data.logo || existing?.logo || '',
    templateId: activeTemplate,
    themeColor: data.themeColor || existing?.themeColor || '#4f46e5',
    status: data.status || existing?.status || 'published',
    publishedAt: data.publishedAt || existing?.publishedAt || new Date().toISOString(),
    phone: data.phone || existing?.phone || '',
    email: data.email || existing?.email || '',
    address: data.address || existing?.address || '',
    hours: data.hours || existing?.hours || '',
    products: Array.isArray(data.products) ? data.products : (existing?.products || [])
  };

  centralDatabase.upsertPublicSpaceTransaction(updated);
  centralState.publicSpaces.set(companyId, updated);
  saveCentralState();
  res.json({ success: true, space: updated });
});

// Semantic Publish Endpoint (Tenant Admin / Manager)
publicSpaceRouter.post('/public-space/:companyId/publish', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  const companyId = req.params['companyId'] as string;
  const existing = centralState.publicSpaces.get(companyId);
  const company = centralState.companies.get(companyId);

  const space: PublicSpaceData = existing || {
    companyId,
    companySlug: (company?.name || 'loja').toLowerCase().replace(/[^a-z0-9]/g, '-'),
    title: company?.name || 'Catálogo Digital',
    description: 'Presença digital oficial powered by 3eatcru OS',
    logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150',
    templateId: 'restaurant',
    themeColor: '#4f46e5',
    status: 'draft',
    publishedAt: null,
    phone: company?.branches?.[0]?.phone || '',
    email: '',
    address: company?.branches?.[0]?.address || '',
    hours: 'Seg - Sex: 08h às 18h',
    products: []
  };

  space.status = 'published';
  space.publishedAt = new Date().toISOString();

  centralDatabase.upsertPublicSpaceTransaction(space);
  centralState.publicSpaces.set(companyId, space);
  saveCentralState();
  res.json({ success: true, message: 'Espaço público publicado com sucesso.', space });
});

// Semantic Unpublish Endpoint (Tenant Admin / Manager)
publicSpaceRouter.post('/public-space/:companyId/unpublish', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  const companyId = req.params['companyId'] as string;
  const space = centralState.publicSpaces.get(companyId);

  if (!space) {
    res.status(404).json({ error: 'Espaço público não encontrado.' });
    return;
  }

  space.status = 'draft';
  centralDatabase.upsertPublicSpaceTransaction(space);
  centralState.publicSpaces.set(companyId, space);
  saveCentralState();
  res.json({ success: true, message: 'Espaço público revertido para rascunho com sucesso.', space });
});

// Marketplace Listings (Aggregates published public spaces into searchable directory with high-fidelity real calculations)
publicSpaceRouter.get('/marketplace/listings', (_req, res) => {
  const listings = [];

  for (const [companyId, space] of centralState.publicSpaces.entries()) {
    const comp = centralState.companies.get(companyId);
    if (!comp || comp.status !== 'active' || space.status !== 'published') {
      continue;
    }

    const template = space.templateId === 'modern-bistro' ? 'restaurant' : (space.templateId || 'restaurant');
    let category: 'Restaurantes' | 'Varejo' | 'Serviços' | 'Outros' = 'Restaurantes';
    let subCategory = 'Alimentos & Bebidas';

    if (template === 'retail') {
      category = 'Varejo';
      subCategory = 'Moda & Acessórios';
    } else if (template === 'business') {
      category = 'Serviços';
      subCategory = 'Saúde, Beleza & Pet';
    }

    // Authentic coordinates and settings resolution
    const coordinates = KNOWN_COORDINATES[companyId] || null;
    const spaceRecord = space as unknown as Record<string, unknown>;
    const rating = (spaceRecord['rating'] as number | null) ?? null;
    const deliveryFee = (spaceRecord['deliveryFee'] as number | null) ?? 0;
    const deliveryTimeMin = (spaceRecord['deliveryTimeMin'] as string | null) ?? (template === 'business' ? 'Sob agendamento' : null);
    const calculatedDistance = null;
    const isOpen = evaluateIsOpen(space.hours);

    listings.push({
      companyId,
      companySlug: space.companySlug || comp.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      title: space.title || comp.name,
      description: space.description || '',
      logo: space.logo || '',
      templateId: template,
      status: space.status,
      category,
      subCategory,
      address: space.address || comp.branches?.[0]?.address || '',
      phone: space.phone || comp.branches?.[0]?.phone || '',
      email: space.email || '',
      hours: space.hours || '',
      coordinates,
      capabilities: { 
        delivery: template !== 'business', 
        pickup: true, 
        booking: template === 'business' 
      },
      rating,
      deliveryTimeMin,
      deliveryFee,
      productsCount: space.products ? space.products.length : 0,
      calculatedDistance,
      isOpen
    });
  }

  res.json(listings);
});

// Create Public Space / Marketplace Order (Strictly Server-Authoritative Price & Stock)
publicSpaceRouter.post('/public-space/orders', validateBody(CreatePublicOrderSchema), (req, res) => {
  const clientIp = getClientIp(req);
  if (!checkPublicOrderRateLimit(clientIp)) {
    res.status(429).json({ error: 'Muitas solicitações de pedidos no mesmo minuto. Por favor, aguarde alguns instantes.' });
    return;
  }

  const { companyId, customerName, customerPhone, customerAddress, items, notes, paymentMethod, channel } = req.body;

  const idempotencyKey = (req.headers['x-idempotency-key'] || req.body.idempotencyKey) as string | undefined;
  if (idempotencyKey) {
    const cachedKey = `public_order:${companyId}:${idempotencyKey}`;
    const existing = centralDatabase.getIdempotencyRecord(cachedKey);
    if (existing && existing.response) {
      try {
        const parsed = JSON.parse(existing.response);
        res.status(200).json(parsed);
        return;
      } catch {
        res.status(200).json({ success: true, cached: true });
        return;
      }
    }
  }

  if (!centralState.companies.has(companyId)) {
    res.status(404).json({ error: 'Empresa ou catálogo não encontrado.' });
    return;
  }

  const company = centralState.companies.get(companyId)!;
  if (company.status !== 'active') {
    res.status(403).json({ error: 'Empresa indisponível para pedidos no momento.' });
    return;
  }

  const space = centralState.publicSpaces.get(companyId);
  const catalogProducts = space?.products || [];
  const masterProducts = Array.from(centralState.products.values()).filter(p => p.companyId === companyId);

  let total = 0;
  const orderItems = [];
  const stockDeductions = new Map<string, number>();

  for (const it of items) {
    const qty = Math.max(1, Number(it.quantity) || 1);
    
    // Strict lookup: No unlisted products and NO client-side price injection!
    const matchedProduct = catalogProducts.find(p => p.name.toLowerCase() === String(it.name || '').toLowerCase());
    let officialPrice = 0;
    let prodId: string | undefined = it.productId ? String(it.productId) : undefined;

    if (matchedProduct) {
      officialPrice = matchedProduct.price;
      const masterMatch = masterProducts.find(p => p.name.toLowerCase() === matchedProduct!.name.toLowerCase());
      if (masterMatch) {
        prodId = masterMatch.id;
      }
    } else {
      // Look up in company's master products
      const masterMatch = masterProducts.find(p => p.id === it.productId || p.name.toLowerCase() === String(it.name || '').toLowerCase());
      if (masterMatch) {
        officialPrice = masterMatch.price;
        prodId = masterMatch.id;
      } else {
        res.status(422).json({ error: `O produto '${it.name || 'Desconhecido'}' não está disponível no catálogo.` });
        return;
      }
    }

    // Accumulate stock deductions
    if (prodId) {
      const currentDeduction = stockDeductions.get(prodId) || 0;
      stockDeductions.set(prodId, currentDeduction + qty);
    }

    const itemTotal = qty * officialPrice;
    total += itemTotal;
    orderItems.push({
      name: matchedProduct ? matchedProduct.name : (it.name || 'Produto'),
      quantity: qty,
      unitPrice: officialPrice,
      total: itemTotal,
      productId: prodId
    });
  }

  const stockDeductionList = Array.from(stockDeductions.entries()).map(([productId, quantity]) => ({ productId, quantity }));

  // Check 3eatcru ID Consumer Account from token or cookie
  let customerAccountId: string | undefined = req.body.customerAccountId;
  const cookieHeader = req.headers.cookie;
  if (!customerAccountId && cookieHeader) {
    const custToken = getCookie(cookieHeader, '3eatcru_customer_token');
    if (custToken) {
      const decoded = verifyJwt(custToken) as { customerAccountId?: string; id?: string; role?: string };
      if (decoded && (decoded.customerAccountId || decoded.id)) {
        customerAccountId = decoded.customerAccountId || decoded.id;
      }
    }
  }
  if (!customerAccountId) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyJwt(token) as { customerAccountId?: string; id?: string; role?: string };
      if (decoded && (decoded.customerAccountId || decoded.id)) {
        customerAccountId = decoded.customerAccountId || decoded.id;
      }
    }
  }

  // Create order with unguessable 128-bit public tracking token
  const orderId = `ord_pub_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
  const publicTrackingToken = randomUUID();

  const orderRecord: PublicOrderData = {
    id: orderId,
    publicTrackingToken,
    customerAccountId,
    companyId,
    companyName: company.name,
    customerName: String(customerName || 'Cliente Online'),
    customerPhone: String(customerPhone || ''),
    customerAddress: String(customerAddress || ''),
    items: orderItems,
    total,
    notes: String(notes || ''),
    paymentMethod: String(paymentMethod || 'PIX'),
    status: 'RECEIVED',
    channel: (channel || 'MARKETPLACE') as 'MARKETPLACE' | 'DIRECT' | 'IFOOD',
    createdAt: new Date().toISOString()
  };

  try {
    centralDatabase.saveMarketplaceOrderTransaction(orderRecord, stockDeductionList, !!company.allowNegativeStock);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.startsWith('INSUFFICIENT_STOCK:')) {
      const parts = errorMsg.split(':');
      const prodName = parts[1] || 'Produto';
      const available = parts[2] || '0';
      const requested = parts[3] || '0';
      res.status(409).json({ error: `Estoque insuficiente para o produto '${prodName}'. Disponível: ${available}, Necessário: ${requested}` });
      return;
    }
    res.status(500).json({ error: 'Erro ao processar pedido no banco de dados.' });
    return;
  }

  // Synchronize in-memory centralState cache after DB transaction commits
  for (const { productId, quantity } of stockDeductionList) {
    const dbProduct = centralState.products.get(productId);
    if (dbProduct) {
      dbProduct.stock -= quantity;
      centralState.products.set(productId, dbProduct);
    }
  }

  centralState.orders.set(orderId, orderRecord);

  // Auto-update/create local CRM customer record for company
  const customerPhoneStr = String(customerPhone || '').trim();
  const localCrm = Array.from(centralState.customers.values()).find(
    c => c.companyId === companyId && (
      (customerAccountId && c.customerAccountId === customerAccountId) ||
      (customerPhoneStr && customerPhoneStr.length > 5 && c.phone === customerPhoneStr)
    )
  );

  const earnedPoints = Math.floor(total * 0.1);
  const nowIso = new Date().toISOString();

  if (localCrm) {
    localCrm.points += earnedPoints;
    localCrm.totalSpent += total;
    localCrm.lastPurchaseAt = nowIso;
    if (customerAccountId) localCrm.customerAccountId = customerAccountId;
    
    if (localCrm.totalSpent >= 2000) localCrm.tier = 'VIP';
    else if (localCrm.totalSpent >= 1000) localCrm.tier = 'Gold';
    else if (localCrm.totalSpent >= 500) localCrm.tier = 'Silver';
    
    centralState.customers.set(localCrm.id, localCrm);
  } else if (customerPhoneStr || customerAccountId) {
    const newCrmId = `cust_local_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 6)}`;
    const newCrm = {
      id: newCrmId,
      companyId,
      customerAccountId,
      name: String(customerName || 'Cliente Online'),
      phone: customerPhoneStr,
      email: '',
      points: earnedPoints,
      totalSpent: total,
      tier: (total >= 500 ? 'Silver' : 'Bronze') as 'Bronze' | 'Silver' | 'Gold' | 'VIP',
      firstPurchaseAt: nowIso,
      lastPurchaseAt: nowIso,
      createdAt: nowIso
    };
    centralState.customers.set(newCrmId, newCrm);
  }

  saveCentralState();

  const responsePayload = {
    success: true,
    orderId: publicTrackingToken, // Return the secure unguessable token as the public identifier
    internalOrderId: orderId,
    message: 'Pedido criado com sucesso e despachado para o ecossistema!',
    order: {
      id: publicTrackingToken,
      status: orderRecord.status,
      total: orderRecord.total,
      createdAt: orderRecord.createdAt
    }
  };

  if (idempotencyKey) {
    centralDatabase.recordIdempotency(`public_order:${companyId}:${idempotencyKey}`, 'SUCCESS', JSON.stringify(responsePayload));
  }

  res.status(201).json(responsePayload);
});

// GET /public-space/orders/:trackingToken (Public tracking - STRICTLY sanitized, NO PII leaked)
publicSpaceRouter.get('/public-space/orders/:trackingToken', (req, res) => {
  const { trackingToken } = req.params;
  const order = Array.from(centralState.orders.values()).find(
    o => o.publicTrackingToken === trackingToken
  );

  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado.' });
    return;
  }

  // Strict sanitation: Return ONLY non-sensitive progress details, never phone/address
  res.json({
    success: true,
    order: {
      id: order.publicTrackingToken || order.id,
      companyId: order.companyId,
      companyName: order.companyName,
      status: order.status,
      total: order.total,
      notes: order.notes,
      paymentMethod: order.paymentMethod,
      channel: order.channel,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map(it => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice
      }))
    }
  });
});

// GET /companies/:id/orders (Get all orders for a company) - STRICTLY PROTECTED BY RBAC & TENANT BOUNDARIES
publicSpaceRouter.get('/companies/:id/orders', requireTenantRole(['admin', 'manager', 'operator']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  
  // Real-time double-verification that user only accesses their own tenant data
  if (req.user?.role !== 'hq_admin' && req.user?.companyId !== id) {
    res.status(403).json({ error: 'Acesso negado. Tentativa de IDOR bloqueada.' });
    return;
  }

  const companyOrders = Array.from(centralState.orders.values())
    .filter(o => o.companyId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(companyOrders);
});

// PATCH /public-space/orders/:orderId/status (Update order lifecycle status) - STRICTLY AUTHENTICATED WITH STATE MACHINE
publicSpaceRouter.patch('/public-space/orders/:orderId/status', requireTenantRole(['admin', 'manager', 'operator']), validateBody(UpdateOrderStatusSchema), (req: AuthenticatedRequest, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  // Find order by internal orderId or public tracking token
  const order = Array.from(centralState.orders.values()).find(
    o => o.id === orderId || o.publicTrackingToken === orderId
  );

  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado.' });
    return;
  }

  // Tenant Isolation check
  if (req.user?.role !== 'hq_admin' && req.user?.companyId !== order.companyId) {
    res.status(403).json({ error: 'Acesso negado. Este pedido pertence a outra empresa.' });
    return;
  }

  const targetStatus = status as PublicOrderData['status'];

  let txResult;
  try {
    txResult = centralDatabase.updateMarketplaceOrderStatusTransaction(order.id, targetStatus);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('Transição de status inválida')) {
      res.status(422).json({ error: errorMsg });
      return;
    }
    res.status(500).json({ error: errorMsg || 'Falha ao atualizar status do pedido no banco de dados central.' });
    return;
  }

  if (!txResult || !txResult.success || !txResult.order) {
    res.status(500).json({ error: txResult?.error || 'Falha na transação de atualização de status do pedido.' });
    return;
  }

  // Update in-memory state from the SQLite-authoritative transaction result
  centralState.orders.set(order.id, txResult.order);

  if (txResult.stockRefunds) {
    for (const ref of txResult.stockRefunds) {
      const dbProduct = centralState.products.get(ref.productId);
      if (dbProduct) {
        dbProduct.stock += ref.quantity;
        centralState.products.set(ref.productId, dbProduct);
      }
    }
  }

  if (txResult.sale) {
    centralState.sales.set(txResult.sale.id, txResult.sale);
  }

  if (txResult.financeTransaction) {
    centralState.financeTransactions.set(txResult.financeTransaction.id, txResult.financeTransaction);
  }

  saveCentralState();
  res.json({ success: true, order: txResult.order });
});
