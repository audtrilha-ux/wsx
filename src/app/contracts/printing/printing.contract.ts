/**
 * 3EATCRU OS - Printing Contracts (Section 8.1 & Section 15)
 * Gestão de spool de impressão, templates térmicos e adaptadores de bobina
 */

export type PrintPaperProfile = '80mm' | '58mm' | 'A4';
export type PrintJobStatus = 'queued' | 'pending' | 'printing' | 'completed' | 'failed' | 'cancelled';

export interface IPrintJob {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly profile: PrintPaperProfile;
  readonly copies: number;
  readonly requestedAt: Date;
  readonly createdAt?: Date;
  readonly status: PrintJobStatus;
  readonly error?: string;
  readonly targetPrinterId?: string;
}

export interface IPrintAdapter {
  readonly name: string;
  readonly isAvailable: boolean;
  print(job: IPrintJob): Promise<boolean>;
  getPaperStatus?(): Promise<'ok' | 'low' | 'out'>;
}

export interface IPrintQueue {
  enqueue(title: string, content: string, profile?: PrintPaperProfile, copies?: number): Promise<IPrintJob>;
  getJobs(): IPrintJob[];
  cancelJob(jobId: string): Promise<boolean>;
  retryJob(jobId: string): Promise<boolean>;
}
