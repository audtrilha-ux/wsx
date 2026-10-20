import { Injectable, inject } from '@angular/core';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { FinanceRepository } from '../domain/finance.repository';
import { CashRegisterSummary, CashTransaction, CreateCashTransactionDto, PaymentMethod, TransactionCategory, TransactionType, CashSession } from '../domain/finance.entity';
import { OsDatabaseNamespace } from '../../../contracts/os/os-database.contract';

interface RawCashTransaction {
  id: string;
  companyId: string;
  type: TransactionType;
  category: TransactionCategory;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  timestamp: string;
  operator?: string;
  performedBy?: string;
  referenceId?: string;
  saleId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OsFinanceRepository implements FinanceRepository {
  private osSdk = inject(OsSdkService);
  private ns: OsDatabaseNamespace;

  constructor() {
    // Vinculação canônica pelo SDK para isolamento de tenant automático (tenant.[companyId].app.app_finance)
    const app = this.osSdk.bind('app_finance');
    this.ns = app.storage;
  }

  async getTransactions(companyId: string, limit?: number): Promise<CashTransaction[]> {
    const items = await this.ns.query<RawCashTransaction>();
    const raw = items.map((i) => i.value).filter((t) => t.companyId === companyId);
    
    // Sort descending by timestamp
    raw.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const limited = limit ? raw.slice(0, limit) : raw;

    return limited.map((t) => new CashTransaction(
      t.id,
      t.companyId,
      t.type || 'INFLOW',
      t.category || 'OTHER',
      t.description || '',
      Number(t.amount) || 0,
      t.paymentMethod || 'DINHEIRO',
      t.timestamp || new Date().toISOString(),
      t.operator || t.performedBy || 'Operador',
      t.referenceId ? String(t.referenceId) : undefined,
      t.saleId ? String(t.saleId) : undefined,
      t.performedBy ? String(t.performedBy) : undefined
    ));
  }

  async createTransaction(transaction: CreateCashTransactionDto): Promise<CashTransaction> {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const id = `tx_${uuid}`;
    const timestamp = new Date().toISOString();
    
    const newTx: RawCashTransaction = {
      id,
      timestamp,
      ...transaction
    };

    await this.ns.put(id, newTx);

    const app = this.osSdk.bind('app_finance');
    app.events.publish('finance.transaction.created', newTx);
    await app.sync.queueOperation('finance.transaction', newTx);
    app.logger.info(`Transação financeira #${id} registrada com sucesso`, { amount: newTx.amount, type: newTx.type });

    return new CashTransaction(
      newTx.id,
      newTx.companyId,
      newTx.type,
      newTx.category,
      newTx.description,
      newTx.amount,
      newTx.paymentMethod,
      newTx.timestamp,
      newTx.operator || newTx.performedBy || 'Operador',
      newTx.referenceId,
      newTx.saleId,
      newTx.performedBy
    );
  }

  async getCashSummary(companyId: string): Promise<CashRegisterSummary> {
    const items = await this.ns.query<RawCashTransaction>();
    const raw = items.map((i) => i.value).filter((t) => t.companyId === companyId);

    const summary: CashRegisterSummary = {
      currentCashBalance: 0,
      totalInflow: 0,
      totalOutflow: 0,
      totalBleed: 0,
      totalSupply: 0,
      salesCount: 0,
      breakdownByMethod: {
        dinheiro: 0,
        pix: 0,
        cartaoCredito: 0,
        cartaoDebito: 0
      }
    };

    for (const t of raw) {
      const amount = Number(t.amount) || 0;
      const type = t.type;
      const category = t.category;
      const paymentMethod = t.paymentMethod;

      // Classificação canônica e correta dos fluxos de caixa de acordo com a taxonomia real
      if (type === 'INFLOW' || type === 'CASH_IN' || type === 'INCOME') {
        summary.totalInflow += amount;
      } else if (type === 'OUTFLOW' || type === 'CASH_OUT' || type === 'EXPENSE') {
        summary.totalOutflow += amount;
      } else {
        // Fallback genérico para outros tipos imprevistos
        summary.totalOutflow += amount;
      }
      
      if (category === 'BLEED') {
        summary.totalBleed += amount;
      } else if (category === 'SUPPLY') {
        summary.totalSupply += amount;
      } else if (category === 'SALE') {
        summary.salesCount++;
      }

      if (paymentMethod === 'DINHEIRO') summary.breakdownByMethod.dinheiro += amount;
      else if (paymentMethod === 'PIX') summary.breakdownByMethod.pix += amount;
      else if (paymentMethod === 'CARTAO_CREDITO') summary.breakdownByMethod.cartaoCredito += amount;
      else if (paymentMethod === 'CARTAO_DEBITO') summary.breakdownByMethod.cartaoDebito += amount;
    }

    summary.currentCashBalance = summary.totalInflow - summary.totalOutflow;

    return summary;
  }

  async getActiveSession(companyId: string): Promise<CashSession | null> {
    const items = await this.ns.query<CashSession>();
    const active = items
      .map(i => i.value)
      .find(s => s && s.companyId === companyId && s.status === 'open' && s.id.startsWith('session_'));
    return active || null;
  }

  async openSession(companyId: string, operator: string, terminalId: string, openingBalance: number): Promise<CashSession> {
    const active = await this.getActiveSession(companyId);
    if (active) {
      throw new Error('Já existe uma sessão de caixa aberta para esta filial.');
    }

    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const id = `session_${uuid}`;
    const session: CashSession = {
      id,
      companyId,
      operator,
      terminalId,
      status: 'open',
      openingTime: new Date().toISOString(),
      openingBalance,
      conciliated: false
    };

    await this.ns.put(id, session);

    const app = this.osSdk.bind('app_finance');
    app.events.publish('finance.session.opened', session);
    await app.sync.queueOperation('finance.session.open', session);
    app.logger.info(`Sessão de caixa aberta com sucesso: #${id}`, { operator, openingBalance });

    return session;
  }

  async closeSession(sessionId: string, closingBalance: number, calculatedBalance: number): Promise<CashSession> {
    const session = await this.ns.get<CashSession>(sessionId);
    if (!session) {
      throw new Error(`Sessão de caixa #${sessionId} não encontrada.`);
    }

    const closed: CashSession = {
      ...session,
      status: 'closed',
      closingTime: new Date().toISOString(),
      closingBalance,
      calculatedBalance,
      difference: closingBalance - calculatedBalance
    };

    await this.ns.put(sessionId, closed);

    const app = this.osSdk.bind('app_finance');
    app.events.publish('finance.session.closed', closed);
    await app.sync.queueOperation('finance.session.close', closed);
    app.logger.info(`Sessão de caixa fechada: #${sessionId}`, { closingBalance, difference: closed.difference });

    return closed;
  }

  async conciliateSession(sessionId: string): Promise<CashSession> {
    const session = await this.ns.get<CashSession>(sessionId);
    if (!session) {
      throw new Error(`Sessão de caixa #${sessionId} não encontrada.`);
    }

    const conciliated: CashSession = {
      ...session,
      conciliated: true,
      conciliatedAt: new Date().toISOString()
    };

    await this.ns.put(sessionId, conciliated);

    const app = this.osSdk.bind('app_finance');
    app.events.publish('finance.session.conciliated', conciliated);
    await app.sync.queueOperation('finance.session.conciliate', conciliated);
    app.logger.info(`Sessão de caixa conciliada: #${sessionId}`);

    return conciliated;
  }

  async getAllSessions(companyId: string): Promise<CashSession[]> {
    const items = await this.ns.query<CashSession>();
    const list = items
      .map(i => i.value)
      .filter(s => s && s.companyId === companyId && s.id.startsWith('session_'));
    
    list.sort((a, b) => new Date(b.openingTime).getTime() - new Date(a.openingTime).getTime());
    return list;
  }
}
