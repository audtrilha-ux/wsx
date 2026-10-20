import { Injectable, inject } from '@angular/core';
import { OsFinanceRepository } from '../infrastructure/os-finance.repository';
import { CashRegisterSummary, CashTransaction, CreateCashTransactionDto, CashSession } from '../domain/finance.entity';

@Injectable({
  providedIn: 'root'
})
export class GetTransactionsUseCase {
  private repo = inject(OsFinanceRepository);
  execute(companyId: string, limit?: number): Promise<CashTransaction[]> {
    return this.repo.getTransactions(companyId, limit);
  }
}

@Injectable({
  providedIn: 'root'
})
export class CreateTransactionUseCase {
  private repo = inject(OsFinanceRepository);
  execute(transaction: CreateCashTransactionDto): Promise<CashTransaction> {
    return this.repo.createTransaction(transaction);
  }
}

@Injectable({
  providedIn: 'root'
})
export class GetCashSummaryUseCase {
  private repo = inject(OsFinanceRepository);
  execute(companyId: string): Promise<CashRegisterSummary> {
    return this.repo.getCashSummary(companyId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class GetActiveSessionUseCase {
  private repo = inject(OsFinanceRepository);
  execute(companyId: string): Promise<CashSession | null> {
    return this.repo.getActiveSession(companyId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class OpenSessionUseCase {
  private repo = inject(OsFinanceRepository);
  execute(companyId: string, operator: string, terminalId: string, openingBalance: number): Promise<CashSession> {
    return this.repo.openSession(companyId, operator, terminalId, openingBalance);
  }
}

@Injectable({
  providedIn: 'root'
})
export class CloseSessionUseCase {
  private repo = inject(OsFinanceRepository);
  execute(sessionId: string, closingBalance: number, calculatedBalance: number): Promise<CashSession> {
    return this.repo.closeSession(sessionId, closingBalance, calculatedBalance);
  }
}

@Injectable({
  providedIn: 'root'
})
export class ConciliateSessionUseCase {
  private repo = inject(OsFinanceRepository);
  execute(sessionId: string): Promise<CashSession> {
    return this.repo.conciliateSession(sessionId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class GetAllSessionsUseCase {
  private repo = inject(OsFinanceRepository);
  execute(companyId: string): Promise<CashSession[]> {
    return this.repo.getAllSessions(companyId);
  }
}

