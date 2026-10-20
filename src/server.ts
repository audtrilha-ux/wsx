import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
// import * as cookieParser from 'cookie-parser';
import express, { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { join } from 'node:path';
import { loadCentralState, centralState } from './server/state.js';
import { authRouter } from './server/routes/auth.js';
import { onboardingRouter } from './server/routes/onboarding.js';
import { syncRouter } from './server/routes/sync.js';
import { companiesRouter } from './server/routes/companies.js';
import { productsRouter } from './server/routes/products.js';
import { salesRouter } from './server/routes/sales.js';
import { financeRouter } from './server/routes/finance.js';
import { customersRouter } from './server/routes/customers.js';
import { tablesRouter } from './server/routes/tables.js';
import { publicSpaceRouter } from './server/routes/public-space.js';
import { telemetryRouter } from './server/routes/telemetry.js';
import { docsSearchRouter } from './server/routes/docs-search.js';
import { hqAppsRouter } from './server/routes/hq-apps.js';
import { hqMarketplaceRouter } from './server/routes/hq-marketplace.js';
import { storeRouter } from './server/routes/store.js';
import { customerRouter } from './server/routes/customer.js';
import { simulationRouter } from './server/routes/simulation.js';
import { centralDatabase } from './server/db/central-db.js';

// Load central store from disk on boot
loadCentralState();

if (process.env['NODE_ENV'] === 'production' && !process.env['PAYMENT_GATEWAY_SECRET']) {
  console.warn('[SECURITY] PAYMENT_GATEWAY_SECRET not configured. Running payment gateway in secure sandbox mode.');
}

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();
app.set('trust proxy', 1);
// app.use(cookieParser());
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      if (parts.length === 2) {
        cookies[parts[0].trim()] = decodeURIComponent(parts[1].trim());
      }
    });
    (req as unknown as { cookies: Record<string, string> }).cookies = cookies;
  } else {
    (req as unknown as { cookies: Record<string, string> }).cookies = {};
  }
  next();
});

app.use((req, res, next) => {
  if (['GET', 'HEAD'].includes(req.method)) {
    if (!req.cookies['csrf-token']) {
      const token = crypto.randomBytes(32).toString('hex');
      res.cookie('csrf-token', token, { httpOnly: false, sameSite: 'strict', secure: true });
    }
  }
  next();
});
app.use(express.json({
  limit: '10mb',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verify: (req: any, _res: any, buf: Buffer) => {
    req.rawBody = buf;
  }
}));

// Security Hardening Headers (ARC-04)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const angularApp = new AngularNodeAppEngine();

// System Health & Observability Endpoints
app.get(['/health', '/health/liveness'], (_req, res) => {
  res.json({ status: 'alive', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/health/readiness', (_req, res) => {
  const dbHealth = centralDatabase.checkHealth();
  if (dbHealth.healthy) {
    res.json({ status: 'ready', database: dbHealth.details, timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({ status: 'not_ready', database: dbHealth.details, timestamp: new Date().toISOString() });
  }
});

const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  const dbHealth = centralDatabase.checkHealth();
  res.status(dbHealth.healthy ? 200 : 503).json({
    status: dbHealth.healthy ? 'healthy' : 'degraded',
    version: '2.5.0',
    uptime: process.uptime(),
    database: dbHealth,
    stateStatus: {
      companies: centralState.companies.size,
      products: centralState.products.size,
      sales: centralState.sales.size,
      apps: centralState.apps.length
    },
    timestamp: new Date().toISOString()
  });
});

// Platform Plans Catalog
apiRouter.get(['/plans', '/licensing/plans'], (_req, res) => {
  res.json(centralState.plans);
});

// App Store Marketplace Catalog
apiRouter.use('/hq/apps', hqAppsRouter);
apiRouter.use('/hq/marketplace', hqMarketplaceRouter);
apiRouter.use('/store', storeRouter);
apiRouter.use('/customer', customerRouter);

// Mount domain routes
apiRouter.use('/auth', authRouter);
apiRouter.use('/onboarding', onboardingRouter);
apiRouter.use('/sync', syncRouter);
apiRouter.use('/', companiesRouter);
apiRouter.use('/', productsRouter);
apiRouter.use('/', salesRouter);
apiRouter.use('/', financeRouter);
apiRouter.use('/', customersRouter);
apiRouter.use('/', tablesRouter);
apiRouter.use('/', publicSpaceRouter);
apiRouter.use('/', telemetryRouter);
apiRouter.use('/', docsSearchRouter);
apiRouter.use('/simulation', simulationRouter);

const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || process.env['NODE_ENV'] === 'test') {
    return next();
  }
  
  const csrfToken = req.headers['x-csrf-token'];
  const csrfCookie = req.cookies['csrf-token'];
  
  if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
    return res.status(403).json({ success: false, error: 'CSRF token inválido ou ausente.' });
  }
  next();
};

apiRouter.use(csrfProtection);
app.use('/api/v1', apiRouter);

// Global Express Error Handler for API routes to capture database or sync errors gracefully
app.use('/api/v1', (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error('Captured API Exception:', err);
  const errorObj = err as Error & { status?: number };
  const status = errorObj.status || 500;
  
  let errorMessage = errorObj.message || 'Erro interno do servidor.';
  if (process.env['NODE_ENV'] === 'production' && status === 500) {
    errorMessage = 'Erro interno do servidor.';
  }

  res.status(status).json({
    success: false,
    error: errorMessage
  });
  void _next;
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  if (process.env['NODE_ENV'] === 'production') {
    if (!process.env['JWT_SECRET']) {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is strictly required in production mode. Server startup aborted.');
    }
    if (!process.env['HQ_ADMIN_PASSWORD'] && !process.env['HQ_ADMIN_SECRET']) {
      throw new Error('FATAL SECURITY ERROR: HQ_ADMIN_PASSWORD (or HQ_ADMIN_SECRET) environment variable is strictly required in production mode. Server startup aborted.');
    }
    if (!process.env['HQ_ADMIN_MFA_SECRET']) {
      throw new Error('FATAL SECURITY ERROR: HQ_ADMIN_MFA_SECRET environment variable is strictly required in production mode. Server startup aborted.');
    }
    if (!process.env['MFA_ENCRYPTION_KEY']) {
      throw new Error('FATAL SECURITY ERROR: MFA_ENCRYPTION_KEY environment variable is strictly required in production mode. Server startup aborted.');
    }
  }

  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`3eatcru OS Central Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
