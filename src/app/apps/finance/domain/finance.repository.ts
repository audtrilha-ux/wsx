import { CashRegisterSummary, CashSummary, CashTransaction, CreateCashTransactionDto, CashSession } from './finance.entity';

export type { CashSummary, CreateCashTransactionDto };

export interface FinanceRepository {
  getTransactions(companyId: string, limit?: number): Promise<CashTransaction[]>;
  createTransaction(transaction: CreateCashTransactionDto): Promise<CashTransaction>;
  getCashSummary(companyId: string): Promise<CashRegisterSummary>;
  
  // Cash Session Capabilities
  getActiveSession(companyId: string): Promise<CashSession | null>;
  openSession(companyId: string, operator: string, terminalId: string, openingBalance: number): Promise<CashSession>;
  closeSession(sessionId: string, closingBalance: number, calculatedBalance: number): Promise<CashSession>;
  conciliateSession(sessionId: string): Promise<CashSession>;
  getAllSessions(companyId: string): Promise<CashSession[]>;
}
