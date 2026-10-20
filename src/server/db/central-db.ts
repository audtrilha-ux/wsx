/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { encryptMfaSecret, decryptMfaSecret } from '../config.js';

const DATA_DIR = join(process.cwd(), 'data');
const DB_FILE = join(DATA_DIR, 'central_platform.db');

export class CentralDatabaseEngine {
  private db: DatabaseSync | null = null;
  private isInitialized = false;
  private currentDbPath: string = DB_FILE;

  constructor(customDbPath?: string) {
    this.init(customDbPath);
  }

  public getRawDatabase(): DatabaseSync | null {
    if (!this.db) {
      this.init();
    }
    return this.db;
  }

  public isReady(): boolean {
    return this.isInitialized && !!this.db;
  }

  public close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore if already closed
      }
      this.db = null;
      this.isInitialized = false;
    }
  }

  public init(customDbPath?: string) {
    const targetPath = customDbPath || this.currentDbPath || DB_FILE;
    if (this.isInitialized && this.db && this.currentDbPath === targetPath) return;

    if (this.db) {
      this.close();
    }

    try {
      this.currentDbPath = targetPath;
      const targetDir = dirname(targetPath);
      if (targetDir && !existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      this.db = new DatabaseSync(targetPath);

      // WAL journal mode for ACID concurrency and durability
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.db.exec('PRAGMA busy_timeout = 5000;');
      this.db.exec('PRAGMA temp_store = MEMORY;');
      this.db.exec('PRAGMA cache_size = -10000;');
      this.db.exec('PRAGMA journal_size_limit = 16777216;');
      this.db.exec('PRAGMA mmap_size = 268435456;');

      this.runMigrations();
      this.migrateLegacyMfaSecrets();
      this.isInitialized = true;
    } catch (err) {
      console.error('[CentralDatabaseEngine] Failed to initialize SQLite database:', err);
      this.isInitialized = false;
      this.db = null;
      throw new Error(`[CentralDatabaseEngine] Falha crítica ao inicializar o banco de dados SQLite: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private runMigrations() {
    if (!this.db) return;

    // 1. Ensure schema_migrations table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        migrated_at TEXT NOT NULL
      );
    `);

    const getMigratedVersions = () => {
      try {
        const rows = this.db!.prepare("SELECT version FROM schema_migrations").all() as { version: number }[];
        return new Set(rows.map(r => r.version));
      } catch {
        return new Set<number>();
      }
    };

    const migrated = getMigratedVersions();

    const migrations = [
      {
        version: 1,
        description: 'Criação das tabelas base do ecossistema central',
        run: (db: DatabaseSync) => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS companies (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              slug TEXT,
              cnpj TEXT,
              logo_url TEXT,
              balance REAL NOT NULL DEFAULT 0,
              installed_apps TEXT NOT NULL DEFAULT '[]',
              status TEXT NOT NULL DEFAULT 'active',
              plan TEXT DEFAULT 'starter',
              max_terminals INTEGER DEFAULT 1,
              max_branches INTEGER DEFAULT 1,
              active_terminals INTEGER DEFAULT 0,
              channel TEXT DEFAULT 'stable',
              os_target_version TEXT,
              license_expires_at TEXT,
              branches TEXT DEFAULT '[]',
              allow_negative_stock INTEGER DEFAULT 0,
              is_demo INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS company_users (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              branch_id TEXT,
              branch_ids TEXT,
              name TEXT NOT NULL,
              email TEXT NOT NULL,
              role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'operator')),
              password TEXT NOT NULL,
              pin TEXT,
              active INTEGER NOT NULL DEFAULT 1,
              last_login TEXT,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS hq_admins (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'hq_admin',
              password TEXT NOT NULL,
              mfa_enabled INTEGER NOT NULL DEFAULT 1,
              mfa_secret TEXT
            );

            CREATE TABLE IF NOT EXISTS plans (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              monthly_price REAL NOT NULL,
              max_terminals INTEGER NOT NULL DEFAULT 1,
              max_branches INTEGER NOT NULL DEFAULT 1,
              description TEXT NOT NULL,
              included_apps TEXT NOT NULL DEFAULT '[]',
              features TEXT NOT NULL DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS products (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              branch_id TEXT,
              name TEXT NOT NULL,
              price REAL NOT NULL,
              stock REAL NOT NULL DEFAULT 0,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS sales (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              branch_id TEXT,
              items TEXT NOT NULL DEFAULT '[]',
              total REAL NOT NULL,
              timestamp TEXT NOT NULL,
              payment_method TEXT,
              operator TEXT,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS customers (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              branch_id TEXT,
              name TEXT NOT NULL,
              phone TEXT NOT NULL,
              email TEXT NOT NULL,
              points REAL NOT NULL DEFAULT 0,
              total_spent REAL NOT NULL DEFAULT 0,
              tier TEXT NOT NULL DEFAULT 'Bronze',
              created_at TEXT NOT NULL,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS tables_registry (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              branch_id TEXT,
              number INTEGER NOT NULL,
              name TEXT NOT NULL,
              capacity INTEGER NOT NULL DEFAULT 4,
              status TEXT NOT NULL DEFAULT 'AVAILABLE',
              current_order TEXT,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS finance_transactions (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              branch_id TEXT,
              type TEXT NOT NULL,
              category TEXT NOT NULL,
              description TEXT NOT NULL,
              amount REAL NOT NULL,
              payment_method TEXT NOT NULL,
              timestamp TEXT NOT NULL,
              operator TEXT NOT NULL,
              reference_id TEXT,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS public_spaces (
              company_id TEXT PRIMARY KEY,
              company_slug TEXT NOT NULL,
              title TEXT NOT NULL,
              description TEXT NOT NULL,
              logo TEXT NOT NULL,
              template_id TEXT NOT NULL,
              theme_color TEXT NOT NULL,
              status TEXT NOT NULL,
              published_at TEXT,
              phone TEXT NOT NULL,
              email TEXT NOT NULL,
              address TEXT NOT NULL,
              hours TEXT NOT NULL,
              products TEXT NOT NULL DEFAULT '[]',
              slug TEXT,
              site_name TEXT,
              site_description TEXT,
              theme TEXT,
              created_at TEXT,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              public_tracking_token TEXT,
              company_id TEXT NOT NULL,
              branch_id TEXT,
              company_name TEXT NOT NULL,
              customer_name TEXT NOT NULL,
              customer_phone TEXT,
              customer_address TEXT,
              items TEXT NOT NULL DEFAULT '[]',
              total REAL NOT NULL,
              notes TEXT,
              payment_method TEXT NOT NULL DEFAULT 'PIX',
              status TEXT NOT NULL DEFAULT 'RECEIVED',
              channel TEXT NOT NULL DEFAULT 'MARKETPLACE',
              created_at TEXT NOT NULL,
              updated_at TEXT,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS telemetry (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              company_name TEXT,
              device_id TEXT,
              timestamp TEXT NOT NULL,
              overall_status TEXT NOT NULL,
              client_reported_status TEXT,
              central_calculated_health TEXT,
              checks TEXT NOT NULL DEFAULT '[]',
              platform TEXT NOT NULL DEFAULT 'web',
              version TEXT NOT NULL DEFAULT '1.4.3',
              metrics TEXT,
              os_version TEXT,
              source TEXT,
              created_at TEXT,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS processed_webhook_events (
              event_id TEXT PRIMARY KEY,
              processed_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS os_releases (
              id TEXT PRIMARY KEY,
              version TEXT NOT NULL UNIQUE,
              channel TEXT NOT NULL DEFAULT 'stable',
              release_date TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'active',
              changelog TEXT NOT NULL,
              min_required_by_apps TEXT,
              checksum TEXT,
              mandatory INTEGER NOT NULL DEFAULT 0,
              release_channel TEXT,
              release_notes TEXT,
              published_at TEXT,
              created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS app_catalog (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT NOT NULL,
              developer TEXT NOT NULL,
              publisher TEXT,
              category TEXT NOT NULL,
              icon TEXT NOT NULL,
              pricing TEXT NOT NULL DEFAULT '{}',
              lifecycle TEXT NOT NULL DEFAULT '{}',
              current_release TEXT,
              permissions TEXT NOT NULL DEFAULT '[]',
              capabilities TEXT NOT NULL DEFAULT '[]',
              dependencies TEXT NOT NULL DEFAULT '[]',
              is_system_app INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS app_releases (
              id TEXT PRIMARY KEY,
              app_id TEXT NOT NULL,
              version TEXT NOT NULL,
              channel TEXT NOT NULL,
              min_os_version TEXT NOT NULL,
              artifact_id TEXT,
              checksum TEXT NOT NULL,
              signature TEXT,
              released_at TEXT NOT NULL,
              status TEXT NOT NULL,
              FOREIGN KEY(app_id) REFERENCES app_catalog(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS app_artifacts (
              id TEXT PRIMARY KEY,
              app_id TEXT NOT NULL,
              version TEXT NOT NULL,
              checksum TEXT NOT NULL,
              artifact_base64 TEXT NOT NULL,
              uploaded_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS revoked_tokens (
              token TEXT PRIMARY KEY,
              expires_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS billing_idempotency_log (
              key TEXT PRIMARY KEY,
              invoice_id TEXT NOT NULL,
              processed_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS devices (
              device_id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              branch_id TEXT,
              name TEXT NOT NULL,
              platform TEXT NOT NULL,
              os_version TEXT NOT NULL DEFAULT '1.4.3',
              fingerprint_hash TEXT,
              installation_id TEXT,
              hardware_id TEXT,
              status TEXT NOT NULL DEFAULT 'active',
              registered_at TEXT NOT NULL,
              last_seen_at TEXT,
              ip_address TEXT,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS invoices (
              id TEXT PRIMARY KEY,
              invoice_number TEXT,
              company_id TEXT NOT NULL,
              company_name TEXT,
              billing_period TEXT,
              issue_date TEXT,
              due_date TEXT NOT NULL,
              paid_at TEXT,
              status TEXT NOT NULL,
              subtotal REAL DEFAULT 0,
              discount REAL DEFAULT 0,
              total_amount REAL NOT NULL DEFAULT 0,
              items TEXT NOT NULL DEFAULT '[]',
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS app_entitlements (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              app_id TEXT NOT NULL,
              status TEXT NOT NULL,
              pricing_model TEXT NOT NULL DEFAULT 'FREE',
              amount REAL NOT NULL DEFAULT 0,
              currency TEXT NOT NULL DEFAULT 'BRL',
              created_at TEXT NOT NULL,
              expires_at TEXT,
              license_key TEXT,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS app_installations (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              device_id TEXT,
              app_id TEXT NOT NULL,
              installed_version TEXT NOT NULL DEFAULT '1.0.0',
              status TEXT NOT NULL DEFAULT 'INSTALLED',
              installed_at TEXT NOT NULL,
              updated_at TEXT,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS payment_orders (
              id TEXT PRIMARY KEY,
              invoice_id TEXT NOT NULL,
              company_id TEXT NOT NULL,
              payment_method TEXT NOT NULL DEFAULT 'PIX',
              gateway_reference TEXT,
              qr_code TEXT,
              qr_code_copy_paste TEXT,
              status TEXT NOT NULL,
              amount REAL NOT NULL,
              created_at TEXT NOT NULL,
              confirmed_at TEXT,
              expires_at TEXT,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
              FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS company_ledger (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              type TEXT NOT NULL,
              amount REAL NOT NULL,
              previous_balance REAL NOT NULL,
              new_balance REAL NOT NULL,
              description TEXT NOT NULL,
              reference_id TEXT,
              timestamp TEXT NOT NULL,
              FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS hq_audit_logs (
              id TEXT PRIMARY KEY,
              timestamp TEXT NOT NULL,
              admin_id TEXT NOT NULL,
              admin_name TEXT NOT NULL,
              action TEXT NOT NULL,
              target_tenant_id TEXT,
              target_tenant_name TEXT,
              details TEXT NOT NULL,
              ip_address TEXT
            );

            CREATE TABLE IF NOT EXISTS idempotency_log (
              key TEXT PRIMARY KEY,
              status TEXT NOT NULL,
              processed_at TEXT NOT NULL,
              response TEXT NOT NULL
            );
          `);
        }
      },
      {
        version: 2,
        description: 'Criação dos índices de performance',
        run: (db: DatabaseSync) => {
          // In partial legacy databases, ensure indexed columns exist before index creation
          const ensureColPreIndex = (tableName: string, colName: string, colDef: string) => {
            const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
            if (!tbl) return;
            const info = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
            if (!info.some(c => c.name.toLowerCase() === colName.toLowerCase())) {
              db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef};`);
            }
          };

          ensureColPreIndex('telemetry', 'id', 'TEXT');
          ensureColPreIndex('os_releases', 'id', 'TEXT');
          ensureColPreIndex('os_releases', 'checksum', 'TEXT');
          ensureColPreIndex('os_releases', 'version', 'TEXT');

          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
            CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
            CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
            CREATE INDEX IF NOT EXISTS idx_finance_company ON finance_transactions(company_id);
            CREATE INDEX IF NOT EXISTS idx_ledger_company ON company_ledger(company_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_app_installations_tenant_device_app ON app_installations(company_id, device_id, app_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_app_entitlements_tenant_app ON app_entitlements(company_id, app_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_id ON telemetry(id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_os_releases_version ON os_releases(version);
          `);
        }
      },
      {
        version: 3,
        description: 'Normalizações e Backfills de dados de legado',
        run: (db: DatabaseSync) => {
          // Backfill null/empty id and checksum in os_releases if table exists
          const osTbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='os_releases'").get();
          if (osTbl) {
            const osCols = (db.prepare("PRAGMA table_info(os_releases)").all() as { name: string }[]).map(c => c.name.toLowerCase());
            if (!osCols.includes('id')) db.exec("ALTER TABLE os_releases ADD COLUMN id TEXT;");
            if (!osCols.includes('checksum')) db.exec("ALTER TABLE os_releases ADD COLUMN checksum TEXT;");

            const nullReleases = db.prepare("SELECT id, version, channel, changelog FROM os_releases WHERE id IS NULL OR checksum IS NULL OR checksum = ''").all() as { id: string; version: string; channel: string; changelog: string }[];
            const updateRel = db.prepare("UPDATE os_releases SET id = COALESCE(id, ?), checksum = ? WHERE version = ?");
            for (const rel of nullReleases) {
              const genId = rel.id || `rel_${rel.version.replace(/[^a-zA-Z0-9]/g, '_')}`;
              const genChecksum = createHash('sha256').update(`${rel.version}_${rel.channel}_${rel.changelog || ''}`).digest('hex');
              updateRel.run(genId, genChecksum, rel.version);
            }
          }

          // Backfill telemetry id if table exists
          const telemTbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='telemetry'").get();
          if (telemTbl) {
            const telemCols = (db.prepare("PRAGMA table_info(telemetry)").all() as { name: string }[]).map(c => c.name.toLowerCase());
            if (!telemCols.includes('id')) db.exec("ALTER TABLE telemetry ADD COLUMN id TEXT;");
            db.exec("UPDATE telemetry SET id = company_id WHERE id IS NULL OR id = '';");
          }
        }
      },
      {
        version: 4,
        description: 'Reparo e compatibilidade de colunas de schema legado',
        run: (db: DatabaseSync) => {
          const ensureCol = (tableName: string, colName: string, colDef: string) => {
            const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
            if (!tbl) {
              throw new Error(`Migration 4 failure: Table '${tableName}' does not exist while attempting to add column '${colName}'.`);
            }
            const info = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
            const hasCol = info.some(c => c.name.toLowerCase() === colName.toLowerCase());
            if (!hasCol) {
              // Crucial: Execute DDL without silent catch. If DDL fails, transaction aborts and migration is not recorded.
              db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef};`);
              const postInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
              if (!postInfo.some(c => c.name.toLowerCase() === colName.toLowerCase())) {
                throw new Error(`Migration 4 failure: Column '${colName}' was not created on table '${tableName}'.`);
              }
            }
          };

          ensureCol('companies', 'slug', 'TEXT');
          ensureCol('companies', 'cnpj', 'TEXT');
          ensureCol('companies', 'logo_url', 'TEXT');
          ensureCol('companies', 'max_terminals', 'INTEGER DEFAULT 1');
          ensureCol('companies', 'max_branches', 'INTEGER DEFAULT 1');
          ensureCol('companies', 'active_terminals', 'INTEGER DEFAULT 0');
          ensureCol('companies', 'channel', "TEXT DEFAULT 'stable'");
          ensureCol('companies', 'os_target_version', 'TEXT');
          ensureCol('companies', 'license_expires_at', 'TEXT');
          ensureCol('companies', 'branches', "TEXT DEFAULT '[]'");
          ensureCol('companies', 'allow_negative_stock', 'INTEGER DEFAULT 0');
          ensureCol('companies', 'is_demo', 'INTEGER DEFAULT 0');

          ensureCol('company_users', 'branch_id', 'TEXT');
          ensureCol('company_users', 'branch_ids', 'TEXT');
          ensureCol('company_users', 'pin', 'TEXT');

          ensureCol('hq_admins', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 1');
          ensureCol('hq_admins', 'mfa_secret', 'TEXT');

          ensureCol('plans', 'max_terminals', 'INTEGER NOT NULL DEFAULT 1');
          ensureCol('plans', 'max_branches', 'INTEGER NOT NULL DEFAULT 1');

          ensureCol('products', 'branch_id', 'TEXT');
          ensureCol('sales', 'branch_id', 'TEXT');
          ensureCol('customers', 'branch_id', 'TEXT');
          ensureCol('tables_registry', 'branch_id', 'TEXT');
          ensureCol('finance_transactions', 'branch_id', 'TEXT');
          ensureCol('orders', 'branch_id', 'TEXT');
          ensureCol('orders', 'public_tracking_token', 'TEXT');
          ensureCol('orders', 'channel', "TEXT NOT NULL DEFAULT 'MARKETPLACE'");

          ensureCol('devices', 'branch_id', 'TEXT');
          ensureCol('devices', 'fingerprint_hash', 'TEXT');
          ensureCol('devices', 'installation_id', 'TEXT');
          ensureCol('devices', 'hardware_id', 'TEXT');

          ensureCol('os_releases', 'id', 'TEXT');
          ensureCol('os_releases', 'checksum', 'TEXT');
          ensureCol('os_releases', 'mandatory', 'INTEGER NOT NULL DEFAULT 0');
          ensureCol('os_releases', 'release_channel', 'TEXT');
          ensureCol('os_releases', 'release_notes', 'TEXT');
          ensureCol('os_releases', 'published_at', 'TEXT');
          ensureCol('os_releases', 'created_at', 'TEXT');

          ensureCol('public_spaces', 'slug', 'TEXT');
          ensureCol('public_spaces', 'site_name', 'TEXT');
          ensureCol('public_spaces', 'site_description', 'TEXT');
          ensureCol('public_spaces', 'theme', 'TEXT');
          ensureCol('public_spaces', 'created_at', 'TEXT');
        }
      },
      {
        version: 5,
        description: 'Backfill e integridade de app_entitlements e app_installations',
        run: (db: DatabaseSync) => {
          const compTbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='companies'").get();
          const entTbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_entitlements'").get();
          const instTbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_installations'").get();

          if (compTbl && entTbl && instTbl) {
            const companies = db.prepare('SELECT id, installed_apps FROM companies').all() as { id: string; installed_apps: string }[];
            const now = new Date().toISOString();
            for (const comp of companies) {
              if (!comp.installed_apps) continue;
              let apps: string[] = [];
              try {
                apps = JSON.parse(comp.installed_apps);
              } catch (err) {
                console.error(`[CentralDatabaseEngine][MIGRATION WARNING] Corrupted 'installed_apps' JSON encountered in company '${comp.id}'. Skipping migration for this record. Error:`, err);
                continue;
              }
              if (!Array.isArray(apps)) continue;

              for (const appId of apps) {
                if (!appId) continue;
                const existingEnt = db.prepare('SELECT id FROM app_entitlements WHERE company_id = ? AND app_id = ?').get(comp.id, appId);
                if (!existingEnt) {
                  const entId = `ent_${comp.id}_${appId}`;
                  db.prepare(`
                    INSERT OR IGNORE INTO app_entitlements (id, company_id, app_id, status, pricing_model, amount, currency, created_at)
                    VALUES (?, ?, ?, 'ACTIVE', 'FREE', 0, 'BRL', ?)
                  `).run(entId, comp.id, appId, now);
                }

                const existingInst = db.prepare('SELECT id FROM app_installations WHERE company_id = ? AND app_id = ?').get(comp.id, appId);
                if (!existingInst) {
                  const instId = `inst_${comp.id}_web_${appId}`;
                  db.prepare(`
                    INSERT OR IGNORE INTO app_installations (id, company_id, device_id, app_id, installed_version, status, installed_at, updated_at)
                    VALUES (?, ?, 'default-web-terminal', ?, '1.0.0', 'INSTALLED', ?, ?)
                  `).run(instId, comp.id, appId, now, now);
                }
              }
            }
          }
        }
      },
      {
        version: 6,
        description: 'Criação da tabela de rate limits atômicos e persistentes',
        run: (db: DatabaseSync) => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS rate_limits (
              key TEXT PRIMARY KEY,
              count INTEGER NOT NULL DEFAULT 0,
              reset_time INTEGER NOT NULL
            );
          `);
        }
      },
      {
        version: 7,
        description: '3eatcru ID — Criação da tabela customer_accounts e vinculo com CRM local e Pedidos',
        run: (db: DatabaseSync) => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS customer_accounts (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              phone TEXT NOT NULL,
              password TEXT NOT NULL,
              photo_url TEXT,
              addresses TEXT NOT NULL DEFAULT '[]',
              preferences TEXT NOT NULL DEFAULT '{}',
              favorites TEXT NOT NULL DEFAULT '[]',
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL,
              updated_at TEXT
            );
          `);

          const ensureCol = (tableName: string, colName: string, colDef: string) => {
            const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
            if (!tbl) return;
            const info = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
            const hasCol = info.some(c => c.name.toLowerCase() === colName.toLowerCase());
            if (!hasCol) {
              db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef};`);
            }
          };

          ensureCol('customers', 'customer_account_id', 'TEXT');
          ensureCol('customers', 'notes', 'TEXT');
          ensureCol('customers', 'tags', "TEXT DEFAULT '[]'");
          ensureCol('customers', 'consents', "TEXT DEFAULT '{}'");
          ensureCol('customers', 'first_purchase_at', 'TEXT');
          ensureCol('customers', 'last_purchase_at', 'TEXT');

          ensureCol('orders', 'customer_account_id', 'TEXT');

          db.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_accounts_email ON customer_accounts(email);
            CREATE INDEX IF NOT EXISTS idx_customers_account ON customers(customer_account_id);
            CREATE INDEX IF NOT EXISTS idx_orders_customer_account ON orders(customer_account_id);
          `);
        }
      },
      {
        version: 8,
        description: 'Garantir coluna branch_ids em company_users para autorização granular de filiais',
        run: (db: DatabaseSync) => {
          const ensureCol = (tableName: string, colName: string, colDef: string) => {
            const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
            if (!tbl) return;
            const info = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
            const hasCol = info.some(c => c.name.toLowerCase() === colName.toLowerCase());
            if (!hasCol) {
              db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef};`);
            }
          };
          ensureCol('company_users', 'branch_ids', 'TEXT');
        }
      }
    ];

    for (const migration of migrations) {
      if (!migrated.has(migration.version)) {
        console.log(`[CentralDatabaseEngine] Running migration ${migration.version}: ${migration.description}...`);
        try {
          this.runInTransaction(() => {
            migration.run(this.db!);
            this.db!.prepare("INSERT INTO schema_migrations (version, migrated_at) VALUES (?, ?)").run(migration.version, new Date().toISOString());
          });
          console.log(`[CentralDatabaseEngine] Migration ${migration.version} completed successfully.`);
        } catch (migErr) {
          console.error(`[CentralDatabaseEngine] Migration ${migration.version} failed:`, migErr);
          throw new Error(`Critical Migration Failure at version ${migration.version}: ${migErr instanceof Error ? migErr.message : String(migErr)}`);
        }
      }
    }
  }

  public hasData(): boolean {
    if (!this.db) return false;
    try {
      const coreTables = [
        'hq_admins',
        'companies',
        'apps',
        'app_releases',
        'sales',
        'audit_logs',
        'processed_webhook_events',
        'devices'
      ];

      for (const table of coreTables) {
        try {
          const row = this.db.prepare(`SELECT count(*) as cnt FROM ${table}`).get() as { cnt: number } | undefined;
          if (row && row.cnt > 0) {
            return true;
          }
        } catch {
          // Table may not exist yet if migrations have not run
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  private migrateLegacyMfaSecrets() {
    if (!this.db) return;
    try {
      const tableCheck = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hq_admins'").get();
      if (!tableCheck) return;

      const admins = this.db.prepare("SELECT id, email, mfa_secret FROM hq_admins WHERE mfa_secret IS NOT NULL AND mfa_secret != ''").all() as { id: string, email: string, mfa_secret: string }[];
      
      let migratedCount = 0;
      this.runInTransaction(() => {
        for (const admin of admins) {
          if (!admin.mfa_secret.startsWith('enc:')) {
            console.log(`[CentralDatabaseEngine] Migrando segredo mfa de ${admin.email} de texto puro para formato criptografado no banco de dados...`);
            const encrypted = encryptMfaSecret(admin.mfa_secret);
            this.db!.prepare("UPDATE hq_admins SET mfa_secret = ? WHERE id = ?").run(encrypted, admin.id);
            migratedCount++;
          }
        }
      });
      if (migratedCount > 0) {
        console.log(`[CentralDatabaseEngine] Sucesso: ${migratedCount} segredo(s) MFA legados migrado(s) com sucesso.`);
      }
    } catch (err) {
      console.warn('[CentralDatabaseEngine] Warning during legacy MFA secrets migration:', err);
    }
  }

  public isWebhookProcessed(eventId: string): boolean {
    if (!this.db) return false;
    try {
      const row = this.db.prepare('SELECT 1 FROM processed_webhook_events WHERE event_id = ?').get(eventId) as Record<string, unknown> | undefined;
      return !!row;
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error checking webhook event in database:', err);
      return false;
    }
  }

  public markWebhookProcessed(eventId: string) {
    if (!this.db) return;
    try {
      this.db.prepare('INSERT OR IGNORE INTO processed_webhook_events (event_id, processed_at) VALUES (?, ?)').run(eventId, new Date().toISOString());
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error marking webhook as processed in database:', err);
      throw err;
    }
  }

  public isSaleProcessed(saleId: string): boolean {
    if (!this.db) return false;
    try {
      const row = this.db.prepare('SELECT 1 FROM sales WHERE id = ?').get(saleId) as Record<string, unknown> | undefined;
      return !!row;
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error checking sale in database:', err);
      return false;
    }
  }

  public getSale(saleId: string): { id: string; companyId: string } | null {
    if (!this.db) return null;
    try {
      const row = this.db.prepare('SELECT id, company_id FROM sales WHERE id = ?').get(saleId) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: String(row['id']),
        companyId: String(row['company_id'])
      };
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error fetching sale from database:', err);
      return null;
    }
  }

  public isIdempotencyProcessed(key: string): { status: string; processedAt: string; response: unknown } | null {
    if (!this.db) return null;
    try {
      const row = this.db.prepare('SELECT * FROM idempotency_log WHERE key = ?').get(key) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        status: String(row['status']),
        processedAt: String(row['processed_at']),
        response: JSON.parse(String(row['response']) || '{}')
      };
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error checking idempotency key in database:', err);
      return null;
    }
  }

  public saveIdempotencyEntry(key: string, entry: { status: string; processedAt: string; response: unknown }) {
    if (!this.db) return;
    try {
      this.db.prepare(`
        INSERT INTO idempotency_log (key, status, processed_at, response) VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          status = excluded.status,
          processed_at = excluded.processed_at,
          response = excluded.response
      `).run(key, entry.status, entry.processedAt, JSON.stringify(entry.response));
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error saving idempotency entry to database:', err);
      throw err;
    }
  }

  public isBillingIdempotencyProcessed(key: string): string | null {
    if (!this.db) return null;
    try {
      const row = this.db.prepare('SELECT invoice_id FROM billing_idempotency_log WHERE key = ?').get(key) as Record<string, unknown> | undefined;
      return row ? String(row['invoice_id']) : null;
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error checking billing idempotency key in database:', err);
      return null;
    }
  }

  public saveBillingIdempotencyEntry(key: string, invoiceId: string) {
    if (!this.db) return;
    try {
      this.db.prepare(`
        INSERT INTO billing_idempotency_log (key, invoice_id, processed_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO NOTHING
      `).run(key, invoiceId, new Date().toISOString());
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error saving billing idempotency entry to database:', err);
      throw err;
    }
  }

  public persistState(state: {
    plans?: unknown[];
    hqAdmins?: unknown[];
    companies: Map<string, unknown>;
    companyUsers: Map<string, unknown[]>;
    products: Map<string, unknown>;
    sales: Map<string, unknown>;
    customers: Map<string, unknown>;
    tables: Map<string, unknown>;
    financeTransactions: Map<string, unknown>;
    publicSpaces: Map<string, unknown>;
    orders?: Map<string, unknown>;
    telemetry?: Map<string, unknown>;
    processedWebhookEvents?: Set<string>;
    osReleases?: unknown[];
    apps?: unknown[];
    billingIdempotencyLog?: Map<string, string>;
    devices: Map<string, unknown>;
    invoices: Map<string, unknown[]>;
    appEntitlements: Map<string, unknown>;
    appInstallations?: Map<string, unknown>;
    paymentOrders?: Map<string, unknown>;
    companyLedger: Map<string, unknown[]>;
    hqAuditLogs?: unknown[];
  }, fullReconciliation = false) {
    if (!this.db) return;

    try {
      this.db.exec('BEGIN IMMEDIATE;');

      // Plans
      if (state.plans && Array.isArray(state.plans)) {
        const plansInfo = this.db.prepare('PRAGMA table_info(plans)').all() as { name: string }[];
        const colNames = plansInfo.map(c => c.name);
        const hasPrice = colNames.includes('price');
        const hasMonthlyPrice = colNames.includes('monthly_price');
        const hasSupportLevel = colNames.includes('support_level');

        for (const rawPlan of state.plans) {
          const p = rawPlan as Record<string, unknown>;
          const mPrice = Number(p['monthlyPrice'] ?? p['price'] ?? 0);
          const cols: string[] = ['id', 'name', 'max_terminals', 'max_branches', 'description', 'features'];
          const vals: unknown[] = [
            String(p['id']),
            String(p['name'] || ''),
            Number(p['maxTerminals'] || 1),
            Number(p['maxBranches'] || 1),
            String(p['description'] || ''),
            JSON.stringify(p['features'] || [])
          ];

          if (hasMonthlyPrice) {
            cols.push('monthly_price');
            vals.push(mPrice);
          }
          if (hasPrice) {
            cols.push('price');
            vals.push(mPrice);
          }
          if (colNames.includes('included_apps')) {
            cols.push('included_apps');
            vals.push(JSON.stringify(p['includedApps'] || []));
          }
          if (hasSupportLevel) {
            cols.push('support_level');
            vals.push(String(p['supportLevel'] || 'standard'));
          }

          const placeholders = cols.map(() => '?').join(', ');
          const updateAssignments = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');
          const stmt = this.db.prepare(`
            INSERT INTO plans (${cols.join(', ')}) VALUES (${placeholders})
            ON CONFLICT(id) DO UPDATE SET ${updateAssignments}
          `);
          stmt.run(...vals);
        }
      }

      // HQ Admins
      if (state.hqAdmins && Array.isArray(state.hqAdmins)) {
        const insertAdmin = this.db.prepare(`
          INSERT INTO hq_admins (
            id, name, email, role, password, mfa_enabled, mfa_secret
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            role = excluded.role,
            password = excluded.password,
            mfa_enabled = excluded.mfa_enabled,
            mfa_secret = excluded.mfa_secret
        `);
        for (const rawAdmin of state.hqAdmins) {
          const a = rawAdmin as Record<string, unknown>;
          insertAdmin.run(
            String(a['id']),
            String(a['name'] || ''),
            String(a['email'] || ''),
            String(a['role'] || 'hq_admin'),
            String(a['password'] || ''),
            a['mfaEnabled'] !== false ? 1 : 0,
            a['mfaSecret'] ? encryptMfaSecret(String(a['mfaSecret'])) : null
          );
        }
      }

      // Companies (Using safe UPSERT with ON CONFLICT to prevent DELETE CASCADE on child tables)
      const insertComp = this.db.prepare(`
        INSERT INTO companies (
          id, name, slug, cnpj, logo_url, balance, installed_apps, status,
          plan, max_terminals, max_branches, active_terminals, channel,
          os_target_version, license_expires_at, branches, allow_negative_stock, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          slug = excluded.slug,
          cnpj = excluded.cnpj,
          logo_url = excluded.logo_url,
          balance = excluded.balance,
          installed_apps = excluded.installed_apps,
          status = excluded.status,
          plan = excluded.plan,
          max_terminals = excluded.max_terminals,
          max_branches = excluded.max_branches,
          active_terminals = excluded.active_terminals,
          channel = excluded.channel,
          os_target_version = excluded.os_target_version,
          license_expires_at = excluded.license_expires_at,
          branches = excluded.branches,
          allow_negative_stock = excluded.allow_negative_stock,
          is_demo = excluded.is_demo
      `);

      for (const [id, rawComp] of state.companies.entries()) {
        const c = rawComp as Record<string, unknown>;
        insertComp.run(
          id,
          String(c['name'] || ''),
          (c['slug'] as string) || null,
          (c['cnpj'] || c['document'] || c['taxId'] || null) as string | null,
          (c['logoUrl'] as string) || null,
          Number(c['balance'] || 0),
          JSON.stringify(c['installedApps'] || []),
          String(c['status'] || 'active'),
          (c['plan'] as string) || 'starter',
          Number(c['maxTerminals'] || 1),
          Number(c['maxBranches'] || 1),
          Number(c['activeTerminals'] || 0),
          (c['channel'] as string) || 'stable',
          (c['osTargetVersion'] as string) || null,
          (c['licenseExpiresAt'] as string) || null,
          JSON.stringify(c['branches'] || []),
          c['allowNegativeStock'] ? 1 : 0,
          c['isDemo'] ? 1 : 0
        );
      }

      // Company Users (Safe UPSERT on id)
      const insertUser = this.db.prepare(`
        INSERT INTO company_users (
          id, company_id, branch_id, branch_ids, name, email, role, password, pin, active, last_login
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          branch_ids = excluded.branch_ids,
          name = excluded.name,
          email = excluded.email,
          role = excluded.role,
          password = excluded.password,
          pin = excluded.pin,
          active = excluded.active,
          last_login = excluded.last_login
      `);

      for (const [companyId, usersList] of state.companyUsers.entries()) {
        if (Array.isArray(usersList)) {
          for (const u of usersList) {
            const user = u as Record<string, unknown>;
            const bIds = Array.isArray(user['branchIds']) 
              ? user['branchIds'] 
              : (user['branchId'] ? [user['branchId']] : []);
            const branchIdVal = (user['branchId'] as string) || (bIds.length > 0 ? String(bIds[0]) : null);
            insertUser.run(
              String(user['id']),
              companyId,
              branchIdVal,
              JSON.stringify(bIds),
              String(user['name'] || ''),
              String(user['email'] || ''),
              String(user['role'] || 'operator'),
              String(user['password'] || ''),
              (user['pin'] as string) || null,
              user['active'] !== false ? 1 : 0,
              (user['lastLogin'] as string) || null
            );
          }
        }
      }

      // Products (Safe UPSERT on id)
      const insertProduct = this.db.prepare(`
        INSERT INTO products (id, company_id, branch_id, name, price, stock)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          name = excluded.name,
          price = excluded.price,
          stock = excluded.stock
      `);
      for (const [id, rawProd] of state.products.entries()) {
        const p = rawProd as Record<string, unknown>;
        if (!state.companies.has(String(p['companyId']))) continue;
        insertProduct.run(
          id,
          String(p['companyId'] || ''),
          (p['branchId'] as string) || null,
          String(p['name'] || ''),
          Number(p['price'] || 0),
          Number(p['stock'] || 0)
        );
      }

      // Sales (Safe UPSERT on id)
      const insertSale = this.db.prepare(`
        INSERT INTO sales (id, company_id, branch_id, items, total, timestamp, payment_method, operator)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          items = excluded.items,
          total = excluded.total,
          timestamp = excluded.timestamp,
          payment_method = excluded.payment_method,
          operator = excluded.operator
      `);
      for (const [id, rawSale] of state.sales.entries()) {
        const s = rawSale as Record<string, unknown>;
        if (!state.companies.has(String(s['companyId']))) continue;
        insertSale.run(
          id,
          String(s['companyId'] || ''),
          (s['branchId'] as string) || null,
          JSON.stringify(s['items'] || []),
          Number(s['total'] || 0),
          String(s['timestamp'] || new Date().toISOString()),
          (s['paymentMethod'] as string) || null,
          (s['operator'] as string) || null
        );
      }

      // Customers (Safe UPSERT on id)
      const insertCust = this.db.prepare(`
        INSERT INTO customers (id, company_id, branch_id, name, phone, email, points, total_spent, tier, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          name = excluded.name,
          phone = excluded.phone,
          email = excluded.email,
          points = excluded.points,
          total_spent = excluded.total_spent,
          tier = excluded.tier,
          created_at = excluded.created_at
      `);
      for (const [id, rawCust] of state.customers.entries()) {
        const cust = rawCust as Record<string, unknown>;
        if (!state.companies.has(String(cust['companyId']))) continue;
        insertCust.run(
          id,
          String(cust['companyId'] || ''),
          (cust['branchId'] as string) || null,
          String(cust['name'] || ''),
          String(cust['phone'] || ''),
          String(cust['email'] || ''),
          Number(cust['points'] || 0),
          Number(cust['totalSpent'] || 0),
          String(cust['tier'] || 'Bronze'),
          String(cust['createdAt'] || new Date().toISOString())
        );
      }

      // Tables (Safe UPSERT on id)
      const insertTable = this.db.prepare(`
        INSERT INTO tables_registry (id, company_id, branch_id, number, name, capacity, status, current_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          number = excluded.number,
          name = excluded.name,
          capacity = excluded.capacity,
          status = excluded.status,
          current_order = excluded.current_order
      `);
      for (const [id, rawTable] of state.tables.entries()) {
        const t = rawTable as Record<string, unknown>;
        if (!state.companies.has(String(t['companyId']))) continue;
        insertTable.run(
          id,
          String(t['companyId'] || ''),
          (t['branchId'] as string) || null,
          Number(t['number'] || 1),
          String(t['name'] || ''),
          Number(t['capacity'] || 4),
          String(t['status'] || 'AVAILABLE'),
          t['currentOrder'] ? JSON.stringify(t['currentOrder']) : null
        );
      }

      // Finance Transactions (Safe UPSERT on id)
      const insertFinance = this.db.prepare(`
        INSERT INTO finance_transactions (
          id, company_id, branch_id, type, category, description, amount, payment_method, timestamp, operator, reference_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          type = excluded.type,
          category = excluded.category,
          description = excluded.description,
          amount = excluded.amount,
          payment_method = excluded.payment_method,
          timestamp = excluded.timestamp,
          operator = excluded.operator,
          reference_id = excluded.reference_id
      `);
      for (const [id, rawFt] of state.financeTransactions.entries()) {
        const ft = rawFt as Record<string, unknown>;
        if (!state.companies.has(String(ft['companyId']))) continue;
        insertFinance.run(
          id,
          String(ft['companyId'] || ''),
          (ft['branchId'] as string) || null,
          String(ft['type'] || 'INFLOW'),
          String(ft['category'] || 'SALE'),
          String(ft['description'] || ''),
          Number(ft['amount'] || 0),
          String(ft['paymentMethod'] || 'DINHEIRO'),
          String(ft['timestamp'] || new Date().toISOString()),
          String(ft['operator'] || 'Operador'),
          (ft['referenceId'] as string) || null
        );
      }

      // Public Spaces (Safe UPSERT on company_id)
      const insertPs = this.db.prepare(`
        INSERT INTO public_spaces (
          company_id, company_slug, title, description, logo, template_id, theme_color,
          status, published_at, phone, email, address, hours, products
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(company_id) DO UPDATE SET
          company_slug = excluded.company_slug,
          title = excluded.title,
          description = excluded.description,
          logo = excluded.logo,
          template_id = excluded.template_id,
          theme_color = excluded.theme_color,
          status = excluded.status,
          published_at = excluded.published_at,
          phone = excluded.phone,
          email = excluded.email,
          address = excluded.address,
          hours = excluded.hours,
          products = excluded.products
      `);
      for (const [id, rawPs] of state.publicSpaces.entries()) {
        if (!state.companies.has(id)) continue;
        const ps = rawPs as Record<string, unknown>;
        insertPs.run(
          id,
          String(ps['companySlug'] || ''),
          String(ps['title'] || ''),
          String(ps['description'] || ''),
          String(ps['logo'] || ''),
          String(ps['templateId'] || 'default'),
          String(ps['themeColor'] || '#2563eb'),
          String(ps['status'] || 'PUBLISHED'),
          (ps['publishedAt'] as string) || null,
          String(ps['phone'] || ''),
          String(ps['email'] || ''),
          String(ps['address'] || ''),
          String(ps['hours'] || ''),
          JSON.stringify(ps['products'] || [])
        );
      }

      // Public Orders (Safe UPSERT on id)
      if (state.orders) {
        const insertOrder = this.db.prepare(`
          INSERT INTO orders (
            id, public_tracking_token, company_id, branch_id, company_name, customer_name,
            customer_phone, customer_address, items, total, notes, payment_method, status, channel, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            public_tracking_token = excluded.public_tracking_token,
            company_id = excluded.company_id,
            branch_id = excluded.branch_id,
            company_name = excluded.company_name,
            customer_name = excluded.customer_name,
            customer_phone = excluded.customer_phone,
            customer_address = excluded.customer_address,
            items = excluded.items,
            total = excluded.total,
            notes = excluded.notes,
            payment_method = excluded.payment_method,
            status = excluded.status,
            channel = excluded.channel,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
        `);
        for (const [id, rawOrd] of state.orders.entries()) {
          const ord = rawOrd as Record<string, unknown>;
          if (!state.companies.has(String(ord['companyId']))) continue;
          insertOrder.run(
            id,
            (ord['publicTrackingToken'] as string) || null,
            String(ord['companyId'] || ''),
            (ord['branchId'] as string) || null,
            String(ord['companyName'] || ''),
            String(ord['customerName'] || ''),
            (ord['customerPhone'] as string) || null,
            (ord['customerAddress'] as string) || null,
            JSON.stringify(ord['items'] || []),
            Number(ord['total'] || 0),
            (ord['notes'] as string) || null,
            String(ord['paymentMethod'] || 'PIX'),
            String(ord['status'] || 'RECEIVED'),
            String(ord['channel'] || 'MARKETPLACE'),
            String(ord['createdAt'] || new Date().toISOString()),
            (ord['updatedAt'] as string) || null
          );
        }
      }

      // Telemetry (Safe UPSERT / check in SQLite)
      if (state.telemetry) {
        for (const [id, rawTel] of state.telemetry.entries()) {
          const tel = rawTel as Record<string, unknown>;
          const companyId = String(tel['companyId'] || id);
          const deviceId = (tel['deviceId'] as string) || null;
          const entryKey = String(tel['id'] || id || `${companyId}:${deviceId || 'default'}`);
          const version = String(tel['version'] || tel['osVersion'] || '1.4.3');
          const checks = JSON.stringify(tel['checks'] || []);
          const existing = this.db.prepare('SELECT id FROM telemetry WHERE id = ?').get(entryKey) as Record<string, unknown> | undefined;
          if (existing) {
            this.db.prepare(`
              UPDATE telemetry SET
                company_name = ?, device_id = ?, timestamp = ?, overall_status = ?,
                client_reported_status = ?, central_calculated_health = ?, checks = ?,
                platform = ?, version = ?, metrics = ?, os_version = ?
              WHERE id = ?
            `).run(
              String(tel['companyName'] || ''),
              deviceId,
              String(tel['timestamp'] || new Date().toISOString()),
              String(tel['overallStatus'] || 'healthy'),
              (tel['clientReportedStatus'] as string) || null,
              (tel['centralCalculatedHealth'] as string) || null,
              checks,
              String(tel['platform'] || 'web'),
              version,
              checks,
              version,
              entryKey
            );
          } else {
            this.db.prepare(`
              INSERT INTO telemetry (
                id, company_id, company_name, device_id, timestamp, overall_status, client_reported_status,
                central_calculated_health, checks, platform, version, metrics, os_version, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              entryKey,
              companyId,
              String(tel['companyName'] || ''),
              deviceId,
              String(tel['timestamp'] || new Date().toISOString()),
              String(tel['overallStatus'] || 'healthy'),
              (tel['clientReportedStatus'] as string) || null,
              (tel['centralCalculatedHealth'] as string) || null,
              checks,
              String(tel['platform'] || 'web'),
              version,
              checks,
              version,
              new Date().toISOString()
            );
          }
        }
      }

      // Processed Webhook Events (Append-only on event_id)
      if (state.processedWebhookEvents) {
        const insertEvent = this.db.prepare(`
          INSERT INTO processed_webhook_events (event_id, processed_at)
          VALUES (?, ?)
          ON CONFLICT(event_id) DO NOTHING
        `);
        for (const eventId of state.processedWebhookEvents) {
          insertEvent.run(eventId, new Date().toISOString());
        }
      }

      // OS Releases (Safe UPSERT on version)
      if (state.osReleases && Array.isArray(state.osReleases)) {
        const insertRel = this.db.prepare(`
          INSERT INTO os_releases (
            id, version, channel, release_date, status, changelog, min_required_by_apps,
            checksum, mandatory, release_channel, release_notes, published_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(version) DO UPDATE SET
            channel = excluded.channel,
            release_date = excluded.release_date,
            status = excluded.status,
            changelog = excluded.changelog,
            min_required_by_apps = excluded.min_required_by_apps,
            checksum = excluded.checksum,
            mandatory = excluded.mandatory,
            release_channel = excluded.release_channel,
            release_notes = excluded.release_notes,
            published_at = excluded.published_at
        `);
        for (const rawRel of state.osReleases) {
          const r = rawRel as Record<string, unknown>;
          const v = String(r['version']);
          const ch = String(r['channel'] || r['releaseChannel'] || 'stable');
          const cl = typeof r['changelog'] === 'string' ? r['changelog'] : (Array.isArray(r['changelog']) ? (r['changelog'] as string[]).join('\n') : (Array.isArray(r['releaseNotes']) ? (r['releaseNotes'] as string[]).join('\n') : ''));
          const cs = (r['checksum'] as string) || createHash('sha256').update(`${v}_${ch}_${cl}`).digest('hex');
          const id = (r['id'] as string) || `rel_${v.replace(/[^a-zA-Z0-9]/g, '_')}`;
          const mand = (r['mandatory'] ?? r['isMandatory']) ? 1 : 0;
          const rd = String(r['releaseDate'] || r['publishedAt'] || new Date().toISOString());
          const minReq = (r['minRequiredByApps'] ?? r['minCoreVersion'] ?? r['minOsVersion'] ?? '1.0.0') as string;
          insertRel.run(
            id,
            v,
            ch,
            rd,
            String(r['status'] || 'active'),
            cl,
            minReq,
            cs,
            mand,
            ch,
            cl,
            rd,
            rd
          );
        }
      }

      // App Catalog (Safe UPSERT on id)
      if (state.apps && Array.isArray(state.apps)) {
        const insertApp = this.db.prepare(`
          INSERT INTO app_catalog (
            id, name, description, developer, publisher, category, icon,
            pricing, lifecycle, current_release, permissions, capabilities, dependencies, is_system_app
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            developer = excluded.developer,
            publisher = excluded.publisher,
            category = excluded.category,
            icon = excluded.icon,
            pricing = excluded.pricing,
            lifecycle = excluded.lifecycle,
            current_release = excluded.current_release,
            permissions = excluded.permissions,
            capabilities = excluded.capabilities,
            dependencies = excluded.dependencies,
            is_system_app = excluded.is_system_app
        `);
        for (const rawApp of state.apps) {
          const a = rawApp as Record<string, unknown>;
          insertApp.run(
            String(a['id']),
            String(a['name'] || ''),
            String(a['description'] || ''),
            String(a['developer'] || ''),
            (a['publisher'] as string) || null,
            String(a['category'] || 'general'),
            String(a['icon'] || 'apps'),
            JSON.stringify(a['pricing'] || {}),
            JSON.stringify(a['lifecycle'] || {}),
            a['currentRelease'] ? JSON.stringify(a['currentRelease']) : null,
            JSON.stringify(a['permissions'] || []),
            JSON.stringify(a['capabilities'] || []),
            JSON.stringify(a['dependencies'] || []),
            a['isSystemApp'] ? 1 : 0
          );
        }
      }

      // Billing Idempotency Log (Append-only on key)
      if (state.billingIdempotencyLog) {
        const insertBillLog = this.db.prepare(`
          INSERT INTO billing_idempotency_log (key, invoice_id, processed_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO NOTHING
        `);
        for (const [key, invoiceId] of state.billingIdempotencyLog.entries()) {
          insertBillLog.run(key, invoiceId, new Date().toISOString());
        }
      }

      // Devices (Safe UPSERT on device_id)
      const insertDev = this.db.prepare(`
        INSERT INTO devices (
          device_id, company_id, branch_id, name, platform, os_version, fingerprint_hash, installation_id, hardware_id, status, registered_at, last_seen_at, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(device_id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          name = excluded.name,
          platform = excluded.platform,
          os_version = excluded.os_version,
          fingerprint_hash = excluded.fingerprint_hash,
          installation_id = excluded.installation_id,
          hardware_id = excluded.hardware_id,
          status = excluded.status,
          registered_at = excluded.registered_at,
          last_seen_at = excluded.last_seen_at,
          ip_address = excluded.ip_address
      `);
      for (const [id, rawDev] of state.devices.entries()) {
        const d = rawDev as Record<string, unknown>;
        const compId = String(d['companyId'] || '');
        if (!state.companies.has(compId)) continue;
        insertDev.run(
          id,
          compId,
          (d['branchId'] as string) || null,
          String(d['name'] || ''),
          String(d['platform'] || 'web'),
          String(d['osVersion'] || '1.4.3'),
          (d['fingerprintHash'] as string) || null,
          (d['installationId'] as string) || null,
          (d['hardwareId'] as string) || (d['fingerprintHash'] as string) || id,
          String(d['status'] || 'active'),
          String(d['registeredAt'] || new Date().toISOString()),
          (d['lastSeenAt'] as string) || null,
          (d['ipAddress'] as string) || null
        );
      }

      // Invoices (Safe UPSERT on id)
      const invCols = (this.db.prepare('PRAGMA table_info(invoices)').all() as { name: string }[]).map(c => c.name);
      const hasInvAmount = invCols.includes('amount');
      const hasInvTotalAmount = invCols.includes('total_amount');
      const hasInvSubtotal = invCols.includes('subtotal');
      const hasInvDiscount = invCols.includes('discount');
      const hasInvNumber = invCols.includes('invoice_number');
      const hasInvCompName = invCols.includes('company_name');
      const hasInvPeriod = invCols.includes('billing_period');
      const hasInvIssueDate = invCols.includes('issue_date');

      for (const [key, rawVal] of state.invoices.entries()) {
        const invList = Array.isArray(rawVal) ? rawVal : [rawVal];
        for (const rawInv of invList) {
          if (!rawInv || typeof rawInv !== 'object') continue;
          const inv = rawInv as Record<string, unknown>;
          const companyId = String(inv['companyId'] || key);
          if (!state.companies.has(companyId)) continue;
          const totAmt = Number(inv['totalAmount'] ?? inv['amount'] ?? 0);
          const cols = ['id', 'company_id', 'due_date', 'paid_at', 'status', 'items'];
          const vals: unknown[] = [
            String(inv['id']),
            companyId,
            String(inv['dueDate'] || ''),
            (inv['paidAt'] as string) || null,
            String(inv['status'] || 'PENDING'),
            JSON.stringify(inv['items'] || [])
          ];
            if (hasInvAmount) {
              cols.push('amount');
              vals.push(totAmt);
            }
            if (hasInvTotalAmount) {
              cols.push('total_amount');
              vals.push(totAmt);
            }
            if (hasInvSubtotal) {
              cols.push('subtotal');
              vals.push(Number(inv['subtotal'] || 0));
            }
            if (hasInvDiscount) {
              cols.push('discount');
              vals.push(Number(inv['discount'] || 0));
            }
            if (hasInvNumber) {
              cols.push('invoice_number');
              vals.push((inv['invoiceNumber'] as string) || null);
            }
            if (hasInvCompName) {
              cols.push('company_name');
              vals.push((inv['companyName'] as string) || null);
            }
            if (hasInvPeriod) {
              cols.push('billing_period');
              vals.push((inv['billingPeriod'] as string) || null);
            }
            if (hasInvIssueDate) {
              cols.push('issue_date');
              vals.push((inv['issueDate'] as string) || null);
            }

            const ph = cols.map(() => '?').join(', ');
            const updates = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');
            const query = `
              INSERT INTO invoices (${cols.join(', ')}) VALUES (${ph})
              ON CONFLICT(id) DO UPDATE SET ${updates}
            `;
            this.db.prepare(query).run(...vals);
          }
        }

      // App Entitlements (Safe UPSERT on id)
      const insertEnt = this.db.prepare(`
        INSERT INTO app_entitlements (
          id, company_id, app_id, status, pricing_model, amount, currency, created_at, expires_at, license_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          app_id = excluded.app_id,
          status = excluded.status,
          pricing_model = excluded.pricing_model,
          amount = excluded.amount,
          currency = excluded.currency,
          created_at = excluded.created_at,
          expires_at = excluded.expires_at,
          license_key = excluded.license_key
      `);
      for (const [id, rawEnt] of state.appEntitlements.entries()) {
        const ent = rawEnt as Record<string, unknown>;
        const compId = String(ent['companyId'] || '');
        if (!state.companies.has(compId)) continue;
        insertEnt.run(
          String(ent['id'] || id),
          compId,
          String(ent['appId'] || ''),
          String(ent['status'] || 'ACTIVE'),
          String(ent['pricingModel'] || 'FREE'),
          Number(ent['amount'] || 0),
          String(ent['currency'] || 'BRL'),
          String(ent['createdAt'] || new Date().toISOString()),
          (ent['expiresAt'] as string) || null,
          (ent['licenseKey'] as string) || null
        );
      }

      // App Installations (Safe UPSERT on id)
      if (state.appInstallations) {
        const insertAppInst = this.db.prepare(`
          INSERT INTO app_installations (
            id, company_id, device_id, app_id, installed_version, status, installed_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            company_id = excluded.company_id,
            device_id = excluded.device_id,
            app_id = excluded.app_id,
            installed_version = excluded.installed_version,
            status = excluded.status,
            installed_at = excluded.installed_at,
            updated_at = excluded.updated_at
        `);
        for (const [id, rawInst] of state.appInstallations.entries()) {
          const inst = rawInst as Record<string, unknown>;
          const compId = String(inst['companyId'] || '');
          if (!state.companies.has(compId)) continue;
          insertAppInst.run(
            String(inst['id'] || id),
            compId,
            (inst['deviceId'] as string) || null,
            String(inst['appId'] || ''),
            String(inst['installedVersion'] || inst['version'] || '1.0.0'),
            String(inst['status'] || 'INSTALLED'),
            String(inst['installedAt'] || new Date().toISOString()),
            (inst['updatedAt'] as string) || null
          );
        }
      }

      // Payment Orders (Safe UPSERT on id)
      if (state.paymentOrders) {
        const poCols = (this.db.prepare('PRAGMA table_info(payment_orders)').all() as { name: string }[]).map(c => c.name);
        const hasMethod = poCols.includes('method');
        const hasPaymentMethod = poCols.includes('payment_method');
        const hasExpiresAt = poCols.includes('expires_at');
        const hasConfirmedAt = poCols.includes('confirmed_at');
        const hasGatewayRef = poCols.includes('gateway_reference');
        const hasQrCodeCopy = poCols.includes('qr_code_copy_paste');
        const hasPixCopia = poCols.includes('pix_copia_e_cola');

        for (const [id, rawPo] of state.paymentOrders.entries()) {
          const po = rawPo as Record<string, unknown>;
          const compId = String(po['companyId'] || '');
          if (!state.companies.has(compId)) continue;
          const methodVal = String(po['paymentMethod'] || po['method'] || 'PIX');
          const qrCopyVal = (po['qrCodeCopyPaste'] ?? po['pixCopiaECola'] ?? null) as string | null;
          const cols = ['id', 'company_id', 'amount', 'status', 'created_at'];
          const vals: unknown[] = [
            id,
            String(po['companyId'] || ''),
            Number(po['amount'] || 0),
            String(po['status'] || 'PENDING'),
            String(po['createdAt'] || new Date().toISOString())
          ];
          if (poCols.includes('invoice_id')) {
            cols.push('invoice_id');
            vals.push((po['invoiceId'] as string) || null);
          }
          if (poCols.includes('qr_code')) {
            cols.push('qr_code');
            vals.push((po['qrCode'] as string) || null);
          }
          if (hasMethod) {
            cols.push('method');
            vals.push(methodVal);
          }
          if (hasPaymentMethod) {
            cols.push('payment_method');
            vals.push(methodVal);
          }
          if (hasQrCodeCopy) {
            cols.push('qr_code_copy_paste');
            vals.push(qrCopyVal);
          }
          if (hasPixCopia) {
            cols.push('pix_copia_e_cola');
            vals.push(qrCopyVal);
          }
          if (hasGatewayRef) {
            cols.push('gateway_reference');
            vals.push((po['gatewayReference'] as string) || null);
          }
          if (hasConfirmedAt) {
            cols.push('confirmed_at');
            vals.push((po['confirmedAt'] as string) || null);
          }
          if (hasExpiresAt) {
            cols.push('expires_at');
            vals.push(String(po['expiresAt'] || po['confirmedAt'] || new Date(Date.now() + 86400000).toISOString()));
          }

          const ph = cols.map(() => '?').join(', ');
          const updateAssignments = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');
          this.db.prepare(`
            INSERT INTO payment_orders (${cols.join(', ')}) VALUES (${ph})
            ON CONFLICT(id) DO UPDATE SET ${updateAssignments}
          `).run(...vals);
        }
      }

      // Company Ledger (Strictly Append-only on id)
      if (state.companyLedger) {
        const insertLedger = this.db.prepare(`
          INSERT INTO company_ledger (
            id, company_id, type, amount, previous_balance, new_balance, description, reference_id, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING
        `);
        for (const [companyId, entries] of state.companyLedger.entries()) {
          if (!state.companies.has(companyId)) continue;
          if (Array.isArray(entries)) {
            for (const rawEntry of entries) {
              const entry = rawEntry as Record<string, unknown>;
              insertLedger.run(
                String(entry['id']),
                companyId,
                String(entry['type'] || 'CREDIT_ADDED'),
                Number(entry['amount'] || 0),
                Number(entry['previousBalance'] || 0),
                Number(entry['newBalance'] || 0),
                String(entry['description'] || ''),
                (entry['referenceId'] as string) || null,
                String(entry['timestamp'] || new Date().toISOString())
              );
            }
          }
        }
      }

      // HQ Audit Logs (Strictly append-only using normal INSERT with ON CONFLICT DO NOTHING to preserve historical integrity)
      if (state.hqAuditLogs && Array.isArray(state.hqAuditLogs)) {
        const insertLog = this.db.prepare(`
          INSERT INTO hq_audit_logs (
            id, timestamp, admin_id, admin_name, action, target_tenant_id, target_tenant_name, details, ip_address
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING
        `);
        for (const rawLog of state.hqAuditLogs) {
          const l = rawLog as Record<string, unknown>;
          insertLog.run(
            String(l['id']),
            String(l['timestamp'] || new Date().toISOString()),
            String(l['adminId'] || ''),
            String(l['adminName'] || ''),
            String(l['action'] || ''),
            (l['targetTenantId'] as string) || null,
            (l['targetTenantName'] as string) || null,
            typeof l['details'] === 'object' ? JSON.stringify(l['details']) : String(l['details'] || ''),
            (l['ipAddress'] as string) || null
          );
        }
      }

      // Delete records removed from memory (full state reconciliation - ONLY executed when fullReconciliation is true)
      if (fullReconciliation) {
        const compIds = Array.from(state.companies.keys());
        if (compIds.length > 0) {
          const ph = compIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM companies WHERE id NOT IN (${ph})`).run(...compIds);
        } else {
          this.db.prepare('DELETE FROM companies').run();
        }

        const prodIds = Array.from(state.products.keys());
        if (prodIds.length > 0) {
          const ph = prodIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM products WHERE id NOT IN (${ph})`).run(...prodIds);
        } else {
          this.db.prepare('DELETE FROM products').run();
        }

        const custIds = Array.from(state.customers.keys());
        if (custIds.length > 0) {
          const ph = custIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM customers WHERE id NOT IN (${ph})`).run(...custIds);
        } else {
          this.db.prepare('DELETE FROM customers').run();
        }

        const tableIds = Array.from(state.tables.keys());
        if (tableIds.length > 0) {
          const ph = tableIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM tables_registry WHERE id NOT IN (${ph})`).run(...tableIds);
        } else {
          this.db.prepare('DELETE FROM tables_registry').run();
        }

        const salesIds = Array.from(state.sales.keys());
        if (salesIds.length > 0) {
          const ph = salesIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM sales WHERE id NOT IN (${ph})`).run(...salesIds);
        } else {
          this.db.prepare('DELETE FROM sales').run();
        }

        const finIds = Array.from(state.financeTransactions.keys());
        if (finIds.length > 0) {
          const ph = finIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM finance_transactions WHERE id NOT IN (${ph})`).run(...finIds);
        } else {
          this.db.prepare('DELETE FROM finance_transactions').run();
        }

        const psIds = Array.from(state.publicSpaces.keys());
        if (psIds.length > 0) {
          const ph = psIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM public_spaces WHERE company_id NOT IN (${ph})`).run(...psIds);
        } else {
          this.db.prepare('DELETE FROM public_spaces').run();
        }

        const devIds = Array.from(state.devices.keys());
        if (devIds.length > 0) {
          const ph = devIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM devices WHERE device_id NOT IN (${ph})`).run(...devIds);
        } else {
          this.db.prepare('DELETE FROM devices').run();
        }

        const entIds = Array.from(state.appEntitlements.entries()).map(([key, rawEnt]) => {
          const ent = rawEnt as Record<string, unknown>;
          return String(ent['id'] || key);
        }).filter(Boolean);

        if (entIds.length > 0) {
          const ph = entIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM app_entitlements WHERE id NOT IN (${ph})`).run(...entIds);
        } else {
          this.db.prepare('DELETE FROM app_entitlements').run();
        }

        if (state.appInstallations) {
          const instIds = Array.from(state.appInstallations.entries()).map(([key, rawInst]) => {
            const inst = rawInst as Record<string, unknown>;
            return String(inst['id'] || key);
          }).filter(Boolean);

          if (instIds.length > 0) {
            const ph = instIds.map(() => '?').join(',');
            this.db.prepare(`DELETE FROM app_installations WHERE id NOT IN (${ph})`).run(...instIds);
          } else {
            this.db.prepare('DELETE FROM app_installations').run();
          }
        }

        if (state.paymentOrders) {
          const poIds = Array.from(state.paymentOrders.keys());
          if (poIds.length > 0) {
            const ph = poIds.map(() => '?').join(',');
            this.db.prepare(`DELETE FROM payment_orders WHERE id NOT IN (${ph})`).run(...poIds);
          } else {
            this.db.prepare('DELETE FROM payment_orders').run();
          }
        }

        if (state.orders) {
          const ordIds = Array.from(state.orders.keys());
          if (ordIds.length > 0) {
            const ph = ordIds.map(() => '?').join(',');
            this.db.prepare(`DELETE FROM orders WHERE id NOT IN (${ph})`).run(...ordIds);
          } else {
            this.db.prepare('DELETE FROM orders').run();
          }
        }
      }

      this.db.exec('COMMIT;');
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // Ignored if rollback fails or already rolled back
      }
      console.error('[CentralDatabaseEngine] Error persisting state to SQLite:', err);
      throw err;
    }
  }

  public loadFromDatabase(): {
    plans?: Record<string, unknown>[];
    hqAdmins?: Record<string, unknown>[];
    companies?: [string, Record<string, unknown>][];
    companyUsers?: [string, Record<string, unknown>[]][];
    products?: [string, Record<string, unknown>][];
    sales?: [string, Record<string, unknown>][];
    customers?: [string, Record<string, unknown>][];
    tables?: [string, Record<string, unknown>][];
    financeTransactions?: [string, Record<string, unknown>][];
    publicSpaces?: [string, Record<string, unknown>][];
    orders?: [string, Record<string, unknown>][];
    telemetry?: [string, Record<string, unknown>][];
    processedWebhookEvents?: string[];
    osReleases?: Record<string, unknown>[];
    apps?: Record<string, unknown>[];
    billingIdempotencyLog?: [string, string][];
    devices?: [string, Record<string, unknown>][];
    invoices?: [string, Record<string, unknown>[]][];
    appEntitlements?: [string, Record<string, unknown>][];
    appInstallations?: [string, Record<string, unknown>][];
    paymentOrders?: [string, Record<string, unknown>][];
    companyLedger?: [string, Record<string, unknown>[]][];
    hqAuditLogs?: Record<string, unknown>[];
  } | null {
    if (!this.db || !this.hasData()) return null;

    try {
      const plansRows = this.db.prepare('SELECT * FROM plans').all() as Record<string, unknown>[];
      const plans = plansRows.map(row => ({
        id: row['id'],
        name: row['name'],
        monthlyPrice: Number(row['monthly_price'] ?? row['price'] ?? 0),
        maxTerminals: Number(row['max_terminals'] || 1),
        maxBranches: Number(row['max_branches'] || 1),
        description: row['description'],
        includedApps: JSON.parse((row['included_apps'] as string) || '[]'),
        features: JSON.parse((row['features'] as string) || '[]')
      }));

      const hqAdminsRows = this.db.prepare('SELECT * FROM hq_admins').all() as Record<string, unknown>[];
      const hqAdmins = hqAdminsRows.map(row => ({
        id: row['id'],
        name: row['name'],
        email: row['email'],
        role: row['role'],
        password: row['password'],
        mfaEnabled: !!row['mfa_enabled'],
        mfaSecret: row['mfa_secret'] ? decryptMfaSecret(String(row['mfa_secret'])) : null
      }));

      const activeInstRows = this.db.prepare(
        "SELECT company_id, app_id FROM app_installations WHERE status = 'INSTALLED'"
      ).all() as Record<string, unknown>[];
      const activeTenantAppsMap = new Map<string, Set<string>>();
      for (const inst of activeInstRows) {
        const cId = String(inst['company_id']);
        const aId = String(inst['app_id']);
        if (!activeTenantAppsMap.has(cId)) {
          activeTenantAppsMap.set(cId, new Set<string>());
        }
        activeTenantAppsMap.get(cId)!.add(aId);
      }

      const companiesRows = this.db.prepare('SELECT * FROM companies').all() as Record<string, unknown>[];
      const companies: [string, Record<string, unknown>][] = companiesRows.map(row => {
        const compId = String(row['id']);
        const baseApps: string[] = JSON.parse((row['installed_apps'] as string) || '[]');
        const activeInstSet = activeTenantAppsMap.get(compId);
        if (activeInstSet) {
          for (const a of activeInstSet) {
            if (!baseApps.includes(a)) baseApps.push(a);
          }
        }
        return [
          compId,
          {
            id: row['id'],
            name: row['name'],
            slug: row['slug'],
            cnpj: row['cnpj'],
            logoUrl: row['logo_url'],
            balance: Number(row['balance']),
            installedApps: baseApps,
            status: row['status'],
            plan: row['plan'],
            maxTerminals: row['max_terminals'],
            maxBranches: row['max_branches'],
            activeTerminals: row['active_terminals'],
            channel: row['channel'],
            osTargetVersion: row['os_target_version'],
            licenseExpiresAt: row['license_expires_at'],
            branches: JSON.parse((row['branches'] as string) || '[]'),
            allowNegativeStock: !!row['allow_negative_stock'],
            isDemo: !!row['is_demo']
          }
        ];
      });

      const usersRows = this.db.prepare('SELECT * FROM company_users').all() as Record<string, unknown>[];
      const usersMap = new Map<string, Record<string, unknown>[]>();
      for (const row of usersRows) {
        const compId = String(row['company_id']);
        const list = usersMap.get(compId) || [];
        const rawBranchIds = row['branch_ids'];
        let branchIds: string[] = [];
        if (typeof rawBranchIds === 'string' && rawBranchIds.trim().startsWith('[')) {
          try {
            branchIds = JSON.parse(rawBranchIds);
          } catch {
            branchIds = row['branch_id'] ? [String(row['branch_id'])] : [];
          }
        } else if (row['branch_id']) {
          branchIds = [String(row['branch_id'])];
        }

        list.push({
          id: row['id'],
          companyId: compId,
          branchId: row['branch_id'] || (branchIds.length > 0 ? branchIds[0] : null),
          branchIds,
          name: row['name'],
          email: row['email'],
          role: row['role'],
          password: row['password'],
          pin: row['pin'],
          active: !!row['active'],
          lastLogin: row['last_login']
        });
        usersMap.set(compId, list);
      }

      const productsRows = this.db.prepare('SELECT * FROM products').all() as Record<string, unknown>[];
      const products: [string, Record<string, unknown>][] = productsRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          name: row['name'],
          price: Number(row['price']),
          stock: Number(row['stock'])
        }
      ]);

      const salesRows = this.db.prepare('SELECT * FROM sales').all() as Record<string, unknown>[];
      const sales: [string, Record<string, unknown>][] = salesRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          items: JSON.parse((row['items'] as string) || '[]'),
          total: Number(row['total']),
          timestamp: row['timestamp'],
          paymentMethod: row['payment_method'],
          operator: row['operator']
        }
      ]);

      const customersRows = this.db.prepare('SELECT * FROM customers').all() as Record<string, unknown>[];
      const customers: [string, Record<string, unknown>][] = customersRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          name: row['name'],
          phone: row['phone'],
          email: row['email'],
          points: Number(row['points']),
          totalSpent: Number(row['total_spent']),
          tier: row['tier'],
          createdAt: row['created_at']
        }
      ]);

      const tablesRows = this.db.prepare('SELECT * FROM tables_registry').all() as Record<string, unknown>[];
      const tables: [string, Record<string, unknown>][] = tablesRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          number: Number(row['number']),
          name: row['name'],
          capacity: Number(row['capacity']),
          status: row['status'],
          currentOrder: row['current_order'] ? JSON.parse(row['current_order'] as string) : undefined
        }
      ]);

      const financeRows = this.db.prepare('SELECT * FROM finance_transactions').all() as Record<string, unknown>[];
      const financeTransactions: [string, Record<string, unknown>][] = financeRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          type: row['type'],
          category: row['category'],
          description: row['description'],
          amount: Number(row['amount']),
          paymentMethod: row['payment_method'],
          timestamp: row['timestamp'],
          operator: row['operator'],
          referenceId: row['reference_id']
        }
      ]);

      const psRows = this.db.prepare('SELECT * FROM public_spaces').all() as Record<string, unknown>[];
      const publicSpaces: [string, Record<string, unknown>][] = psRows.map(row => [
        String(row['company_id']),
        {
          companyId: row['company_id'],
          companySlug: row['company_slug'],
          title: row['title'],
          description: row['description'],
          logo: row['logo'],
          templateId: row['template_id'],
          themeColor: row['theme_color'],
          status: row['status'],
          publishedAt: row['published_at'],
          phone: row['phone'],
          email: row['email'],
          address: row['address'],
          hours: row['hours'],
          products: JSON.parse((row['products'] as string) || '[]')
        }
      ]);

      const ordersRows = this.db.prepare('SELECT * FROM orders').all() as Record<string, unknown>[];
      const orders: [string, Record<string, unknown>][] = ordersRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          publicTrackingToken: row['public_tracking_token'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          companyName: row['company_name'],
          customerName: row['customer_name'],
          customerPhone: row['customer_phone'],
          customerAddress: row['customer_address'],
          items: JSON.parse((row['items'] as string) || '[]'),
          total: Number(row['total']),
          notes: row['notes'],
          paymentMethod: row['payment_method'],
          status: row['status'],
          channel: row['channel'],
          createdAt: row['created_at'],
          updatedAt: row['updated_at']
        }
      ]);

      const telemetryRows = this.db.prepare('SELECT * FROM telemetry').all() as Record<string, unknown>[];
      const telemetry: [string, Record<string, unknown>][] = telemetryRows.map(row => [
        String(row['id'] || `${row['company_id']}:${row['device_id'] || 'default'}`),
        {
          id: row['id'] || `${row['company_id']}:${row['device_id'] || 'default'}`,
          companyId: row['company_id'],
          companyName: row['company_name'],
          deviceId: row['device_id'],
          timestamp: row['timestamp'],
          overallStatus: row['overall_status'],
          clientReportedStatus: row['client_reported_status'],
          centralCalculatedHealth: row['central_calculated_health'],
          checks: JSON.parse((row['checks'] as string) || '[]'),
          platform: row['platform'],
          version: row['version']
        }
      ]);

      const processedWebhookRows = this.db.prepare('SELECT event_id FROM processed_webhook_events').all() as Record<string, unknown>[];
      const processedWebhookEvents = processedWebhookRows.map(r => String(r['event_id']));

      const osReleasesRows = this.db.prepare('SELECT * FROM os_releases').all() as Record<string, unknown>[];
      const osReleases = osReleasesRows.map(row => {
        const v = String(row['version']);
        const ch = (row['channel'] as string) === 'beta' ? 'beta' : 'stable';
        const cl = String(row['changelog'] || row['release_notes'] || '');
        const cs = (row['checksum'] as string) || createHash('sha256').update(`${v}_${ch}_${cl}`).digest('hex');
        const notes = cl.includes('\n') ? cl.split('\n').filter(Boolean) : [cl].filter(Boolean);
        const rd = String(row['release_date'] || row['published_at'] || new Date().toISOString());
        return {
          id: (row['id'] as string) || `rel_${v.replace(/[^a-zA-Z0-9]/g, '_')}`,
          version: v,
          channel: ch as 'stable' | 'beta',
          releaseDate: rd,
          status: (row['status'] as 'active' | 'deprecated' | 'canary') || 'active',
          changelog: cl,
          minRequiredByApps: String(row['min_required_by_apps'] || '1.0.0'),
          mandatory: Boolean(row['mandatory']),
          checksum: cs,
          releaseNotes: notes,
          publishedAt: rd,
          releaseChannel: ch as 'stable' | 'beta'
        };
      });

      const appsRows = this.db.prepare('SELECT * FROM app_catalog').all() as Record<string, unknown>[];
      const apps = appsRows.map(row => ({
        id: row['id'],
        name: row['name'],
        description: row['description'],
        developer: row['developer'],
        publisher: row['publisher'],
        category: row['category'],
        icon: row['icon'],
        pricing: JSON.parse((row['pricing'] as string) || '{}'),
        lifecycle: JSON.parse((row['lifecycle'] as string) || '{}'),
        currentRelease: row['current_release'] ? JSON.parse(row['current_release'] as string) : undefined,
        permissions: JSON.parse((row['permissions'] as string) || '[]'),
        capabilities: JSON.parse((row['capabilities'] as string) || '[]'),
        dependencies: JSON.parse((row['dependencies'] as string) || '[]'),
        isSystemApp: !!row['is_system_app']
      }));

      const billLogRows = this.db.prepare('SELECT * FROM billing_idempotency_log').all() as Record<string, unknown>[];
      const billingIdempotencyLog: [string, string][] = billLogRows.map(row => [
        String(row['key']),
        String(row['invoice_id'])
      ]);

      const devRows = this.db.prepare('SELECT * FROM devices').all() as Record<string, unknown>[];
      const devices: [string, Record<string, unknown>][] = devRows.map(row => [
        String(row['device_id']),
        {
          deviceId: String(row['device_id']),
          companyId: String(row['company_id']),
          branchId: (row['branch_id'] as string) || null,
          name: String(row['name'] || ''),
          platform: String(row['platform'] || 'web'),
          osVersion: String(row['os_version'] || '1.4.3'),
          fingerprintHash: (row['fingerprint_hash'] as string) || null,
          installationId: (row['installation_id'] as string) || null,
          hardwareId: (row['hardware_id'] as string) || null,
          status: String(row['status'] || 'active'),
          registeredAt: String(row['registered_at'] || new Date().toISOString()),
          lastSeenAt: (row['last_seen_at'] as string) || null,
          ipAddress: (row['ip_address'] as string) || null
        }
      ]);

      const invRows = this.db.prepare('SELECT * FROM invoices').all() as Record<string, unknown>[];
      const invoicesMap = new Map<string, Record<string, unknown>[]>();
      for (const row of invRows) {
        const compId = String(row['company_id']);
        const list = invoicesMap.get(compId) || [];
        list.push({
          id: row['id'],
          invoiceNumber: row['invoice_number'],
          companyId: compId,
          companyName: row['company_name'],
          billingPeriod: row['billing_period'],
          issueDate: row['issue_date'],
          dueDate: row['due_date'],
          paidAt: row['paid_at'],
          status: row['status'],
          subtotal: Number(row['subtotal'] || 0),
          discount: Number(row['discount'] || 0),
          totalAmount: Number(row['total_amount'] || row['amount'] || 0),
          items: JSON.parse((row['items'] as string) || '[]')
        });
        invoicesMap.set(compId, list);
      }

      const entRows = this.db.prepare('SELECT * FROM app_entitlements').all() as Record<string, unknown>[];
      const appEntitlements: [string, Record<string, unknown>][] = entRows.map(row => {
        const companyId = String(row['company_id'] || '');
        const appId = String(row['app_id'] || '');
        const key = `${companyId}:${appId}`;
        return [
          key,
          {
            id: row['id'] || key,
            companyId,
            appId,
            status: row['status'],
            pricingModel: row['pricing_model'],
            amount: Number(row['amount'] || 0),
            currency: row['currency'] || 'BRL',
            createdAt: row['created_at'],
            expiresAt: row['expires_at'],
            licenseKey: row['license_key']
          }
        ];
      });

      const instRows = this.db.prepare('SELECT * FROM app_installations').all() as Record<string, unknown>[];
      const appInstallations: [string, Record<string, unknown>][] = instRows.map(row => {
        const companyId = String(row['company_id'] || '');
        const deviceId = row['device_id'] ? String(row['device_id']) : '';
        const appId = String(row['app_id'] || '');
        const key = deviceId ? `${companyId}:${deviceId}:${appId}` : `${companyId}:${appId}`;
        return [
          key,
          {
            id: row['id'] || key,
            companyId,
            deviceId: row['device_id'] || null,
            appId,
            installedVersion: row['installed_version'],
            status: row['status'],
            installedAt: row['installed_at'],
            updatedAt: row['updated_at']
          }
        ];
      });

      const poRows = this.db.prepare('SELECT * FROM payment_orders').all() as Record<string, unknown>[];
      const paymentOrders: [string, Record<string, unknown>][] = poRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          invoiceId: row['invoice_id'],
          companyId: row['company_id'],
          paymentMethod: row['payment_method'] ?? row['method'] ?? 'PIX',
          gatewayReference: row['gateway_reference'],
          qrCode: row['qr_code'],
          qrCodeCopyPaste: row['qr_code_copy_paste'] ?? row['pix_copia_e_cola'] ?? null,
          status: row['status'],
          amount: Number(row['amount']),
          createdAt: row['created_at'],
          confirmedAt: row['confirmed_at'] ?? row['paid_at'] ?? null
        }
      ]);

      const ledgerRows = this.db.prepare('SELECT * FROM company_ledger').all() as Record<string, unknown>[];
      const ledgerMap = new Map<string, Record<string, unknown>[]>();
      for (const row of ledgerRows) {
        const compId = String(row['company_id']);
        const list = ledgerMap.get(compId) || [];
        list.push({
          id: row['id'],
          companyId: compId,
          type: row['type'],
          amount: Number(row['amount']),
          previousBalance: Number(row['previous_balance']),
          newBalance: Number(row['new_balance']),
          description: row['description'],
          referenceId: row['reference_id'],
          timestamp: row['timestamp']
        });
        ledgerMap.set(compId, list);
      }

      const auditRows = this.db.prepare('SELECT * FROM hq_audit_logs ORDER BY timestamp DESC LIMIT 500').all() as Record<string, unknown>[];
      const hqAuditLogs = auditRows.map(row => ({
        id: row['id'],
        timestamp: row['timestamp'],
        adminId: row['admin_id'],
        adminName: row['admin_name'],
        action: row['action'],
        targetTenantId: row['target_tenant_id'],
        targetTenantName: row['target_tenant_name'],
        details: typeof row['details'] === 'string' && (row['details'].startsWith('{') || row['details'].startsWith('[')) ? JSON.parse(row['details']) : row['details'],
        ipAddress: row['ip_address']
      }));

      return {
        plans,
        hqAdmins,
        companies,
        companyUsers: Array.from(usersMap.entries()),
        products,
        sales,
        customers,
        tables,
        financeTransactions,
        publicSpaces,
        orders,
        telemetry,
        processedWebhookEvents,
        osReleases,
        apps,
        billingIdempotencyLog,
        devices,
        invoices: Array.from(invoicesMap.entries()),
        appEntitlements,
        appInstallations,
        paymentOrders,
        companyLedger: Array.from(ledgerMap.entries()),
        hqAuditLogs
      };
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error reading from SQLite database:', err);
      return null;
    }
  }

  public runInTransaction<T>(fn: () => T): T {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // ignore
      }
      throw err;
    }
  }

  public checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
    if (!this.db) return false; // Fallback if not initialized

    const now = Date.now();
    try {
      return this.runInTransaction(() => {
        const row = this.db!.prepare("SELECT count, reset_time FROM rate_limits WHERE key = ?").get(key) as { count: number, reset_time: number } | undefined;
        
        if (!row || now > row.reset_time) {
          const resetTime = now + windowMs;
          this.db!.prepare("INSERT OR REPLACE INTO rate_limits (key, count, reset_time) VALUES (?, 1, ?)")
            .run(key, resetTime);
          return true;
        }

        if (row.count >= maxAttempts) {
          return false;
        }

        this.db!.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?")
          .run(key);
        return true;
      });
    } catch (err) {
      console.error('[CentralDatabaseEngine] Rate limiting check error (fail-closed):', err);
      return false; // fail closed for security to prevent brute force under database locks
    }
  }

  public provisionCompanyTransaction(
    company: any,
    adminUser: any,
    trialDays: number,
    businessSegment: string
  ): {
    success: boolean;
    code: number;
    message: string;
    data?: {
      company: any;
      adminUser: any;
      ledgerEntry: any;
    };
  } {
    if (!this.db) {
      return { success: false, code: 500, message: 'Database not initialized' };
    }

    return this.runInTransaction(() => {
      // 1. Uniqueness check for Company Name (case-insensitive)
      const existingCompany = this.db!.prepare('SELECT 1 FROM companies WHERE LOWER(name) = ?').get(company.name.toLowerCase());
      if (existingCompany) {
        return { success: false, code: 409, message: 'Já existe uma empresa registrada com este nome corporativo.' };
      }

      // 2. Uniqueness check for Admin User Email (case-insensitive)
      const existingUser = this.db!.prepare('SELECT 1 FROM company_users WHERE LOWER(email) = ?').get(adminUser.email.toLowerCase());
      if (existingUser) {
        return { success: false, code: 409, message: 'Este e-mail já está cadastrado em um workspace corporativo.' };
      }

      // 3. Insert Company
      const companyStmt = this.db!.prepare(`
        INSERT INTO companies (
          id, name, balance, installed_apps, status, plan, max_terminals, max_branches, active_terminals, channel, os_target_version, license_expires_at, branches
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      companyStmt.run(
        company.id,
        company.name,
        company.balance,
        JSON.stringify(company.installedApps || []),
        company.status,
        company.plan,
        company.maxTerminals,
        company.maxBranches || 1,
        company.activeTerminals,
        company.channel,
        company.osTargetVersion,
        company.licenseExpiresAt,
        JSON.stringify(company.branches || [])
      );

      // 4. Insert Company User
      const userStmt = this.db!.prepare(`
        INSERT INTO company_users (
          id, company_id, branch_id, name, email, role, password, pin, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      userStmt.run(
        adminUser.id,
        adminUser.companyId,
        adminUser.branchId || null,
        adminUser.name,
        adminUser.email,
        adminUser.role,
        adminUser.password,
        adminUser.pin || null,
        adminUser.active ?? 1
      );

      // 5. Create initial Ledger entry
      const ledgerId = `ldg_${company.id}_trial`;
      const timestamp = new Date().toISOString();
      const ledgerStmt = this.db!.prepare(`
        INSERT INTO company_ledger (
          id, company_id, type, amount, previous_balance, new_balance, description, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const ledgerDescription = trialDays > 0
        ? `Ativação de Trial Comercial (${trialDays} dias - Plano ${company.plan.toUpperCase()} - Segmento: ${businessSegment})`
        : `Ativação de Assinatura Comercial (Plano ${company.plan.toUpperCase()} - Provisionamento Direto)`;

      ledgerStmt.run(
        ledgerId,
        company.id,
        'PLAN_CHARGE',
        0,
        0,
        0,
        ledgerDescription,
        timestamp
      );

      const ledgerEntry = {
        id: ledgerId,
        companyId: company.id,
        type: 'PLAN_CHARGE',
        amount: 0,
        previousBalance: 0,
        newBalance: 0,
        description: ledgerDescription,
        timestamp
      };

      return {
        success: true,
        code: 201,
        message: 'Workspace corporativo criado com sucesso!',
        data: {
          company,
          adminUser,
          ledgerEntry
        }
      };
    });
  }

  public insertAuditLog(log: any) {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO hq_audit_logs (
        id, timestamp, admin_id, admin_name, action, target_tenant_id, target_tenant_name, details, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      String(log.id),
      String(log.timestamp),
      String(log.adminId || log.hqAdminId || ''),
      String(log.adminName || log.hqAdminEmail || ''),
      String(log.action || ''),
      log.targetTenantId || log.targetCompanyId || null,
      log.targetTenantName || null,
      typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || ''),
      log.ipAddress || null
    );
  }

  public confirmPaymentOrderTransaction(
    companyId: string,
    paymentOrderId: string,
    eventId?: string
  ): {
    success: boolean;
    code: number;
    message: string;
    data?: {
      company: any;
      paymentOrder: any;
      invoice: any;
      ledgerEntries: any[];
    };
  } {
    if (!this.db) {
      return { success: false, code: 500, message: 'Database not initialized' };
    }

    return this.runInTransaction(() => {
      // 1. Replay protection inside the same transaction
      if (eventId) {
        const alreadyProcessed = this.db!.prepare('SELECT 1 FROM processed_webhook_events WHERE event_id = ?').get(eventId);
        if (alreadyProcessed) {
          return { success: false, code: 409, message: 'Evento de webhook já processado anteriormente.' };
        }
        // Save webhook event to DB (locked immediately)
        this.db!.prepare('INSERT INTO processed_webhook_events (event_id, processed_at) VALUES (?, ?)')
          .run(eventId, new Date().toISOString());
      }

      // 2. Select the payment order
      const poRow = this.db!.prepare('SELECT * FROM payment_orders WHERE id = ? AND company_id = ?').get(paymentOrderId, companyId) as any;
      if (!poRow) {
        return { success: false, code: 404, message: 'Ordem de pagamento não encontrada.' };
      }

      const invoiceId = poRow.invoice_id;
      const orderAmount = Number(poRow.amount);
      const currentPoStatus = poRow.status;

      if (currentPoStatus === 'CONFIRMED') {
        return { success: false, code: 400, message: 'Esta ordem de pagamento já foi confirmada.' };
      }
      if (currentPoStatus === 'CANCELLED' || currentPoStatus === 'DUPLICATE_REJECTED') {
        return { success: false, code: 400, message: 'Esta ordem de pagamento foi cancelada ou rejeitada.' };
      }

      // 3. Select the invoice
      const invoiceRow = this.db!.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(invoiceId, companyId) as any;
      if (!invoiceRow) {
        return { success: false, code: 404, message: 'Fatura não encontrada.' };
      }

      const currentInvoiceStatus = invoiceRow.status;

      // 4. Double-credit protection
      if (currentInvoiceStatus === 'PAID') {
        // Rejects double credit atomically
        this.db!.prepare('UPDATE payment_orders SET status = ?, confirmed_at = ? WHERE id = ?')
          .run('DUPLICATE_REJECTED', new Date().toISOString(), paymentOrderId);
        return { success: false, code: 409, message: 'Fatura já está paga. Ordem rejeitada para evitar crédito duplo.' };
      }

      // 5. Select company to verify balance & license
      const companyRow = this.db!.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      if (!companyRow) {
        return { success: false, code: 404, message: 'Empresa não encontrada.' };
      }

      const previousBalance = Number(companyRow.balance || 0);
      const intermediateBalance = previousBalance + orderAmount;

      // 6. Confirm this payment order
      const confirmedAt = new Date().toISOString();
      this.db!.prepare('UPDATE payment_orders SET status = ?, confirmed_at = ? WHERE id = ?')
        .run('CONFIRMED', confirmedAt, paymentOrderId);

      // 7. Cancel other pending orders for the same invoice
      this.db!.prepare("UPDATE payment_orders SET status = 'CANCELLED' WHERE invoice_id = ? AND id != ? AND status = 'PENDING'")
        .run(invoiceId, paymentOrderId);

      // 8. Credit ledger entry
      const ledgerEntries: any[] = [];
      const creditLedgerId = `led_dep_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
      const timestamp = new Date().toISOString();
      this.db!.prepare(`
        INSERT INTO company_ledger (
          id, company_id, type, amount, previous_balance, new_balance, description, timestamp, reference_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        creditLedgerId,
        companyId,
        'CREDIT_ADDED',
        orderAmount,
        previousBalance,
        intermediateBalance,
        `Crédito de R$ ${orderAmount.toFixed(2)} adicionado via PIX/Gateway (Ordem: ${paymentOrderId})`,
        timestamp,
        paymentOrderId
      );
      ledgerEntries.push({
        id: creditLedgerId,
        companyId,
        type: 'CREDIT_ADDED',
        amount: orderAmount,
        previousBalance,
        newBalance: intermediateBalance,
        description: `Crédito de R$ ${orderAmount.toFixed(2)} adicionado via PIX/Gateway (Ordem: ${paymentOrderId})`,
        timestamp,
        referenceId: paymentOrderId
      });

      // 9. Debit ledger entry & Invoice settlement
      const finalBalance = intermediateBalance - orderAmount;
      const debitLedgerId = `led_plan_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
      this.db!.prepare(`
        INSERT INTO company_ledger (
          id, company_id, type, amount, previous_balance, new_balance, description, timestamp, reference_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        debitLedgerId,
        companyId,
        'PLAN_CHARGE',
        orderAmount,
        intermediateBalance,
        finalBalance,
        `Cobrança de Fatura ${invoiceRow.invoice_number} - Liquidação automática`,
        timestamp,
        invoiceId
      );
      ledgerEntries.push({
        id: debitLedgerId,
        companyId,
        type: 'PLAN_CHARGE',
        amount: orderAmount,
        previousBalance: intermediateBalance,
        newBalance: finalBalance,
        description: `Cobrança de Fatura ${invoiceRow.invoice_number} - Liquidação automática`,
        timestamp,
        referenceId: invoiceId
      });

      // Update invoice status to PAID
      this.db!.prepare('UPDATE invoices SET status = ?, paid_at = ? WHERE id = ?')
        .run('PAID', confirmedAt, invoiceId);

      // Calculate new license expiry: base is max of current expiry or today, plus 30 days
      const currentExpiryStr = companyRow.license_expires_at;
      const baseDate = currentExpiryStr && new Date(currentExpiryStr).getTime() > Date.now()
        ? new Date(currentExpiryStr)
        : new Date();
      const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 3600 * 1000);
      const newExpiryStr = newExpiry.toISOString().split('T')[0];

      // Update company balance and license
      this.db!.prepare("UPDATE companies SET balance = ?, license_expires_at = ?, status = 'active' WHERE id = ?")
        .run(finalBalance, newExpiryStr, companyId);

      // Fetch newly updated states to return
      const updatedCompany = {
        ...companyRow,
        balance: finalBalance,
        license_expires_at: newExpiryStr,
        status: 'active'
      };

      const updatedPo = {
        ...poRow,
        status: 'CONFIRMED',
        confirmed_at: confirmedAt
      };

      const updatedInvoice = {
        ...invoiceRow,
        status: 'PAID',
        paid_at: confirmedAt
      };

      return {
        success: true,
        code: 200,
        message: 'Pagamento confirmado e fatura liquidada com sucesso.',
        data: {
          company: updatedCompany,
          paymentOrder: updatedPo,
          invoice: updatedInvoice,
          ledgerEntries
        }
      };
    });
  }

  public runSingleCompanyBillingTransaction(
    companyId: string,
    currentPeriod: string,
    todayIso: string,
    dueDateIso: string
  ): {
    success: boolean;
    skipped: boolean;
    report?: any;
  } {
    if (!this.db) {
      return { success: false, skipped: false };
    }

    return this.runInTransaction(() => {
      const idempotencyKey = `${currentPeriod}_${companyId}`;
      const alreadyProcessed = this.db!.prepare('SELECT 1 FROM billing_idempotency_log WHERE key = ?').get(idempotencyKey);
      if (alreadyProcessed) {
        return { success: true, skipped: true };
      }

      // Select company
      const companyRow = this.db!.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      if (!companyRow) {
        return { success: false, skipped: false };
      }

      // Find plan details
      const planId = companyRow.plan || 'starter';
      const planRow = this.db!.prepare('SELECT * FROM plans WHERE id = ?').get(planId) as any;
      
      // Defensively parse and compute the plan price using both raw snake_case and mapped camelCase keys, avoiding NaN
      let planPrice = 99;
      if (planRow) {
        const rawVal = planRow.monthly_price ?? planRow.price ?? planRow.monthlyPrice;
        if (rawVal !== undefined && rawVal !== null) {
          const num = Number(rawVal);
          if (!isNaN(num) && isFinite(num) && num >= 0) {
            planPrice = num;
          }
        }
      } else {
        if (planId === 'pro') planPrice = 249;
        else if (planId === 'enterprise') planPrice = 599;
        else planPrice = 99;
      }
      
      const invoiceItems: any[] = [
        {
          description: `Assinatura Plano ${planId.toUpperCase()} (${currentPeriod})`,
          amount: planPrice,
          type: 'PLAN'
        }
      ];

      // Parse installed apps from companyRow
      let installedApps: string[] = [];
      const rawInstalled = companyRow.installed_apps ?? companyRow.installedApps;
      if (Array.isArray(rawInstalled)) {
        installedApps = rawInstalled;
      } else if (typeof rawInstalled === 'string') {
        try {
          const parsed = JSON.parse(rawInstalled);
          if (Array.isArray(parsed)) installedApps = parsed;
        } catch {
          installedApps = [];
        }
      }

      // Included apps from plan (supporting both snake_case and camelCase)
      let includedAppsList: string[] = [];
      if (planRow) {
        const rawApps = planRow.included_apps ?? planRow.includedApps;
        if (Array.isArray(rawApps)) {
          includedAppsList = rawApps;
        } else if (typeof rawApps === 'string') {
          try {
            const parsed = JSON.parse(rawApps);
            if (Array.isArray(parsed)) includedAppsList = parsed;
          } catch {
            includedAppsList = [];
          }
        }
      }
      const includedApps = new Set(includedAppsList);

      let extraAppsCost = 0;
      for (const appId of installedApps) {
        if (!includedApps.has(appId)) {
          const appRow = this.db!.prepare('SELECT * FROM app_catalog WHERE id = ?').get(appId) as any;
          if (appRow) {
            let appPricing: any = {};
            if (typeof appRow.pricing === 'string') {
              try {
                appPricing = JSON.parse(appRow.pricing || '{}');
              } catch {
                appPricing = {};
              }
            } else if (typeof appRow.pricing === 'object' && appRow.pricing !== null) {
              appPricing = appRow.pricing;
            }
            let appAmount = Number(appPricing.amount || 0);
            if (isNaN(appAmount) || !isFinite(appAmount) || appAmount < 0) {
              appAmount = 0;
            }
            extraAppsCost += appAmount;
            invoiceItems.push({
              description: `Módulo Adicional: ${appRow.name || appId} (${appRow.id || appId})`,
              amount: appAmount,
              type: 'EXTRA_APP'
            });
          }
        }
      }

      const totalCost = Number((planPrice + extraAppsCost).toFixed(2));
      const prevBalance = Number(companyRow.balance || 0);
      const prevStatus = companyRow.status || 'active';

      let newBalance = prevBalance;
      let invoiceStatus = 'PENDING';
      let paidAtStr: string | null = null;
      let newExpiryStr = companyRow.license_expires_at;
      let newStatus = prevStatus;
      const ledgerEntries: any[] = [];

      if (prevBalance >= totalCost) {
        newBalance = prevBalance - totalCost;
        invoiceStatus = 'PAID';
        paidAtStr = new Date().toISOString();

        // Extend license
        const currentExpiryStr = companyRow.license_expires_at;
        const baseDate = currentExpiryStr && new Date(currentExpiryStr).getTime() > Date.now()
          ? new Date(currentExpiryStr)
          : new Date();
        const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 3600 * 1000);
        newExpiryStr = newExpiry.toISOString().split('T')[0];
        newStatus = 'active';

        // Plan charge ledger
        const ledgerId = `ldg_${companyId}_charge_${Date.now().toString().substring(6)}`;
        this.db!.prepare(`
          INSERT INTO company_ledger (
            id, company_id, type, amount, previous_balance, new_balance, description, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ledgerId,
          companyId,
          'PLAN_CHARGE',
          totalCost,
          prevBalance,
          newBalance,
          `Débito de mensalidade automática (Período: ${currentPeriod} - Plano: ${planId.toUpperCase()})`,
          paidAtStr
        );
        ledgerEntries.push({
          id: ledgerId,
          companyId,
          type: 'PLAN_CHARGE',
          amount: totalCost,
          previousBalance: prevBalance,
          newBalance,
          description: `Débito de mensalidade automática (Período: ${currentPeriod} - Plano: ${planId.toUpperCase()})`,
          timestamp: paidAtStr
        });
      } else {
        const isExpired = companyRow.license_expires_at ? new Date(companyRow.license_expires_at).getTime() < Date.now() : true;
        if (isExpired) {
          newStatus = 'suspended';
        }
      }

      // Create unique invoice id
      const invoiceId = `inv_${companyId}_${currentPeriod.replace('-', '')}`;
      const invoiceNumber = `FAT-${currentPeriod.replace('-', '')}-${companyId.substring(5, 9).toUpperCase()}`;

      // Insert invoice
      this.db!.prepare(`
        INSERT INTO invoices (
          id, invoice_number, company_id, company_name, billing_period, issue_date, due_date, paid_at, status, subtotal, discount, total_amount, items
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        invoiceNumber,
        companyId,
        companyRow.name,
        currentPeriod,
        todayIso,
        dueDateIso,
        paidAtStr,
        invoiceStatus,
        totalCost,
        0,
        totalCost,
        JSON.stringify(invoiceItems)
      );

      // Save billing idempotency
      this.db!.prepare('INSERT INTO billing_idempotency_log (key, invoice_id, processed_at) VALUES (?, ?, ?)')
        .run(idempotencyKey, invoiceId, new Date().toISOString());

      // Update company
      this.db!.prepare('UPDATE companies SET balance = ?, license_expires_at = ?, status = ? WHERE id = ?')
        .run(newBalance, newExpiryStr, newStatus, companyId);

      const updatedCompany = {
        ...companyRow,
        balance: newBalance,
        license_expires_at: newExpiryStr,
        status: newStatus
      };

      const invoiceData = {
        id: invoiceId,
        invoiceNumber,
        companyId,
        companyName: companyRow.name,
        billingPeriod: currentPeriod,
        issueDate: todayIso,
        dueDate: dueDateIso,
        paidAt: paidAtStr || undefined,
        status: invoiceStatus,
        subtotal: totalCost,
        discount: 0,
        totalAmount: totalCost,
        items: invoiceItems
      };

      return {
        success: true,
        skipped: false,
        report: {
          companyId,
          companyName: companyRow.name,
          plan: planId,
          totalCharged: totalCost,
          prevBalance,
          newBalance,
          prevStatus,
          newStatus,
          licenseExpiresAt: newExpiryStr,
          invoiceStatus,
          invoiceId,
          ledgerEntries,
          invoiceData,
          idempotencyKey
        }
      };
    });
  }

  public adjustCompanyBalanceTransaction(
    companyId: string,
    amount: number,
    description: string,
    ledgerType?: string
  ): {
    success: boolean;
    data: {
      previousBalance: number;
      newBalance: number;
      ledgerEntry: any;
    };
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const company = this.db!.prepare('SELECT balance FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        throw new Error('Empresa não encontrada no banco de dados');
      }
      const prevBalance = Number(company.balance || 0);
      const newBalance = prevBalance + amount;

      // Update balance
      this.db!.prepare('UPDATE companies SET balance = ? WHERE id = ?').run(newBalance, companyId);

      // Create ledger entry
      const ledgerId = `ldg_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
      const timestamp = new Date().toISOString();
      const type = ledgerType || (amount >= 0 ? 'CREDIT_ADDED' : 'PLAN_CHARGE');
      
      this.db!.prepare(`
        INSERT INTO company_ledger (
          id, company_id, type, amount, previous_balance, new_balance, description, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ledgerId,
        companyId,
        type,
        Math.abs(amount),
        prevBalance,
        newBalance,
        description,
        timestamp
      );

      const ledgerEntry = {
        id: ledgerId,
        companyId,
        type,
        amount: Math.abs(amount),
        previousBalance: prevBalance,
        newBalance,
        description,
        timestamp
      };

      return {
        success: true,
        data: {
          previousBalance: prevBalance,
          newBalance,
          ledgerEntry
        }
      };
    });
  }

  public updateTenantStatusTransaction(
    companyId: string,
    status: string
  ): {
    success: boolean;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const company = this.db!.prepare('SELECT 1 FROM companies WHERE id = ?').get(companyId);
      if (!company) {
        throw new Error('Tenant não encontrado no banco de dados');
      }
      this.db!.prepare('UPDATE companies SET status = ? WHERE id = ?').run(status, companyId);
      return { success: true };
    });
  }

  public updateTenantEntitlementsTransaction(
    companyId: string,
    updates: {
      plan?: string;
      maxTerminals?: number;
      maxBranches?: number;
      channel?: string;
      osTargetVersion?: string;
      licenseExpiresAt?: string;
    }
  ): {
    success: boolean;
    data: any;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const company = this.db!.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        throw new Error('Tenant não encontrado no banco de dados');
      }

      const plan = updates.plan !== undefined ? updates.plan : company.plan;
      const maxTerminals = updates.maxTerminals !== undefined ? updates.maxTerminals : Number(company.max_terminals);
      const maxBranches = updates.maxBranches !== undefined ? updates.maxBranches : Number(company.max_branches);
      const channel = updates.channel !== undefined ? updates.channel : company.channel;
      const osTargetVersion = updates.osTargetVersion !== undefined ? updates.osTargetVersion : company.os_target_version;
      const licenseExpiresAt = updates.licenseExpiresAt !== undefined ? updates.licenseExpiresAt : company.license_expires_at;

      this.db!.prepare(`
        UPDATE companies SET
          plan = ?,
          max_terminals = ?,
          max_branches = ?,
          channel = ?,
          os_target_version = ?,
          license_expires_at = ?
        WHERE id = ?
      `).run(plan, maxTerminals, maxBranches, channel, osTargetVersion, licenseExpiresAt, companyId);

      // Reload updated company to return
      const updatedRow = this.db!.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      const updatedCompany = {
        id: updatedRow.id,
        name: updatedRow.name,
        balance: Number(updatedRow.balance || 0),
        installedApps: JSON.parse(updatedRow.installed_apps || '[]'),
        status: updatedRow.status,
        plan: updatedRow.plan,
        maxTerminals: Number(updatedRow.max_terminals || 10),
        maxBranches: Number(updatedRow.max_branches || 1),
        activeTerminals: Number(updatedRow.active_terminals || 0),
        channel: updatedRow.channel,
        osTargetVersion: updatedRow.os_target_version,
        licenseExpiresAt: updatedRow.license_expires_at,
        branches: JSON.parse(updatedRow.branches || '[]')
      };

      return {
        success: true,
        data: updatedCompany
      };
    });
  }

  public updateTenantProfileTransaction(
    companyId: string,
    updates: {
      name?: string;
      status?: string;
      balance?: number;
      branches?: any[];
      installedApps?: string[];
      plan?: string;
      maxTerminals?: number;
      maxBranches?: number;
      channel?: string;
      osTargetVersion?: string;
      licenseExpiresAt?: string;
    }
  ): {
    success: boolean;
    data: any;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const company = this.db!.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        throw new Error('Tenant não encontrado no banco de dados');
      }

      const name = updates.name !== undefined ? updates.name : company.name;
      const status = updates.status !== undefined ? updates.status : company.status;
      const balance = updates.balance !== undefined ? updates.balance : Number(company.balance || 0);
      const plan = updates.plan !== undefined ? updates.plan : company.plan;
      const maxTerminals = updates.maxTerminals !== undefined ? updates.maxTerminals : Number(company.max_terminals);
      const maxBranches = updates.maxBranches !== undefined ? updates.maxBranches : Number(company.max_branches);
      const channel = updates.channel !== undefined ? updates.channel : company.channel;
      const osTargetVersion = updates.osTargetVersion !== undefined ? updates.osTargetVersion : company.os_target_version;
      const licenseExpiresAt = updates.licenseExpiresAt !== undefined ? updates.licenseExpiresAt : company.license_expires_at;
      const branches = updates.branches !== undefined ? JSON.stringify(updates.branches || []) : company.branches;
      const installedApps = updates.installedApps !== undefined ? JSON.stringify(updates.installedApps || []) : company.installed_apps;

      this.db!.prepare(`
        UPDATE companies SET
          name = ?,
          status = ?,
          balance = ?,
          plan = ?,
          max_terminals = ?,
          max_branches = ?,
          channel = ?,
          os_target_version = ?,
          license_expires_at = ?,
          branches = ?,
          installed_apps = ?
        WHERE id = ?
      `).run(name, status, balance, plan, maxTerminals, maxBranches, channel, osTargetVersion, licenseExpiresAt, branches, installedApps, companyId);

      const updatedRow = this.db!.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      const updatedCompany = {
        id: updatedRow.id,
        name: updatedRow.name,
        balance: Number(updatedRow.balance || 0),
        installedApps: JSON.parse(updatedRow.installed_apps || '[]'),
        status: updatedRow.status,
        plan: updatedRow.plan,
        maxTerminals: Number(updatedRow.max_terminals || 10),
        maxBranches: Number(updatedRow.max_branches || 1),
        activeTerminals: Number(updatedRow.active_terminals || 0),
        channel: updatedRow.channel,
        osTargetVersion: updatedRow.os_target_version,
        licenseExpiresAt: updatedRow.license_expires_at,
        branches: JSON.parse(updatedRow.branches || '[]')
      };

      return {
        success: true,
        data: updatedCompany
      };
    });
  }

  public updateTenantBranchesTransaction(
    companyId: string,
    branches: any[]
  ): {
    success: boolean;
    data: any[];
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const company = this.db!.prepare('SELECT id FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        throw new Error('Tenant não encontrado no banco de dados');
      }

      this.db!.prepare(`
        UPDATE companies SET
          branches = ?
        WHERE id = ?
      `).run(JSON.stringify(branches || []), companyId);

      return {
        success: true,
        data: branches
      };
    });
  }

  public upsertCompanyUserTransaction(
    companyId: string,
    user: any
  ): {
    success: boolean;
    data: any;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const activeInt = user.status === 'suspended' ? 0 : (user.active !== undefined ? (user.active ? 1 : 0) : 1);
      const branchIdsArray: string[] = Array.isArray(user.branchIds)
        ? user.branchIds
        : (user.branchId ? [user.branchId] : []);
      const branchId = branchIdsArray.length > 0 ? branchIdsArray[0] : (user.branchId || null);

      this.db!.prepare(`
        INSERT INTO company_users (
          id, company_id, branch_id, branch_ids, name, email, role, password, pin, active, last_login
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          branch_ids = excluded.branch_ids,
          name = excluded.name,
          email = excluded.email,
          role = excluded.role,
          password = excluded.password,
          pin = excluded.pin,
          active = excluded.active
      `).run(
        user.id,
        companyId,
        branchId,
        JSON.stringify(branchIdsArray),
        user.name,
        user.email || '',
        user.role,
        user.password || createHash('sha256').update(randomUUID()).digest('hex'),
        user.pin || null,
        activeInt,
        user.lastLogin || null
      );

      return {
        success: true,
        data: user
      };
    });
  }

  public deleteCompanyUserTransaction(
    companyId: string,
    userId: string
  ): {
    success: boolean;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      this.db!.prepare('DELETE FROM company_users WHERE id = ? AND company_id = ?').run(userId, companyId);
      return { success: true };
    });
  }

  public updateTenantAppsTransaction(
    companyId: string,
    appId: string,
    action: 'install' | 'uninstall'
  ): {
    success: boolean;
    data: string[];
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const company = this.db!.prepare('SELECT installed_apps FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        throw new Error('Tenant não encontrado no banco de dados');
      }

      let apps: string[] = JSON.parse(company.installed_apps || '[]');
      if (action === 'install') {
        if (!apps.includes(appId)) {
          apps.push(appId);
        }
      } else {
        apps = apps.filter(a => a !== appId);
      }

      this.db!.prepare('UPDATE companies SET installed_apps = ? WHERE id = ?').run(JSON.stringify(apps), companyId);
      return {
        success: true,
        data: apps
      };
    });
  }

  public registerDeviceTransaction(
    device: any
  ): {
    success: boolean;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      // Check limits
      const companyRow = this.db!.prepare('SELECT max_terminals, active_terminals FROM companies WHERE id = ?').get(device.companyId) as any;
      if (!companyRow) {
        throw new Error('Empresa não encontrada no banco de dados');
      }

      const targetDeviceId = device.deviceId || device.id || `dev_${Date.now()}`;

      // Check if device already registered by fingerprint, installationId, or deviceId
      const existing = this.db!.prepare(`
        SELECT * FROM devices 
        WHERE (
          (fingerprint_hash = ? AND ? IS NOT NULL) OR 
          (installation_id = ? AND ? IS NOT NULL) OR 
          device_id = ?
        ) AND company_id = ?
      `).get(
        device.fingerprintHash || null, device.fingerprintHash || null,
        device.installationId || null, device.installationId || null,
        targetDeviceId,
        device.companyId
      ) as any;

      if (existing) {
        // Idempotently update device attributes on reconnection
        this.db!.prepare(`
          UPDATE devices SET
            name = ?, branch_id = ?, platform = ?, os_version = ?, last_seen_at = ?, ip_address = ?
          WHERE device_id = ? AND company_id = ?
        `).run(
          device.name,
          device.branchId || existing.branch_id,
          device.platform || existing.platform,
          device.osVersion || existing.os_version,
          device.lastSeenAt || device.lastActiveAt || new Date().toISOString(),
          device.ipAddress || existing.ip_address,
          existing.device_id,
          device.companyId
        );
        return { success: true, updated: true, deviceId: existing.device_id };
      }

      // Check limits for new terminal registration
      const activeTerminals = Number(companyRow.active_terminals || 0);
      const maxTerminals = Number(companyRow.max_terminals || 1);

      if (activeTerminals >= maxTerminals) {
        throw new Error(`Limite de terminais ativos atingido para este tenant (${maxTerminals} terminais). Adquira licenças adicionais no portal HQ.`);
      }

      // Insert new device
      this.db!.prepare(`
        INSERT INTO devices (
          device_id, company_id, branch_id, name, platform, os_version, fingerprint_hash, installation_id, hardware_id, status, registered_at, last_seen_at, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        targetDeviceId,
        device.companyId,
        device.branchId || null,
        device.name,
        device.platform || 'web',
        device.osVersion || '1.4.3',
        device.fingerprintHash || null,
        device.installationId || null,
        device.hardwareId || device.fingerprintHash || targetDeviceId,
        device.status || 'active',
        device.registeredAt || device.createdAt || new Date().toISOString(),
        device.lastSeenAt || device.lastActiveAt || new Date().toISOString(),
        device.ipAddress || null
      );

      // Increment active count
      this.db!.prepare('UPDATE companies SET active_terminals = active_terminals + 1 WHERE id = ?').run(device.companyId);

      return { success: true, deviceId: targetDeviceId };
    });
  }

  public updateDeviceStatusTransaction(
    companyId: string,
    deviceId: string,
    status: string
  ): {
    success: boolean;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const device = this.db!.prepare('SELECT status FROM devices WHERE device_id = ? AND company_id = ?').get(deviceId, companyId) as any;
      if (!device) {
        throw new Error('Terminal não encontrado no banco de dados');
      }

      const prevStatus = device.status;
      if (prevStatus === status) return { success: true };

      // Update status
      this.db!.prepare('UPDATE devices SET status = ? WHERE device_id = ? AND company_id = ?').run(status, deviceId, companyId);

      // Adjust active_terminals count on company if status transitioned to/from active
      if (prevStatus === 'active' && status !== 'active') {
        this.db!.prepare('UPDATE companies SET active_terminals = MAX(0, active_terminals - 1) WHERE id = ?').run(companyId);
      } else if (prevStatus !== 'active' && status === 'active') {
        this.db!.prepare('UPDATE companies SET active_terminals = active_terminals + 1 WHERE id = ?').run(companyId);
      }

      return { success: true };
    });
  }

  public deleteDeviceTransaction(
    companyId: string,
    deviceId: string
  ): {
    success: boolean;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const device = this.db!.prepare('SELECT status FROM devices WHERE device_id = ? AND company_id = ?').get(deviceId, companyId) as any;
      if (!device) {
        throw new Error('Terminal não encontrado no banco de dados');
      }

      const prevStatus = device.status;

      // Delete device
      this.db!.prepare('DELETE FROM devices WHERE device_id = ? AND company_id = ?').run(deviceId, companyId);

      // Clean up orphaned installations for this decommissioned device
      this.db!.prepare('DELETE FROM app_installations WHERE company_id = ? AND device_id = ?').run(companyId, deviceId);

      // Decrement active_terminals count on company if deleted device was active
      if (prevStatus === 'active') {
        this.db!.prepare('UPDATE companies SET active_terminals = MAX(0, active_terminals - 1) WHERE id = ?').run(companyId);
      }

      return { success: true };
    });
  }

  public getDevice(companyId: string, deviceId: string): any {
    if (!this.db) return null;
    return this.db.prepare('SELECT * FROM devices WHERE device_id = ? AND company_id = ?').get(deviceId, companyId);
  }

  public getDevicesByCompany(companyId: string): any[] {
    if (!this.db) return [];
    return this.db.prepare('SELECT * FROM devices WHERE company_id = ? ORDER BY last_seen_at DESC').all(companyId);
  }

  public checkHealth(): { healthy: boolean; details: Record<string, unknown> } {
    if (!this.db) {
      return { healthy: false, details: { error: 'Database instance not initialized' } };
    }
    try {
      const ping = this.db.prepare('SELECT 1 as alive').get() as { alive?: number };
      const compCount = (this.db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count?: number })?.count ?? 0;
      const prodCount = (this.db.prepare('SELECT COUNT(*) as count FROM products').get() as { count?: number })?.count ?? 0;
      const salesCount = (this.db.prepare('SELECT COUNT(*) as count FROM sales').get() as { count?: number })?.count ?? 0;

      return {
        healthy: ping?.alive === 1,
        details: {
          driver: 'node:sqlite',
          journalMode: 'WAL',
          companiesCount: compCount,
          productsCount: prodCount,
          salesCount: salesCount
        }
      };
    } catch (err) {
      return {
        healthy: false,
        details: { error: err instanceof Error ? err.message : String(err) }
      };
    }
  }

  public createPaymentOrderTransaction(invoiceId: string, companyId: string, paymentMethod: string, amount: number, qrCodeString?: string): any {
    if (!this.db) return { success: false, code: 500 };
    return this.runInTransaction(() => {
      // 1. Check if invoice is already PAID
      const invoice = this.db!.prepare("SELECT status FROM invoices WHERE id = ? AND company_id = ?").get(invoiceId, companyId) as any;
      if (!invoice) return { success: false, code: 404, message: 'Fatura não encontrada.' };
      if (invoice.status === 'PAID' || invoice.status === 'PAYMENT_CONFIRMED') {
        return { success: false, code: 400, message: 'Esta fatura já está paga.' };
      }
      
      // 2. Check if there is already an active PENDING payment order
      const existing = this.db!.prepare("SELECT * FROM payment_orders WHERE invoice_id = ? AND status = 'PENDING'").get(invoiceId) as any;
      if (existing) {
        return { 
          success: true, 
          reused: true, 
          paymentOrder: {
            id: existing.id,
            invoiceId: existing.invoice_id,
            companyId: existing.company_id,
            paymentMethod: existing.method || existing.payment_method,
            status: existing.status,
            amount: existing.amount,
            qrCode: existing.qr_code,
            qrCodeCopyPaste: existing.qr_code_copy_paste,
            createdAt: existing.created_at
          } 
        };
      }

      // 3. Create new payment order
      const orderId = `pay_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 10)}`;
      const now = new Date().toISOString();
      const stmt = this.db!.prepare(`
        INSERT INTO payment_orders (id, company_id, amount, status, created_at, invoice_id, method, qr_code, qr_code_copy_paste)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(orderId, companyId, amount, 'PENDING', now, invoiceId, paymentMethod, qrCodeString || null, qrCodeString || null);
      
      this.db!.prepare("UPDATE invoices SET status = 'PAYMENT_CREATED' WHERE id = ?").run(invoiceId);

      return { 
        success: true, 
        reused: false, 
        paymentOrder: { 
          id: orderId, 
          invoiceId, 
          companyId, 
          paymentMethod, 
          status: 'PENDING', 
          amount, 
          qrCode: qrCodeString, 
          qrCodeCopyPaste: qrCodeString, 
          createdAt: now 
        } 
      };
    });
  }

  public installStoreAppTransaction(companyId: string, deviceId: string, appId: string, appItem: any, targetVersion?: string): any {
    if (!this.db) return { success: false };
    
    const catalogApp = this.getAppCatalogItem(appId);
    const resolvedPricing = appItem?.pricing || (appItem?.model ? appItem : null) || catalogApp?.pricing || { model: 'FREE', amount: 0, currency: 'BRL' };
    const resolvedName = appItem?.name || catalogApp?.name || appId;
    const versionToInstall = targetVersion || appItem?.currentRelease?.version || catalogApp?.currentRelease?.version || '1.0.0';

    return this.runInTransaction(() => {
      const now = new Date().toISOString();
      
      // 1. Check/Insert Entitlement
      const entitlementId = `ent_${companyId}_${appId}`;
      const existingEnt = this.db!.prepare("SELECT * FROM app_entitlements WHERE company_id = ? AND app_id = ?").get(companyId, appId) as any;
      let entitlement;
      if (!existingEnt) {
        const entId = `ent_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
        this.db!.prepare(`
          INSERT INTO app_entitlements (id, company_id, app_id, status, pricing_model, amount, currency, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(entId, companyId, appId, 'ACTIVE', resolvedPricing.model || 'FREE', resolvedPricing.amount || 0, resolvedPricing.currency || 'BRL', now);
        entitlement = { id: entId, companyId, appId, status: 'ACTIVE', pricingModel: resolvedPricing.model || 'FREE', amount: resolvedPricing.amount || 0, currency: resolvedPricing.currency || 'BRL', createdAt: now };
      } else {
        if (existingEnt.status !== 'ACTIVE') {
          throw new Error(`ENTITLEMENT_INACTIVE:${existingEnt.status}`);
        }
        entitlement = { id: existingEnt.id, companyId, appId, status: existingEnt.status };
      }

      // 2. Check/Insert Installation
      const existingInst = this.db!.prepare("SELECT * FROM app_installations WHERE company_id = ? AND device_id = ? AND app_id = ?").get(companyId, deviceId, appId) as any;
      let installation;
      if (!existingInst) {
        const instId = `inst_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
        this.db!.prepare(`
          INSERT INTO app_installations (id, company_id, device_id, app_id, installed_version, status, installed_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(instId, companyId, deviceId, appId, versionToInstall, 'INSTALLED', now, now);
        installation = { id: instId, companyId, deviceId, appId, installedVersion: versionToInstall, status: 'INSTALLED', installedAt: now };
      } else {
        this.db!.prepare("UPDATE app_installations SET installed_version = ?, status = 'INSTALLED', updated_at = ? WHERE id = ?").run(versionToInstall, now, existingInst.id);
        installation = { id: existingInst.id, companyId, deviceId, appId, installedVersion: versionToInstall, status: 'INSTALLED', installedAt: existingInst.installed_at };
      }

      // Synchronize company's installed_apps column in SQLite to avoid divergence
      const compRecord = this.db!.prepare("SELECT installed_apps FROM companies WHERE id = ?").get(companyId) as { installed_apps?: string } | undefined;
      if (compRecord) {
        const apps: string[] = JSON.parse(compRecord.installed_apps || '[]');
        if (!apps.includes(appId)) {
          apps.push(appId);
          this.db!.prepare("UPDATE companies SET installed_apps = ? WHERE id = ?").run(JSON.stringify(apps), companyId);
        }
      }

      // 3. Billing Ledger for paid apps
      let ledgerEntry = null;
      const isPaid = !existingEnt && (
        resolvedPricing.model === 'ONE_TIME' || 
        resolvedPricing.model === 'SUBSCRIPTION_MONTHLY' || 
        resolvedPricing.model === 'SUBSCRIPTION_ANNUAL' || 
        resolvedPricing.model === 'MONTHLY'
      ) && resolvedPricing.amount > 0;

      if (isPaid) {
        const amount = resolvedPricing.amount;
        const companyRow = this.db!.prepare("SELECT id, balance FROM companies WHERE id = ?").get(companyId) as any;
        if (!companyRow) {
          throw new Error('Empresa não encontrada para cobrança.');
        }

        const prevBalance = Number(companyRow.balance || 0);
        if (prevBalance < amount) {
          throw new Error('INSUFFICIENT_FUNDS');
        }

        const newBalance = prevBalance - amount;
        const updateResult = this.db!.prepare(`
          UPDATE companies 
          SET balance = balance - ? 
          WHERE id = ? AND balance >= ?
        `).run(amount, companyId, amount);

        if (updateResult.changes === 0) {
          throw new Error('INSUFFICIENT_FUNDS');
        }

        const ledId = `led_app_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
        this.db!.prepare(`
          INSERT INTO company_ledger (
            id, company_id, type, amount, previous_balance, new_balance, description, reference_id, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ledId, 
          companyId, 
          'APP_CHARGE', 
          amount, 
          prevBalance, 
          newBalance, 
          `Compra do aplicativo ${resolvedName}`, 
          appId, 
          now
        );
        
        ledgerEntry = { 
          id: ledId, 
          companyId, 
          type: 'APP_CHARGE', 
          amount, 
          previousBalance: prevBalance,
          newBalance,
          description: `Compra do aplicativo ${appItem.name}`, 
          referenceId: appId,
          timestamp: now 
        };
      }

      return { success: true, entitlement, installation, ledgerEntry };
    });
  }


  public upsertAppCatalogItemTransaction(app: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const existing = this.db!.prepare("SELECT id FROM app_catalog WHERE id = ?").get(app.id);
      
      const pricingStr = JSON.stringify(app.pricing || { model: 'FREE', amount: 0, currency: 'BRL' });
      const lifecycleStr = JSON.stringify(app.lifecycle || { status: app.status || 'PUBLISHED' });
      const currentReleaseStr = app.currentRelease ? JSON.stringify(app.currentRelease) : null;
      const permissionsStr = JSON.stringify(app.permissions || []);
      const capabilitiesStr = JSON.stringify(app.capabilities || []);
      const dependenciesStr = JSON.stringify(app.dependencies || []);
      const isSystemAppInt = app.isSystemApp ? 1 : 0;
      const developer = app.developer || '3eatcru Corp';
      const publisher = app.publisher || '3eatcru Corp';

      if (existing) {
        this.db!.prepare(`
          UPDATE app_catalog SET
            name = ?, description = ?, developer = ?, publisher = ?, category = ?, icon = ?,
            pricing = ?, lifecycle = ?, current_release = ?, permissions = ?, capabilities = ?,
            dependencies = ?, is_system_app = ?
          WHERE id = ?
        `).run(
          app.name, app.description, developer, publisher, app.category, app.icon,
          pricingStr, lifecycleStr, currentReleaseStr, permissionsStr, capabilitiesStr,
          dependenciesStr, isSystemAppInt, app.id
        );
      } else {
        this.db!.prepare(`
          INSERT INTO app_catalog (id, name, description, developer, publisher, category, icon, pricing, lifecycle, current_release, permissions, capabilities, dependencies, is_system_app)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          app.id, app.name, app.description, developer, publisher, app.category, app.icon,
          pricingStr, lifecycleStr, currentReleaseStr, permissionsStr, capabilitiesStr,
          dependenciesStr, isSystemAppInt
        );
      }
      return { success: true };
    });
  }

  public getAppCatalogItem(appId: string): any {
    if (!this.db) return null;
    const row = this.db.prepare("SELECT * FROM app_catalog WHERE id = ?").get(appId) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      developer: row.developer,
      publisher: row.publisher,
      category: row.category,
      icon: row.icon,
      pricing: row.pricing ? JSON.parse(row.pricing) : { model: 'FREE', amount: 0, currency: 'BRL' },
      lifecycle: row.lifecycle ? JSON.parse(row.lifecycle) : { status: 'PUBLISHED' },
      currentRelease: row.current_release ? JSON.parse(row.current_release) : null,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
      isSystemApp: Boolean(row.is_system_app)
    };
  }

  public upsertPlanTransaction(plan: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const existing = this.db!.prepare("SELECT id FROM plans WHERE id = ?").get(plan.id);
      if (existing) {
        this.db!.prepare(`
          UPDATE plans SET
            name = ?, max_terminals = ?, max_branches = ?, description = ?, features = ?, monthly_price = ?, included_apps = ?
          WHERE id = ?
        `).run(
          plan.name, plan.maxTerminals, plan.maxBranches, plan.description, JSON.stringify(plan.features), plan.monthlyPrice || plan.price || 0, JSON.stringify(plan.includedApps || []), plan.id
        );
      } else {
        this.db!.prepare(`
          INSERT INTO plans (id, name, max_terminals, max_branches, description, features, monthly_price, included_apps)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          plan.id, plan.name, plan.maxTerminals, plan.maxBranches, plan.description, JSON.stringify(plan.features), plan.monthlyPrice || plan.price || 0, JSON.stringify(plan.includedApps || [])
        );
      }
      return { success: true };
    });
  }


  public upsertPublicSpaceTransaction(space: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const slug = space.companySlug || space.slug || space.companyId;
      const title = space.title || space.siteName || 'Loja Online';
      const description = space.description || space.siteDescription || '';
      const themeColor = space.themeColor || (typeof space.theme === 'string' ? space.theme : space.theme?.primaryColor) || '#10b981';
      const logo = space.logo || '';
      const templateId = space.templateId || 'modern-emerald';
      const status = space.status || 'published';
      const publishedAt = space.publishedAt ? new Date(space.publishedAt).toISOString() : new Date().toISOString();
      const phone = space.phone || '';
      const email = space.email || '';
      const address = space.address || '';
      const hours = typeof space.hours === 'object' ? JSON.stringify(space.hours) : String(space.hours || 'Seg a Sab 09:00 - 22:00');
      const products = typeof space.products === 'string' ? space.products : JSON.stringify(space.products || []);
      const theme = typeof space.theme === 'string' ? space.theme : JSON.stringify(space.theme || {});

      this.db!.prepare(`
        INSERT INTO public_spaces (
          company_id, company_slug, title, description, logo,
          template_id, theme_color, status, published_at, phone,
          email, address, hours, products, slug, site_name,
          site_description, theme, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(company_id) DO UPDATE SET
          company_slug = excluded.company_slug,
          title = excluded.title,
          description = excluded.description,
          logo = excluded.logo,
          template_id = excluded.template_id,
          theme_color = excluded.theme_color,
          status = excluded.status,
          published_at = excluded.published_at,
          phone = excluded.phone,
          email = excluded.email,
          address = excluded.address,
          hours = excluded.hours,
          products = excluded.products,
          slug = excluded.slug,
          site_name = excluded.site_name,
          site_description = excluded.site_description,
          theme = excluded.theme
      `).run(
        space.companyId,
        slug,
        title,
        description,
        logo,
        templateId,
        themeColor,
        status,
        publishedAt,
        phone,
        email,
        address,
        hours,
        products,
        slug,
        title,
        description,
        theme,
        new Date().toISOString()
      );
      return { success: true };
    });
  }

  public saveMarketplaceOrderTransaction(
    order: any, 
    stockDeductions?: { productId: string; quantity: number }[], 
    allowNegativeStock = false
  ): { success: boolean; error?: string; code?: number } {
    if (!this.db) return { success: false, error: 'Banco de dados não inicializado', code: 500 };
    return this.runInTransaction(() => {
      // 1. Atomic stock deduction inside SQLite transaction
      if (stockDeductions && stockDeductions.length > 0) {
        for (const item of stockDeductions) {
          const product = this.db!.prepare("SELECT id, name, stock FROM products WHERE id = ?").get(item.productId) as any;
          if (product) {
            const currentStock = Number(product.stock || 0);
            if (!allowNegativeStock && currentStock < item.quantity) {
              throw new Error(`INSUFFICIENT_STOCK:${product.name}:${currentStock}:${item.quantity}`);
            }
            this.db!.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(item.quantity, item.productId);
          }
        }
      }

      this.db!.prepare(`
        INSERT INTO orders (
          id, public_tracking_token, customer_account_id, company_id, branch_id, company_name,
          customer_name, customer_phone, customer_address, items, total,
          notes, payment_method, status, channel, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id,
        order.publicTrackingToken || null,
        order.customerAccountId || null,
        order.companyId,
        order.branchId || null,
        order.companyName || 'Empresa',
        order.customerName || 'Cliente',
        order.customerPhone || null,
        order.customerAddress || null,
        JSON.stringify(order.items || []),
        order.total || order.amount || 0,
        order.notes || null,
        order.paymentMethod || 'PIX',
        order.status || 'RECEIVED',
        order.channel || 'MARKETPLACE',
        order.createdAt || new Date().toISOString()
      );
      return { success: true, orderId: order.id };
    });
  }

  public updateMarketplaceOrderStatusTransaction(
    orderIdOrToken: string,
    targetStatus: string
  ): {
    success: boolean;
    order?: any;
    sale?: any;
    financeTransaction?: any;
    stockRefunds?: { productId: string; quantity: number }[];
    error?: string;
  } {
    if (!this.db) return { success: false, error: 'Banco de dados não inicializado' };
    return this.runInTransaction(() => {
      const row = this.db!.prepare(`
        SELECT * FROM orders WHERE id = ? OR public_tracking_token = ?
      `).get(orderIdOrToken, orderIdOrToken) as any;

      if (!row) {
        throw new Error('Pedido não encontrado no banco de dados');
      }

      const currentStatus = row.status;
      const now = new Date().toISOString();

      const allowedTransitions: Record<string, string[]> = {
        'RECEIVED': ['PREPARING', 'CANCELLED'],
        'PREPARING': ['READY', 'CANCELLED'],
        'READY': ['DELIVERING', 'COMPLETED', 'CANCELLED'],
        'DELIVERING': ['COMPLETED', 'CANCELLED'],
        'COMPLETED': [],
        'CANCELLED': []
      };

      if (currentStatus !== targetStatus) {
        const allowed = allowedTransitions[currentStatus] || [];
        if (!allowed.includes(targetStatus)) {
          throw new Error(`Transição de status inválida de '${currentStatus}' para '${targetStatus}'.`);
        }
      }

      this.db!.prepare(`
        UPDATE orders SET status = ?, updated_at = ? WHERE id = ?
      `).run(targetStatus, now, row.id);

      const items = JSON.parse(row.items || '[]');
      const stockRefunds: { productId: string; quantity: number }[] = [];

      if (targetStatus === 'CANCELLED' && currentStatus !== 'CANCELLED') {
        for (const it of items) {
          if (it.productId) {
            const qty = Number(it.quantity || 1);
            this.db!.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(qty, it.productId);
            stockRefunds.push({ productId: it.productId, quantity: qty });
          }
        }
      }

      let saleRecord = null;
      let financeRecord = null;
      if (targetStatus === 'COMPLETED' && currentStatus !== 'COMPLETED') {
        const saleId = `sale_${row.id}`;
        const existingSale = this.db!.prepare("SELECT id FROM sales WHERE id = ?").get(saleId);
        if (!existingSale) {
          const saleItems = items.map((oi: any) => ({
            productId: oi.productId || `prod_custom_${String(oi.name || 'item').toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            quantity: Number(oi.quantity || 1),
            unitPrice: Number(oi.unitPrice || 0)
          }));
          this.db!.prepare(`
            INSERT INTO sales (id, company_id, branch_id, items, total, timestamp, payment_method, operator)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            saleId,
            row.company_id,
            row.branch_id || null,
            JSON.stringify(saleItems),
            Number(row.total || 0),
            now,
            row.payment_method || 'PIX',
            `Online / ${row.customer_name || 'Cliente'}`
          );
          saleRecord = {
            id: saleId,
            companyId: row.company_id,
            branchId: row.branch_id || null,
            items: saleItems,
            total: Number(row.total || 0),
            timestamp: now,
            paymentMethod: row.payment_method || 'PIX',
            operator: `Online / ${row.customer_name || 'Cliente'}`
          };
        }

        const finId = `fin_${saleId}`;
        const existingFin = this.db!.prepare("SELECT id FROM finance_transactions WHERE id = ?").get(finId);
        if (!existingFin) {
          const paymentMethod = row.payment_method || 'PIX';
          const description = `Pedido Online / Marketplace #${row.id.slice(-6)} (${row.customer_name || 'Cliente'})`;
          this.db!.prepare(`
            INSERT INTO finance_transactions (id, company_id, branch_id, type, category, description, amount, payment_method, timestamp, operator, reference_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            finId,
            row.company_id,
            row.branch_id || null,
            'INFLOW',
            'SALE',
            description,
            Number(row.total || 0),
            paymentMethod,
            now,
            'Marketplace Integration',
            saleId
          );
          financeRecord = {
            id: finId,
            companyId: row.company_id,
            branchId: row.branch_id || null,
            type: 'INFLOW',
            category: 'SALE',
            description,
            amount: Number(row.total || 0),
            paymentMethod,
            timestamp: now,
            operator: 'Marketplace Integration',
            referenceId: saleId
          };
        }
      }

      const updatedRow = this.db!.prepare("SELECT * FROM orders WHERE id = ?").get(row.id) as any;
      const updatedOrder = {
        id: updatedRow.id,
        publicTrackingToken: updatedRow.public_tracking_token,
        companyId: updatedRow.company_id,
        branchId: updatedRow.branch_id,
        companyName: updatedRow.company_name,
        customerName: updatedRow.customer_name,
        customerPhone: updatedRow.customer_phone,
        customerAddress: updatedRow.customer_address,
        items: JSON.parse(updatedRow.items || '[]'),
        total: Number(updatedRow.total || 0),
        notes: updatedRow.notes,
        paymentMethod: updatedRow.payment_method,
        status: updatedRow.status,
        channel: updatedRow.channel,
        createdAt: updatedRow.created_at,
        updatedAt: updatedRow.updated_at
      };

      return {
        success: true,
        order: updatedOrder,
        sale: saleRecord,
        financeTransaction: financeRecord,
        stockRefunds
      };
    });
  }

  public applySyncBatchTransaction(params: {
    sales?: any[];
    products?: any[];
    financeTransactions?: any[];
    customers?: any[];
    tables?: any[];
    publicSpaces?: any[];
    idempotencyEntries?: { key: string; status: string; processedAt: string; response: any }[];
  }): { success: boolean; error?: string } {
    if (!this.db) return { success: false, error: 'Banco de dados não inicializado' };
    return this.runInTransaction(() => {
      // 1. Products
      if (params.products && params.products.length > 0) {
        const stmt = this.db!.prepare(`
          INSERT INTO products (id, company_id, branch_id, name, price, stock)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            company_id = excluded.company_id,
            branch_id = excluded.branch_id,
            name = excluded.name,
            price = excluded.price,
            stock = excluded.stock
        `);
        for (const p of params.products) {
          stmt.run(
            String(p.id),
            String(p.companyId || ''),
            p.branchId ? String(p.branchId) : null,
            String(p.name || ''),
            Number(p.salePrice ?? p.price ?? 0),
            Number(p.stockQuantity ?? p.stock ?? 0)
          );
        }
      }

      // 2. Sales
      if (params.sales && params.sales.length > 0) {
        const stmt = this.db!.prepare(`
          INSERT INTO sales (id, company_id, branch_id, items, total, timestamp, payment_method, operator)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            company_id = excluded.company_id,
            branch_id = excluded.branch_id,
            items = excluded.items,
            total = excluded.total,
            timestamp = excluded.timestamp,
            payment_method = excluded.payment_method,
            operator = excluded.operator
        `);
        for (const s of params.sales) {
          stmt.run(
            String(s.id),
            String(s.companyId || ''),
            s.branchId ? String(s.branchId) : null,
            JSON.stringify(s.items || []),
            Number(s.total || 0),
            String(s.timestamp || new Date().toISOString()),
            s.paymentMethod ? String(s.paymentMethod) : null,
            s.operator ? String(s.operator) : null
          );
        }
      }

      // 3. Finance Transactions
      if (params.financeTransactions && params.financeTransactions.length > 0) {
        const stmt = this.db!.prepare(`
          INSERT INTO finance_transactions (
            id, company_id, branch_id, type, category, description, amount, payment_method, timestamp, operator, reference_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            company_id = excluded.company_id,
            branch_id = excluded.branch_id,
            type = excluded.type,
            category = excluded.category,
            description = excluded.description,
            amount = excluded.amount,
            payment_method = excluded.payment_method,
            timestamp = excluded.timestamp,
            operator = excluded.operator,
            reference_id = excluded.reference_id
        `);
        for (const ft of params.financeTransactions) {
          stmt.run(
            String(ft.id),
            String(ft.companyId || ''),
            ft.branchId ? String(ft.branchId) : null,
            String(ft.type || 'INFLOW'),
            String(ft.category || 'SALE'),
            String(ft.description || ''),
            Number(ft.amount || 0),
            String(ft.paymentMethod || 'DINHEIRO'),
            String(ft.timestamp || new Date().toISOString()),
            String(ft.operator || 'Operador'),
            ft.referenceId ? String(ft.referenceId) : null
          );
        }
      }

      // 4. Customers
      if (params.customers && params.customers.length > 0) {
        const stmt = this.db!.prepare(`
          INSERT INTO customers (id, company_id, branch_id, name, phone, email, points, total_spent, tier, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            company_id = excluded.company_id,
            branch_id = excluded.branch_id,
            name = excluded.name,
            phone = excluded.phone,
            email = excluded.email,
            points = excluded.points,
            total_spent = excluded.total_spent,
            tier = excluded.tier,
            created_at = excluded.created_at
        `);
        for (const c of params.customers) {
          stmt.run(
            String(c.id),
            String(c.companyId || ''),
            c.branchId ? String(c.branchId) : null,
            String(c.name || ''),
            String(c.phone || ''),
            String(c.email || ''),
            Number(c.points || 0),
            Number(c.totalSpent || 0),
            String(c.tier || 'Bronze'),
            String(c.createdAt || new Date().toISOString())
          );
        }
      }

      // 5. Tables
      if (params.tables && params.tables.length > 0) {
        const stmt = this.db!.prepare(`
          INSERT INTO tables_registry (id, company_id, branch_id, number, name, capacity, status, current_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            company_id = excluded.company_id,
            branch_id = excluded.branch_id,
            number = excluded.number,
            name = excluded.name,
            capacity = excluded.capacity,
            status = excluded.status,
            current_order = excluded.current_order
        `);
        for (const t of params.tables) {
          stmt.run(
            String(t.id),
            String(t.companyId || ''),
            t.branchId ? String(t.branchId) : null,
            Number(t.number || 1),
            String(t.name || ''),
            Number(t.capacity || 4),
            String(t.status || 'AVAILABLE'),
            t.currentOrder ? JSON.stringify(t.currentOrder) : null
          );
        }
      }

      // 6. Public Spaces
      if (params.publicSpaces && params.publicSpaces.length > 0) {
        for (const ps of params.publicSpaces) {
          const slug = ps.companySlug || ps.slug || ps.companyId;
          const title = ps.title || ps.siteName || 'Loja Online';
          const description = ps.description || ps.siteDescription || '';
          const themeColor = ps.themeColor || (typeof ps.theme === 'string' ? ps.theme : ps.theme?.primaryColor) || '#10b981';
          const logo = ps.logo || '';
          const templateId = ps.templateId || 'modern-emerald';
          const status = ps.status || 'published';
          const publishedAt = ps.publishedAt ? new Date(ps.publishedAt).toISOString() : new Date().toISOString();
          const phone = ps.phone || '';
          const email = ps.email || '';
          const address = ps.address || '';
          const hours = typeof ps.hours === 'object' ? JSON.stringify(ps.hours) : String(ps.hours || 'Seg a Sab 09:00 - 22:00');
          const products = typeof ps.products === 'string' ? ps.products : JSON.stringify(ps.products || []);
          const theme = typeof ps.theme === 'string' ? ps.theme : JSON.stringify(ps.theme || {});

          this.db!.prepare(`
            INSERT INTO public_spaces (
              company_id, company_slug, title, description, logo,
              template_id, theme_color, status, published_at, phone,
              email, address, hours, products, slug, site_name,
              site_description, theme, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(company_id) DO UPDATE SET
              company_slug = excluded.company_slug,
              title = excluded.title,
              description = excluded.description,
              logo = excluded.logo,
              template_id = excluded.template_id,
              theme_color = excluded.theme_color,
              status = excluded.status,
              published_at = excluded.published_at,
              phone = excluded.phone,
              email = excluded.email,
              address = excluded.address,
              hours = excluded.hours,
              products = excluded.products,
              slug = excluded.slug,
              site_name = excluded.site_name,
              site_description = excluded.site_description,
              theme = excluded.theme
          `).run(
            ps.companyId, slug, title, description, logo,
            templateId, themeColor, status, publishedAt, phone,
            email, address, hours, products, slug, title,
            description, theme, publishedAt
          );
        }
      }

      // 7. Idempotency Log Entries
      if (params.idempotencyEntries && params.idempotencyEntries.length > 0) {
        const stmt = this.db!.prepare(`
          INSERT INTO idempotency_log (key, status, processed_at, response)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            status = excluded.status,
            processed_at = excluded.processed_at,
            response = excluded.response
        `);
        for (const ide of params.idempotencyEntries) {
          stmt.run(
            String(ide.key),
            String(ide.status),
            String(ide.processedAt),
            JSON.stringify(ide.response || {})
          );
        }
      }

      return { success: true };
    });
  }

  public saveTelemetryTransaction(report: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const id = report.id || (report.deviceId ? `${report.companyId}:${report.deviceId}` : report.companyId);
      const companyName = report.companyName || 'Empresa';
      const deviceId = report.deviceId || null;
      const timestamp = report.timestamp || new Date().toISOString();
      const overallStatus = report.overallStatus || 'healthy';
      const clientReportedStatus = report.clientReportedStatus || overallStatus;
      const centralCalculatedHealth = report.centralCalculatedHealth || overallStatus;
      const checksJson = JSON.stringify(report.checks || []);
      const metricsJson = JSON.stringify(report.metrics || report.checks || {});
      const platform = report.platform || 'web';
      const version = report.version || report.osVersion || '1.4.3';

      this.db!.prepare(`
        INSERT INTO telemetry (
          id, company_id, company_name, device_id, timestamp,
          overall_status, client_reported_status, central_calculated_health,
          checks, platform, version, metrics, os_version, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_name = excluded.company_name,
          timestamp = excluded.timestamp,
          overall_status = excluded.overall_status,
          client_reported_status = excluded.client_reported_status,
          central_calculated_health = excluded.central_calculated_health,
          checks = excluded.checks,
          platform = excluded.platform,
          version = excluded.version,
          metrics = excluded.metrics,
          os_version = excluded.os_version
      `).run(
        id,
        report.companyId,
        companyName,
        deviceId,
        timestamp,
        overallStatus,
        clientReportedStatus,
        centralCalculatedHealth,
        checksJson,
        platform,
        version,
        metricsJson,
        version,
        new Date().toISOString()
      );
      return { success: true };
    });
  }

  public upsertOsReleaseTransaction(release: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const id = release.id || `rel_${release.version.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const channel = release.channel || release.releaseChannel || 'stable';
      const status = release.status || 'active';
      const releaseDate = release.releaseDate || release.publishedAt || new Date().toISOString();
      const changelog = release.changelog || release.releaseNotes || '';
      const minRequiredByApps = release.minRequiredByApps || release.minOsVersion || '1.0.0';
      const checksum = release.checksum || '';
      const mandatory = release.mandatory ? 1 : 0;

      this.db!.prepare(`
        INSERT INTO os_releases (
          id, version, channel, release_date, status, changelog,
          min_required_by_apps, checksum, mandatory, release_channel,
          release_notes, published_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(version) DO UPDATE SET
          channel = excluded.channel,
          release_date = excluded.release_date,
          status = excluded.status,
          changelog = excluded.changelog,
          min_required_by_apps = excluded.min_required_by_apps,
          checksum = excluded.checksum,
          mandatory = excluded.mandatory,
          release_channel = excluded.release_channel,
          release_notes = excluded.release_notes,
          published_at = excluded.published_at
      `).run(
        id,
        release.version,
        channel,
        releaseDate,
        status,
        changelog,
        minRequiredByApps,
        checksum,
        mandatory,
        channel,
        changelog,
        releaseDate,
        new Date().toISOString()
      );
      return { success: true };
    });
  }


  public updateStoreAppTransaction(companyId: string, deviceId: string, appId: string, version: string): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const now = new Date().toISOString();
      this.db!.prepare(`
        UPDATE app_installations 
        SET installed_version = ?, status = 'INSTALLED', updated_at = ? 
        WHERE company_id = ? AND (device_id = ? OR device_id = 'default-web-terminal' OR device_id = 'web-client') AND app_id = ?
      `).run(version, now, companyId, deviceId, appId);

      const updatedRow = this.db!.prepare(`
        SELECT * FROM app_installations 
        WHERE company_id = ? AND (device_id = ? OR device_id = 'default-web-terminal' OR device_id = 'web-client') AND app_id = ?
      `).get(companyId, deviceId, appId) as any;

      const installation = updatedRow ? {
        id: updatedRow.id,
        companyId: updatedRow.company_id,
        deviceId: updatedRow.device_id,
        appId: updatedRow.app_id,
        installedVersion: updatedRow.installed_version,
        status: updatedRow.status,
        installedAt: updatedRow.installed_at,
        updatedAt: updatedRow.updated_at
      } : null;

      return { success: true, installation };
    });
  }

  public uninstallStoreAppTransaction(companyId: string, deviceId: string, appId: string): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      this.db!.prepare(`
        DELETE FROM app_installations 
        WHERE company_id = ? AND (device_id = ? OR device_id = 'default-web-terminal' OR device_id = 'web-client') AND app_id = ?
      `).run(companyId, deviceId, appId);

      // If no other device for this tenant has this app installed, remove it from companies.installed_apps
      const remaining = this.db!.prepare(
        "SELECT 1 FROM app_installations WHERE company_id = ? AND app_id = ? AND status = 'INSTALLED'"
      ).get(companyId, appId);
      if (!remaining) {
        const comp = this.db!.prepare("SELECT installed_apps FROM companies WHERE id = ?").get(companyId) as any;
        if (comp) {
          let apps: string[] = JSON.parse(comp.installed_apps || '[]');
          apps = apps.filter(a => a !== appId);
          this.db!.prepare("UPDATE companies SET installed_apps = ? WHERE id = ?").run(JSON.stringify(apps), companyId);
        }
      }

      return { success: true };
    });
  }

  public getTenantInstalledAppIds(companyId: string): string[] {
    if (!this.db) return [];
    const rows = this.db.prepare("SELECT DISTINCT app_id FROM app_installations WHERE company_id = ? AND status = 'INSTALLED'").all(companyId) as { app_id: string }[];
    return rows.map(r => r.app_id);
  }

  public addAppReleaseTransaction(release: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const existing = this.db!.prepare("SELECT id FROM app_releases WHERE app_id = ? AND version = ?").get(release.appId, release.version) as any;
      if (existing) {
        this.db!.prepare(`
          UPDATE app_releases SET
            channel = ?, min_os_version = ?, artifact_id = ?, checksum = ?, signature = ?, status = ?
          WHERE id = ?
        `).run(
          release.channel, release.minOsVersion, release.artifactId || null, release.checksum,
          release.signature || null, release.status || 'PUBLISHED', existing.id
        );
      } else {
        const relId = `rel_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 6)}`;
        this.db!.prepare(`
          INSERT INTO app_releases (id, app_id, version, channel, min_os_version, artifact_id, checksum, signature, released_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          relId, release.appId, release.version, release.channel, release.minOsVersion,
          release.artifactId || null, release.checksum, release.signature || null,
          release.releasedAt || new Date().toISOString(), release.status || 'PUBLISHED'
        );
      }
      return { success: true };
    });
  }

  public getAppReleases(appId: string): any[] {
    if (!this.db) return [];
    try {
      const rows = this.db.prepare("SELECT * FROM app_releases WHERE app_id = ? ORDER BY released_at DESC").all(appId) as any[];
      return rows.map(r => ({
        id: r.id,
        appId: r.app_id,
        version: r.version,
        channel: r.channel,
        minOsVersion: r.min_os_version,
        artifactId: r.artifact_id,
        checksum: r.checksum,
        signature: r.signature,
        releasedAt: r.released_at,
        status: r.status
      }));
    } catch {
      return [];
    }
  }

  public addAppArtifact(id: string, appId: string, version: string, checksum: string, artifactBase64: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(`
      INSERT INTO app_artifacts (id, app_id, version, checksum, artifact_base64, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        app_id = excluded.app_id,
        version = excluded.version,
        checksum = excluded.checksum,
        artifact_base64 = excluded.artifact_base64,
        uploaded_at = excluded.uploaded_at
    `).run(id, appId, version, checksum, artifactBase64, new Date().toISOString());
  }

  public getAppArtifact(id: string): { id: string; appId: string; version: string; checksum: string; artifactBase64: string } | null {
    if (!this.db) return null;
    try {
      const row = this.db.prepare("SELECT * FROM app_artifacts WHERE id = ?").get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        appId: row.app_id,
        version: row.version,
        checksum: row.checksum,
        artifactBase64: row.artifact_base64
      };
    } catch {
      return null;
    }
  }

  public getReleaseByArtifactId(artifactId: string): any | null {
    if (!this.db) return null;
    try {
      const row = this.db.prepare("SELECT * FROM app_releases WHERE artifact_id = ?").get(artifactId) as any;
      if (!row) return null;
      return {
        id: row.id,
        appId: row.app_id,
        version: row.version,
        channel: row.channel,
        minOsVersion: row.min_os_version,
        artifactId: row.artifact_id,
        checksum: row.checksum,
        signature: row.signature,
        releasedAt: row.released_at,
        status: row.status
      };
    } catch {
      return null;
    }
  }

  public getAppArtifactsByAppId(appId: string): { id: string; appId: string; version: string; checksum: string }[] {
    if (!this.db) return [];
    try {
      const rows = this.db.prepare("SELECT id, app_id, version, checksum FROM app_artifacts WHERE app_id = ?").all(appId) as Record<string, unknown>[];
      return rows.map(r => ({
        id: String(r['id']),
        appId: String(r['app_id']),
        version: String(r['version']),
        checksum: String(r['checksum'])
      }));
    } catch {
      return [];
    }
  }

  public revokeToken(token: string, expiresAt: number): void {
    if (!this.db) return;
    try {
      this.db.prepare("INSERT OR REPLACE INTO revoked_tokens (token, expires_at) VALUES (?, ?)").run(token, expiresAt);
    } catch (e) {
      console.error('Error saving revoked token in SQLite:', e);
    }
  }

  public isTokenRevoked(token: string): boolean {
    if (!this.db) return false;
    try {
      const now = Math.floor(Date.now() / 1000);
      const row = this.db.prepare("SELECT expires_at FROM revoked_tokens WHERE token = ?").get(token) as { expires_at?: number } | undefined;
      if (!row) return false;
      if (row.expires_at && row.expires_at < now) {
        this.db.prepare("DELETE FROM revoked_tokens WHERE token = ?").run(token);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  public purgeExpiredRevokedTokens(): void {
    if (!this.db) return;
    try {
      const now = Math.floor(Date.now() / 1000);
      this.db.prepare("DELETE FROM revoked_tokens WHERE expires_at < ?").run(now);
    } catch {
      // ignore
    }
  }

  public getIdempotencyRecord(key: string): { status: string; response: string; processedAt: string } | null {
    if (!this.db) return null;
    try {
      const row = this.db.prepare("SELECT status, response, processed_at FROM idempotency_log WHERE key = ?").get(key) as { status: string; response: string; processed_at: string } | undefined;
      return row ? { status: row.status, response: row.response, processedAt: row.processed_at } : null;
    } catch {
      return null;
    }
  }

  public recordIdempotency(key: string, status: string, response: string): void {
    if (!this.db) return;
    try {
      this.db.prepare(`
        INSERT INTO idempotency_log (key, status, processed_at, response)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          status = excluded.status,
          processed_at = excluded.processed_at,
          response = excluded.response
      `).run(key, status, new Date().toISOString(), response);
    } catch (err) {
      console.warn('[CentralDatabaseEngine] Warning recording idempotency:', err);
    }
  }

}

export const centralDatabase = new CentralDatabaseEngine();
