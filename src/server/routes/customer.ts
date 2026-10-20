import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { centralDatabase } from '../db/central-db.js';
import { centralState, CustomerAccountData, CustomerAccountAddress } from '../state.js';
import { signJwt, revokeToken, hashPassword, verifyPassword } from '../config.js';
import { AuthenticatedRequest, requireCustomerAuth, validateBody } from '../middleware.js';

export const customerRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(10, 'Telefone inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres')
});

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória')
});

const profileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  photoUrl: z.string().url().optional().or(z.literal('')),
  preferences: z.record(z.string(), z.unknown()).optional()
});

const addressSchema = z.object({
  label: z.string().optional(),
  street: z.string().min(1, 'Rua/Avenida é obrigatória'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, 'Bairro é obrigatório'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().min(2, 'Estado (UF) é obrigatório'),
  zipCode: z.string().min(8, 'CEP é obrigatório'),
  isDefault: z.boolean().optional()
});

const toggleFavoriteSchema = z.object({
  companyId: z.string().min(1, 'ID da empresa é obrigatório')
});

function sanitizeCustomer(account: CustomerAccountData) {
  const accountCopy = { ...account } as Partial<CustomerAccountData>;
  delete accountCopy.password;
  return accountCopy;
}

// 1. REGISTER 3EATCRU ID
customerRouter.post('/auth/register', validateBody(registerSchema), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, phone, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const db = centralDatabase.getRawDatabase();

    // Check existing
    let existing: CustomerAccountData | undefined = Array.from(centralState.customerAccounts.values()).find(
      c => c.email.toLowerCase() === normalizedEmail
    );

    if (!existing && db) {
      try {
        const row = db.prepare('SELECT * FROM customer_accounts WHERE email = ?').get(normalizedEmail) as Record<string, unknown> | undefined;
        if (row) {
          existing = {
            id: row['id'] as string,
            name: row['name'] as string,
            email: row['email'] as string,
            phone: row['phone'] as string,
            password: row['password'] as string,
            photoUrl: row['photo_url'] as string | undefined,
            addresses: JSON.parse((row['addresses'] as string) || '[]'),
            preferences: JSON.parse((row['preferences'] as string) || '{}'),
            favorites: JSON.parse((row['favorites'] as string) || '[]'),
            status: (row['status'] as 'active' | 'suspended') || 'active',
            createdAt: row['created_at'] as string,
            updatedAt: row['updated_at'] as string | undefined
          };
          centralState.customerAccounts.set(existing.id, existing);
        }
      } catch (dbErr) {
        console.warn('[CustomerRouter] Warning querying customer_accounts:', dbErr);
      }
    }

    if (existing) {
      res.status(409).json({ error: 'Já existe uma conta 3eatcru ID cadastrada com este e-mail.' });
      return;
    }

    const accountId = `cust_acc_${crypto.randomBytes(8).toString('hex')}`;
    const hashedPassword = hashPassword(password);
    const now = new Date().toISOString();

    const newAccount: CustomerAccountData = {
      id: accountId,
      name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      photoUrl: '',
      addresses: [],
      preferences: {},
      favorites: [],
      status: 'active',
      createdAt: now
    };

    // Save in memory
    centralState.customerAccounts.set(accountId, newAccount);

    // Persist in SQLite
    if (db) {
      try {
        db.prepare(`
          INSERT INTO customer_accounts (id, name, email, phone, password, photo_url, addresses, preferences, favorites, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newAccount.id,
          newAccount.name,
          newAccount.email,
          newAccount.phone,
          newAccount.password,
          newAccount.photoUrl || '',
          JSON.stringify(newAccount.addresses),
          JSON.stringify(newAccount.preferences),
          JSON.stringify(newAccount.favorites),
          newAccount.status,
          newAccount.createdAt
        );
      } catch (err) {
        console.error('[CustomerRouter] Error inserting customer_account into SQLite:', err);
      }
    }

    // SEC-003 Remediation: Do NOT automatically bind local CRM customer records across companies
    // based merely on self-declared registration data (email/phone). Association requires explicit verified ownership.

    const token = signJwt({
      id: accountId,
      name: newAccount.name,
      email: newAccount.email,
      phone: newAccount.phone,
      role: 'customer',
      authPlane: 'CUSTOMER',
      customerAccountId: accountId
    });

    const isProduction = process.env['NODE_ENV'] === 'production';
    res.cookie('3eatcru_customer_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(201).json({
      message: 'Conta 3eatcru ID criada com sucesso!',
      token,
      customer: sanitizeCustomer(newAccount)
    });
  } catch (err) {
    console.error('[CustomerRouter] Error in register:', err);
    res.status(500).json({ error: 'Erro interno ao criar conta 3eatcru ID.' });
  }
});

// 2. LOGIN 3EATCRU ID
customerRouter.post('/auth/login', validateBody(loginSchema), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const db = centralDatabase.getRawDatabase();

    let account: CustomerAccountData | undefined = Array.from(centralState.customerAccounts.values()).find(
      c => c.email.toLowerCase() === normalizedEmail
    );

    if (!account && db) {
      try {
        const row = db.prepare('SELECT * FROM customer_accounts WHERE email = ?').get(normalizedEmail) as Record<string, unknown> | undefined;
        if (row) {
          account = {
            id: row['id'] as string,
            name: row['name'] as string,
            email: row['email'] as string,
            phone: row['phone'] as string,
            password: row['password'] as string,
            photoUrl: row['photo_url'] as string | undefined,
            addresses: JSON.parse((row['addresses'] as string) || '[]'),
            preferences: JSON.parse((row['preferences'] as string) || '{}'),
            favorites: JSON.parse((row['favorites'] as string) || '[]'),
            status: (row['status'] as 'active' | 'suspended') || 'active',
            createdAt: row['created_at'] as string,
            updatedAt: row['updated_at'] as string | undefined
          };
          centralState.customerAccounts.set(account.id, account);
        }
      } catch (dbErr) {
        console.warn('[CustomerRouter] Error querying customer account:', dbErr);
      }
    }

    if (!account) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    if (account.status === 'suspended') {
      res.status(403).json({ error: 'Conta suspensa. Entre em contato com o suporte da plataforma.' });
      return;
    }

    if (!verifyPassword(password, account.password)) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    const token = signJwt({
      id: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
      role: 'customer',
      authPlane: 'CUSTOMER',
      customerAccountId: account.id
    });

    const isProduction = process.env['NODE_ENV'] === 'production';
    res.cookie('3eatcru_customer_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Login 3eatcru ID efetuado com sucesso!',
      token,
      customer: sanitizeCustomer(account)
    });
  } catch (err) {
    console.error('[CustomerRouter] Error in login:', err);
    res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

// 3. LOGOUT
customerRouter.post('/auth/logout', (req: AuthenticatedRequest, res: Response) => {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/3eatcru_customer_token=([^;]*)/);
    if (match) {
      revokeToken(match[1]);
    }
  }

  res.clearCookie('3eatcru_customer_token');
  res.json({ message: 'Sessão encerrada com sucesso.' });
});

// 4. GET ME
customerRouter.get('/auth/me', requireCustomerAuth, (req: AuthenticatedRequest, res: Response) => {
  const accountId = req.user?.customerAccountId || req.user?.id;
  if (!accountId) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return;
  }

  const account = centralState.customerAccounts.get(accountId);
  if (!account) {
    res.status(440).json({ error: 'Conta não encontrada. Por favor, faça login novamente.' });
    return;
  }

  res.json({ customer: sanitizeCustomer(account) });
});

// 5. UPDATE PROFILE
customerRouter.put('/profile', requireCustomerAuth, validateBody(profileUpdateSchema), (req: AuthenticatedRequest, res: Response) => {
  const accountId = req.user?.customerAccountId || req.user?.id;
  if (!accountId) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return;
  }

  const account = centralState.customerAccounts.get(accountId);
  if (!account) {
    res.status(404).json({ error: 'Conta não encontrada.' });
    return;
  }

  const { name, phone, photoUrl, preferences } = req.body;
  if (name) account.name = name;
  if (phone) account.phone = phone;
  if (photoUrl !== undefined) account.photoUrl = photoUrl;
  if (preferences) account.preferences = { ...account.preferences, ...preferences };
  account.updatedAt = new Date().toISOString();

  centralState.customerAccounts.set(accountId, account);

  const db = centralDatabase.getRawDatabase();
  if (db) {
    try {
      db.prepare(`
        UPDATE customer_accounts 
        SET name = ?, phone = ?, photo_url = ?, preferences = ?, updated_at = ?
        WHERE id = ?
      `).run(
        account.name,
        account.phone,
        account.photoUrl || '',
        JSON.stringify(account.preferences),
        account.updatedAt,
        accountId
      );
    } catch (err) {
      console.error('[CustomerRouter] Error updating profile in SQLite:', err);
    }
  }

  res.json({ message: 'Perfil atualizado com sucesso.', customer: sanitizeCustomer(account) });
});

// 6. ADD ADDRESS
customerRouter.post('/addresses', requireCustomerAuth, validateBody(addressSchema), (req: AuthenticatedRequest, res: Response) => {
  const accountId = req.user?.customerAccountId || req.user?.id;
  if (!accountId) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return;
  }

  const account = centralState.customerAccounts.get(accountId);
  if (!account) {
    res.status(404).json({ error: 'Conta não encontrada.' });
    return;
  }

  const newAddress: CustomerAccountAddress = {
    id: `addr_${crypto.randomBytes(6).toString('hex')}`,
    ...req.body
  };

  if (newAddress.isDefault) {
    account.addresses.forEach(a => { a.isDefault = false; });
  } else if (account.addresses.length === 0) {
    newAddress.isDefault = true;
  }

  account.addresses.push(newAddress);
  account.updatedAt = new Date().toISOString();

  centralState.customerAccounts.set(accountId, account);

  const db = centralDatabase.getRawDatabase();
  if (db) {
    try {
      db.prepare('UPDATE customer_accounts SET addresses = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify(account.addresses),
        account.updatedAt,
        accountId
      );
    } catch (err) {
      console.error('[CustomerRouter] Error updating addresses in SQLite:', err);
    }
  }

  res.status(201).json({ message: 'Endereço adicionado com sucesso.', addresses: account.addresses });
});

// 7. DELETE ADDRESS
customerRouter.delete('/addresses/:addressId', requireCustomerAuth, (req: AuthenticatedRequest, res: Response) => {
  const accountId = req.user?.customerAccountId || req.user?.id;
  const addressId = req.params['addressId'];

  if (!accountId || !addressId) {
    res.status(400).json({ error: 'Parâmetros inválidos.' });
    return;
  }

  const account = centralState.customerAccounts.get(accountId);
  if (!account) {
    res.status(404).json({ error: 'Conta não encontrada.' });
    return;
  }

  account.addresses = account.addresses.filter(a => a.id !== addressId);
  account.updatedAt = new Date().toISOString();

  centralState.customerAccounts.set(accountId, account);

  const db = centralDatabase.getRawDatabase();
  if (db) {
    try {
      db.prepare('UPDATE customer_accounts SET addresses = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify(account.addresses),
        account.updatedAt,
        accountId
      );
    } catch (err) {
      console.error('[CustomerRouter] Error removing address in SQLite:', err);
    }
  }

  res.json({ message: 'Endereço removido com sucesso.', addresses: account.addresses });
});

// 8. TOGGLE FAVORITE COMPANY
customerRouter.post('/favorites/toggle', requireCustomerAuth, validateBody(toggleFavoriteSchema), (req: AuthenticatedRequest, res: Response) => {
  const accountId = req.user?.customerAccountId || req.user?.id;
  const { companyId } = req.body;

  const account = centralState.customerAccounts.get(accountId!);
  if (!account) {
    res.status(404).json({ error: 'Conta não encontrada.' });
    return;
  }

  const idx = account.favorites.indexOf(companyId);
  let isFavorite = false;
  if (idx >= 0) {
    account.favorites.splice(idx, 1);
  } else {
    account.favorites.push(companyId);
    isFavorite = true;
  }

  account.updatedAt = new Date().toISOString();
  centralState.customerAccounts.set(accountId!, account);

  const db = centralDatabase.getRawDatabase();
  if (db) {
    try {
      db.prepare('UPDATE customer_accounts SET favorites = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify(account.favorites),
        account.updatedAt,
        accountId
      );
    } catch (err) {
      console.error('[CustomerRouter] Error updating favorites in SQLite:', err);
    }
  }

  res.json({ message: isFavorite ? 'Empresa adicionada aos favoritos.' : 'Empresa removida dos favoritos.', isFavorite, favorites: account.favorites });
});

// 9. ACTIVITY HUB (Cross-company history, loyalty points, orders, relationships)
customerRouter.get('/activity', requireCustomerAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const accountId = req.user?.customerAccountId || req.user?.id;
    const account = centralState.customerAccounts.get(accountId!);
    if (!account) {
      res.status(404).json({ error: 'Conta 3eatcru ID não encontrada.' });
      return;
    }

    // SEC-002 Remediation: Collect orders strictly by verified customerAccountId (preventing phone-spoofing leakage)
    const userOrders = Array.from(centralState.orders.values()).filter(o => 
      o.customerAccountId === accountId
    );

    // Sort by latest
    userOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // SEC-002: Explicit projection of customer orders to prevent exposing internal operational metadata
    const projectedOrders = userOrders.map(o => ({
      id: o.id,
      companyId: o.companyId,
      companyName: o.companyName || centralState.companies.get(o.companyId)?.name || 'Empresa Parceira',
      status: o.status,
      total: o.total,
      channel: o.channel,
      items: Array.isArray(o.items) ? o.items.map(item => ({
        productId: item.productId,
        name: item.name || 'Item do Pedido',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: Number(item.unitPrice) * Number(item.quantity)
      })) : [],
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt
    }));

    // 2. Collect company relationships (Local CRM memberships)
    // SEC-002: Match strictly by verified customerAccountId
    // IMPORTANT: Exclude company-private CRM notes and internal tags to preserve company privacy!
    const localCrmRecords = Array.from(centralState.customers.values()).filter(c =>
      c.customerAccountId === accountId
    );

    const companyRelationships = localCrmRecords.map(crm => {
      const company = centralState.companies.get(crm.companyId);
      return {
        companyId: crm.companyId,
        companyName: company?.name || 'Empresa Parceira',
        logoUrl: company?.logoUrl || '',
        points: crm.points,
        totalSpent: crm.totalSpent,
        tier: crm.tier,
        memberSince: crm.createdAt,
        lastPurchaseAt: crm.lastPurchaseAt || null
      };
    });

    // 3. Favorites companies
    const favoriteCompanies = account.favorites.map(cId => {
      const comp = centralState.companies.get(cId);
      const pub = centralState.publicSpaces.get(cId);
      return {
        id: cId,
        name: comp?.name || pub?.title || 'Empresa Parceira',
        slug: comp?.slug || pub?.companySlug || '',
        logoUrl: comp?.logoUrl || pub?.logo || '',
        bannerUrl: '',
        category: 'Alimentação'
      };
    });

    res.json({
      profile: sanitizeCustomer(account),
      orders: projectedOrders,
      companyRelationships,
      favoriteCompanies,
      addresses: account.addresses
    });
  } catch (err) {
    console.error('[CustomerRouter] Error fetching customer activity:', err);
    res.status(500).json({ error: 'Erro ao carregar histórico de atividades do consumidor.' });
  }
});
