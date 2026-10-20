export type TransactionType = 'INFLOW' | 'OUTFLOW' | 'CASH_IN' | 'CASH_OUT' | 'INCOME' | 'EXPENSE';
export type PaymentMethodType = 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO' | 'CASH' | 'DEBIT' | 'CREDIT';
export type PaymentMethod = PaymentMethodType;
export type TransactionCategory = 'SALE' | 'SUPPLY' | 'BLEED' | 'EXPENSE' | 'BILL' | 'OTHER' | string;

export class CashTransaction {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly type: TransactionType,
    public readonly category: TransactionCategory,
    public readonly description: string,
    public readonly amount: number,
    public readonly paymentMethod: PaymentMethod,
    public readonly timestamp: string,
    public readonly operator = 'Operador',
    public readonly referenceId?: string,
    public readonly saleId?: string,
    public readonly performedBy?: string
  ) {}

  isIncome(): boolean {
    return this.type === 'INFLOW' || this.type === 'CASH_IN' || this.type === 'INCOME';
  }

  isExpense(): boolean {
    return this.type === 'OUTFLOW' || this.type === 'CASH_OUT' || this.type === 'EXPENSE';
  }
}

export type CreateCashTransactionDto = Omit<CashTransaction, 'id' | 'timestamp' | 'isIncome' | 'isExpense'>;

export interface CashRegisterSummary {
  currentCashBalance: number;
  totalInflow: number;
  totalOutflow: number;
  totalBleed: number;
  totalSupply: number;
  salesCount: number;
  breakdownByMethod: {
    dinheiro: number;
    pix: number;
    cartaoCredito: number;
    cartaoDebito: number;
  };
  openingBalance?: number;
  currentBalance?: number;
  totalIncome?: number;
  totalExpense?: number;
  totalCashIn?: number;
  totalCashOut?: number;
  transactionCount?: number;
  byPaymentMethod?: {
    DINHEIRO?: number;
    PIX?: number;
    CARTAO_DEBITO?: number;
    CARTAO_CREDITO?: number;
  };
}

export type CashSummary = CashRegisterSummary;

export interface CashSession {
  id: string;
  companyId: string;
  operator: string;
  terminalId: string;
  status: 'open' | 'closed';
  openingTime: string;
  closingTime?: string;
  openingBalance: number;
  closingBalance?: number;
  calculatedBalance?: number;
  difference?: number;
  conciliated: boolean;
  conciliatedAt?: string;
}


