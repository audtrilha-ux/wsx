// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import express from 'express';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { centralDatabase, centralState } from '../state.js';
import { simulationRouter, runFullSimulation, executeCleanReset } from '../routes/simulation.js';

describe('3eatcru Business OS — Ecosystem Simulation E2E Suite (Company Creation, Stock, Sales, Multi-Tenant)', () => {
  const TEST_DB = join(process.cwd(), 'data', 'test_ecosystem_simulation_e2e.db');
  let app: express.Express;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  const cleanupDb = () => {
    try {
      if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    } catch {
      // Ignored
    }
  };

  beforeEach(() => {
    cleanupDb();
    centralDatabase.init(TEST_DB);

    app = express();
    app.set('trust proxy', 1);
    app.use(express.json());

    const api = express.Router();
    api.use('/simulation', simulationRouter);
    app.use('/api/v1', api);

    server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
    centralDatabase.close();
    cleanupDb();
  });

  it('SIM-01: Deve executar o reset limpo da base mantendo tabelas e esquemas íntegros', () => {
    const reset = executeCleanReset();
    expect(reset.success).toBe(true);
    expect(centralState.companies.size).toBe(0);
    expect(centralState.products.size).toBe(0);
    expect(centralState.sales.size).toBe(0);
    expect(centralState.plans.length).toBeGreaterThanOrEqual(3);
  });

  it('SIM-02: Deve executar a simulação completa de ponta a ponta com sucesso absoluto', () => {
    const report = runFullSimulation();

    // 1. Verificações de Execução e Performance
    expect(report.success).toBe(true);
    expect(report.durationMs).toBeGreaterThan(0);
    expect(report.logs.length).toBeGreaterThan(5);

    // 2. Verificação das Empresas Criadas
    expect(report.summary.companiesCreated).toBe(2);
    expect(centralState.companies.has('comp_sim_retail')).toBe(true);
    expect(centralState.companies.has('comp_sim_restaurant')).toBe(true);

    const retail = centralState.companies.get('comp_sim_retail')!;
    const restaurant = centralState.companies.get('comp_sim_restaurant')!;

    expect(retail.name).toBe('Londrina Confecções & Varejo');
    expect(retail.branches?.length).toBe(2);
    expect(restaurant.name).toBe('Bistrô & Trattoria Londrina');
    expect(restaurant.branches?.length).toBe(1);

    // 3. Verificação do Povoamento de Estoque e Ajustes
    expect(report.summary.productsCataloged).toBe(12);
    expect(report.summary.inventoryAdjustments).toBe(3);

    const camisaSlim = centralState.products.get('prod_ret_1')!;
    const calcaJeans = centralState.products.get('prod_ret_2')!;
    const vinhoReserva = centralState.products.get('prod_res_5')!;
    const risotto = centralState.products.get('prod_res_1')!;

    // Camisa Slim: Inicial 50 + 20 reposição - 2 venda 1 = 68
    expect(camisaSlim.stock).toBe(68);
    // Calça Jeans: Inicial 35 - 2 avaria = 33
    expect(calcaJeans.stock).toBe(33);
    // Vinho Reserva: Inicial 48 + 12 adega - 2 mesa 4 = 58
    expect(vinhoReserva.stock).toBe(58);
    // Risotto Funghi: Inicial 40 - 2 mesa 4 = 38
    expect(risotto.stock).toBe(38);

    // 4. Verificação de Vendas e Faturamento
    expect(report.summary.salesProcessed).toBe(3);
    const expectedRevenue = 249.70 + 194.80 + 286.00;
    expect(report.summary.totalRevenueGenerated).toBeCloseTo(expectedRevenue, 2);

    // 5. Verificação de Invariantes Financeiras e Caixa
    const transactions = Array.from(centralState.financeTransactions.values());
    expect(transactions.length).toBe(3);
    const totalTransactions = transactions.reduce((acc, t) => acc + t.amount, 0);
    expect(totalTransactions).toBeCloseTo(expectedRevenue, 2);

    // 6. Verificação do Ciclo de Mesas e KDS no Restaurante
    const table4 = centralState.tables.get('tbl_4')!;
    expect(table4.status).toBe('AVAILABLE');
    expect(table4.currentOrder).toBeUndefined();

    // 7. Verificação de Fidelidade no CRM
    const retailCustomer = centralState.customers.get('cust_ret_1')!;
    expect(retailCustomer.points).toBe(39); // 15 + 24
    expect(retailCustomer.totalSpent).toBeCloseTo(420.00 + 249.70, 2);

    const restCustomer = centralState.customers.get('cust_res_1')!;
    expect(restCustomer.points).toBe(68); // 40 + 28
    expect(restCustomer.totalSpent).toBeCloseTo(1250.00 + 286.00, 2);

    // 8. Verificação de Todas as Asserções
    expect(report.verifications.every(v => v.passed)).toBe(true);
  });

  it('SIM-03: Endpoint HTTP POST /api/v1/simulation/run deve retornar telemetria e código 200', async () => {
    const res = await fetch(`${baseUrl}/simulation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    expect(res.status).toBe(200);
    const body = await res.json() as ReturnType<typeof runFullSimulation>;
    expect(body.success).toBe(true);
    expect(body.summary.companiesCreated).toBe(2);
    expect(body.summary.salesProcessed).toBe(3);
    expect(body.tenants.retail.id).toBe('comp_sim_retail');
    expect(body.tenants.restaurant.id).toBe('comp_sim_restaurant');
  });

  it('SIM-04: Endpoint HTTP GET /api/v1/simulation/status deve retornar contagens e dados das empresas', async () => {
    // Executa a simulação primeiro
    runFullSimulation();

    const res = await fetch(`${baseUrl}/simulation/status`);
    expect(res.status).toBe(200);
    const status = await res.json() as { active: boolean; state: { companiesCount: number; productsCount: number }; simulationTenants: { retail: { id: string } } };
    expect(status.active).toBe(true);
    expect(status.state.companiesCount).toBe(2);
    expect(status.state.productsCount).toBe(12);
    expect(status.simulationTenants.retail.id).toBe('comp_sim_retail');
  });
});
