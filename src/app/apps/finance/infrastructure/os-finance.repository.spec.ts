import { TestBed } from '@angular/core/testing';
import { OsFinanceRepository } from './os-finance.repository';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { OsDatabaseTransaction } from '../../../contracts/os/os-database.contract';

interface MockEvent {
  eventName: string;
  payload: unknown;
}

interface MockOp {
  action: string;
  payload: unknown;
}

describe('OsFinanceRepository (Cash Sessions)', () => {
  let repository: OsFinanceRepository;
  let publishedEvents: MockEvent[] = [];
  let queuedOperations: MockOp[] = [];

  beforeEach(() => {
    publishedEvents = [];
    queuedOperations = [];

    // Memory Store simulator
    const store = new Map<string, unknown>();

    const mockStorage = {
      namespace: 'test_fin',
      get: async <T = unknown>(key: string): Promise<T | null> => {
        return (store.get(key) as T) || null;
      },
      put: async <T = unknown>(key: string, value: T): Promise<void> => {
        store.set(key, value);
      },
      delete: async (key: string): Promise<void> => {
        store.delete(key);
      },
      query: async <T = unknown>(): Promise<{ key: string; value: T }[]> => {
        return Array.from(store.entries()).map(([key, value]) => ({ key, value: value as T }));
      },
      clear: async (): Promise<void> => {
        store.clear();
      },
      transaction: async <R>(callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R> => {
        const tx: OsDatabaseTransaction = {
          get: async <T = unknown>(key: string): Promise<T | null> => {
            return (store.get(key) as T) || null;
          },
          put: async <T = unknown>(key: string, value: T): Promise<void> => {
            store.set(key, value);
          },
          delete: async (key: string): Promise<void> => {
            store.delete(key);
          }
        };
        return callback(tx);
      }
    };

    const mockOsSdk = {
      bind: () => ({
        companyId: 'comp_1',
        companyName: 'Test Company',
        isOnline: true,
        storage: mockStorage,
        events: {
          publish: (eventName: string, payload: unknown) => {
            publishedEvents.push({ eventName, payload });
          },
          subscribe: () => {
            return { unsubscribe: () => 'noop' };
          }
        },
        sync: {
          queueOperation: async (action: string, payload: unknown) => {
            queuedOperations.push({ action, payload });
          }
        },
        logger: {
          info: (msg: string) => msg,
          error: (msg: string) => msg
        },
        notify: () => 'noop'
      })
    };

    TestBed.configureTestingModule({
      providers: [
        OsFinanceRepository,
        { provide: OsSdkService, useValue: mockOsSdk }
      ]
    });

    repository = TestBed.inject(OsFinanceRepository);
  });

  it('should open a new cash session with correct operator details and opening balance', async () => {
    const session = await repository.openSession('comp_1', 'Claudio Operador', 'CAIXA_02', 150.00);

    expect(session.id.startsWith('session_')).toBe(true);
    expect(session.status).toBe('open');
    expect(session.operator).toBe('Claudio Operador');
    expect(session.openingBalance).toBe(150.00);
    expect(session.conciliated).toBe(false);

    const active = await repository.getActiveSession('comp_1');
    expect(active).toBeTruthy();
    expect(active?.operator).toBe('Claudio Operador');
  });

  it('should prevent opening another active cash session if one is already open', async () => {
    await repository.openSession('comp_1', 'Claudio Operador', 'CAIXA_02', 150.00);

    let error: Error | null = null;
    try {
      await repository.openSession('comp_1', 'Gerente Operador', 'CAIXA_02', 200.00);
    } catch (err: unknown) {
      error = err as Error;
    }

    expect(error).toBeTruthy();
    expect(error?.message).toContain('Já existe uma sessão de caixa aberta');
  });

  it('should close active cash session, calculate estimated balance, and register divergence', async () => {
    const session = await repository.openSession('comp_1', 'Claudio Operador', 'CAIXA_02', 100.00);

    // Close with R$ 120,00 physically counted. Calculated estimate is R$ 100,00 (no sales).
    const closed = await repository.closeSession(session.id, 120.00, 100.00);

    expect(closed.status).toBe('closed');
    expect(closed.closingTime).toBeTruthy();
    expect(closed.closingBalance).toBe(120.00);
    expect(closed.calculatedBalance).toBe(100.00);
    expect(closed.difference).toBe(20.00); // R$ 20.00 surplus / sobra

    const active = await repository.getActiveSession('comp_1');
    expect(active).toBeNull();
  });

  it('should audit and conciliate closed sessions successfully', async () => {
    const session = await repository.openSession('comp_1', 'Claudio', 'CAIXA_01', 50.00);
    const closed = await repository.closeSession(session.id, 45.00, 50.00); // R$ 5,00 deficit / quebra

    const audited = await repository.conciliateSession(closed.id);
    expect(audited.conciliated).toBe(true);
    expect(audited.conciliatedAt).toBeTruthy();

    const all = await repository.getAllSessions('comp_1');
    expect(all.length).toBe(1);
    expect(all[0].conciliated).toBe(true);
  });
});
