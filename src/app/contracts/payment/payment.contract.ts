export type PaymentMethodType = 'credit_card' | 'debit_card' | 'pix' | 'cash' | 'tef' | 'voucher';

export type PaymentIntentStatus =
  | 'created'
  | 'processing'
  | 'authorized'
  | 'captured'
  | 'canceled'
  | 'failed'
  | 'refunded';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  method: PaymentMethodType;
  status: PaymentIntentStatus;
  idempotencyKey: string;
  tenantId: string;
  appId?: string;
  externalReference?: string;
  qrCodePix?: string;
  pixCopiaECola?: string;
  tefTransactionId?: string;
  nsu?: string;
  authorizationCode?: string;
  createdAt: string;
  updatedAt: string;
  errorDetails?: string;
}

export interface PaymentAdapterResult {
  success: boolean;
  status: PaymentIntentStatus;
  tefTransactionId?: string;
  nsu?: string;
  authorizationCode?: string;
  qrCodePix?: string;
  pixCopiaECola?: string;
  errorDetails?: string;
}

export interface IPaymentService {
  createIntent(
    amount: number,
    method: PaymentMethodType,
    idempotencyKey: string,
    appId?: string,
    externalReference?: string
  ): Promise<PaymentIntent>;

  authorizeIntent(intentId: string): Promise<PaymentIntent>;
  captureIntent(intentId: string): Promise<PaymentIntent>;
  cancelIntent(intentId: string, reason?: string): Promise<PaymentIntent>;
  refundIntent(intentId: string, reason?: string): Promise<PaymentIntent>;
  getIntent(intentId: string): Promise<PaymentIntent | null>;
  reconcileIntents(): Promise<{ totalReconciled: number; pendingCount: number }>;
}
