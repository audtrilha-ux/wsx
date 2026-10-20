// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CentralDatabaseEngine } from './central-db.js';

describe('Sync Public Space Unit of Work & Transaction Suite', () => {
  let dbEngine: CentralDatabaseEngine;

  beforeEach(() => {
    // In-memory isolated database instance
    dbEngine = new CentralDatabaseEngine(':memory:');
    // Ensure company exists for foreign key constraint
    const stmt = dbEngine.getRawDatabase()?.prepare(`
      INSERT INTO companies (id, name, slug, balance, status, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt?.run('comp_1', 'Empresa 1', 'empresa-1', 100, 'active', 'pro');
    stmt?.run('comp_2', 'Empresa 2', 'empresa-2', 100, 'active', 'pro');
  });

  afterEach(() => {
    dbEngine.close();
  });

  it('should apply public space updates atomically via applySyncBatchTransaction in SQLite', () => {
    const companyId = 'comp_1';
    const testPublicSpace = {
      companyId,
      companySlug: 'pizzaria-sabor',
      title: 'Pizzaria Sabor Artesanal',
      description: 'A melhor pizza artesanal da região',
      logo: 'https://img.test/logo.png',
      templateId: 'restaurant',
      themeColor: '#e11d48',
      status: 'published',
      publishedAt: new Date().toISOString(),
      phone: '11999998888',
      email: 'contato@pizzariasabor.com.br',
      address: 'Rua das Flores, 123',
      hours: 'Terça a Domingo 18:00 - 23:30',
      products: [
        { name: 'Pizza Margherita', price: 49.9, desc: 'Molho pelado, mussarela de búfala e manjericão fresco' }
      ]
    };

    const result = dbEngine.applySyncBatchTransaction({
      publicSpaces: [testPublicSpace]
    });

    expect(result.success).toBe(true);

    // Verify row directly in SQLite
    const row = dbEngine.getRawDatabase()?.prepare('SELECT * FROM public_spaces WHERE company_id = ?').get(companyId) as Record<string, unknown> | undefined;
    expect(row).toBeDefined();
    expect(row?.['company_id']).toBe(companyId);
    expect(row?.['company_slug']).toBe('pizzaria-sabor');
    expect(row?.['title']).toBe('Pizzaria Sabor Artesanal');
    expect(row?.['status']).toBe('published');
  });

  it('should update existing public space on conflict idempotently', () => {
    const companyId = 'comp_2';
    const initialSpace = {
      companyId,
      companySlug: 'loja-inicial',
      title: 'Loja Inicial',
      description: 'Desc',
      status: 'draft'
    };

    dbEngine.applySyncBatchTransaction({
      publicSpaces: [initialSpace]
    });

    const updatedSpace = {
      companyId,
      companySlug: 'loja-atualizada',
      title: 'Loja Oficial Atualizada',
      description: 'Desc Atualizada',
      status: 'published'
    };

    const updateResult = dbEngine.applySyncBatchTransaction({
      publicSpaces: [updatedSpace]
    });

    expect(updateResult.success).toBe(true);

    const row = dbEngine.getRawDatabase()?.prepare('SELECT * FROM public_spaces WHERE company_id = ?').get(companyId) as Record<string, unknown> | undefined;
    expect(row?.['title']).toBe('Loja Oficial Atualizada');
    expect(row?.['status']).toBe('published');
    expect(row?.['company_slug']).toBe('loja-atualizada');
  });
});
