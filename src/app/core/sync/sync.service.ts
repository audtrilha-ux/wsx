import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DeviceService } from '../device/device.service';
import { IdentityService } from '../identity/identity.service';
import { OsDatabaseService } from '../storage/os-database.service';
import { OsDatabaseNamespace, OsDatabaseTransaction } from '../../contracts/os/os-database.contract';
import { ISyncEngine, IConflictResolver } from '../../contracts/sync/sync.contract';
import { ConflictResolverService } from './conflict-resolver.service';

export interface OutboxOperation {
  id: string;
  idempotencyKey: string;
  tenantId: string;
  deviceId?: string;
  branchId?: string;
  appId?: string;
  action: string;
  payload: unknown;
  
  timestamp: string;
  status: 'pending' | 'processing' | 'failed' | 'dead_letter' | 'acknowledged';
  retryCount?: number;
  lastError?: string;
  nextRetryAt?: number;
  processingAt?: string;
  leaseUntil?: number;
}

interface SyncBatchResponse {
  success: boolean;
  processedCount: number;
  failedCount: number;
  rolledBack?: boolean;
  serverTimestamp: string;
  acks: {
    opId: string;
    idempotencyKey: string;
    status: 'ACK' | 'DUPLICATE' | 'FAILED';
    error?: string;
    serverTimestamp: string;
  }[];
}

const MAX_OUTBOX_RETRIES = 5;
const MAX_BACKOFF_MS = 120000;
const LEASE_DURATION_MS = 60000; // 60-second processing lease

@Injectable({
  providedIn: 'root'
})
export class SyncService implements ISyncEngine {
  private http = inject(HttpClient);
  private deviceService = inject(DeviceService);
  private identityService = inject(IdentityService);
  private osDb = inject(OsDatabaseService);
  private conflictResolver = inject(ConflictResolverService);

  private customResolvers = new Map<string, IConflictResolver>();

  readonly syncStatus = signal<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  readonly lastSyncedAt = signal<Date | null>(new Date());
  readonly outbox = signal<OutboxOperation[]>([]);

  // 3-Level Connectivity Diagnostics
  readonly networkOnline = signal<boolean>(typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true);
  readonly serverReachable = signal<boolean>(true);
  readonly isOnline = computed(() => this.networkOnline() && this.serverReachable());
  readonly deadLetterCount = computed(() => this.outbox().filter(op => op.status === 'dead_letter').length);
  readonly syncHealthy = computed(() => this.syncStatus() !== 'error' && this.deadLetterCount() === 0 && this.isOnline());

  // Computados e getters de conformidade com ISyncEngine
  readonly pendingCountSignal = computed(() => this.outbox().filter(op => op.status === 'pending' || op.status === 'failed').length);
  readonly isSyncingSignal = computed(() => this.syncStatus() === 'syncing');

  get pendingCount(): number {
    return this.pendingCountSignal();
  }

  get isSyncing(): boolean {
    return this.isSyncingSignal();
  }

  private get syncDb(): OsDatabaseNamespace {
    const tenantId = this.identityService.currentTenant()?.tenantId || this.deviceService.deviceState().companyId;
    return this.osDb.getNamespace(tenantId ? `tenant.${tenantId}.system.sync` : 'system.sync');
  }

  constructor() {
    // Listen to identity changes to reload outbox for the correct tenant
    effect(() => {
      // Trigger effect dependency when tenant changes
      this.identityService.currentTenant();
      this.loadPersistedOutbox();
    });

    if (typeof window !== 'undefined') {
      this.networkOnline.set(navigator.onLine ?? true);
      window.addEventListener('online', () => {
        this.networkOnline.set(true);
        this.sync().catch(err => console.warn('[SyncService] Auto-sync após reconexão falhou:', err));
      });
      window.addEventListener('offline', () => {
        this.networkOnline.set(false);
        this.syncStatus.set('idle');
      });
    }
  }

  async loadPersistedOutbox(): Promise<void> {
    try {
      this.outbox.set([]); // Clear current outbox before loading new one
      const items = await this.syncDb.query<OutboxOperation>();
      const outboxItems = items.filter(i => i.key.startsWith('outbox_')).map(i => i.value);
      
      const now = Date.now();
      let recoveredAny = false;
      const recoveredItems = await Promise.all(outboxItems.map(async op => {
        // Recovery of hung processing or expired lease
        if (op.status === 'processing' && (!op.leaseUntil || op.leaseUntil <= now)) {
          console.warn(`[SyncService] Recuperando operação com lease expirado: ${op.id}. Resetando de 'processing' para 'pending'.`);
          const recoveredOp: OutboxOperation = {
            ...op,
            status: 'pending',
            leaseUntil: undefined,
            processingAt: undefined
          };
          await this.syncDb.put(`outbox_${op.id}`, recoveredOp);
          recoveredAny = true;
          return recoveredOp;
        }
        return op;
      }));

      if (recoveredItems.length > 0) {
        this.outbox.set(recoveredItems);
        
        // Se recuperou alguma operação travada, dispara sync automático para escoar a fila
        if (recoveredAny && this.isOnline()) {
          this.sync().catch(err => console.warn('[SyncService] Falha ao sincronizar após recuperação de crash:', err));
        }
      }
    } catch (err) {
      console.warn('[SyncService] Falha ao recuperar Outbox persistida:', err);
    }
  }

  registerConflictResolver<T>(entityName: string, resolver: IConflictResolver<T>): void {
    this.customResolvers.set(entityName, resolver as IConflictResolver);
  }

  getResolver(entityName: string): IConflictResolver {
    return this.customResolvers.get(entityName) || this.conflictResolver;
  }

  /**
   * Enfilera uma operação diretamente dentro de uma transação de banco ativa.
   * Garante atomicidade física absoluta (ACID) entre a gravação do dado e a intenção de sincronismo.
   */
  async queueOperationTransacted(
    tx: OsDatabaseTransaction,
    action: string,
    payload: unknown,
    appId?: string
  ): Promise<void> {
    const tenantId = this.identityService.currentTenant()?.tenantId || this.deviceService.deviceState().companyId;
    if (!tenantId) {
      throw new Error('[SyncService] Não é possível enfileirar operação transacionada sem contexto de empresa ativo.');
    }

    const deviceState = this.deviceService.deviceState();
    const randSuffix = Math.random().toString(36).substring(2, 10);
    const idempSuffix = Math.random().toString(36).substring(2, 14);

    const newOp: OutboxOperation = {
      id: `op_${Date.now()}_${randSuffix}`,
      idempotencyKey: `idemp_${Date.now()}_${idempSuffix}`,
      tenantId,
      deviceId: deviceState.deviceId || undefined,
      branchId: deviceState.branchId || undefined,
      appId,
      action,
      payload,
      timestamp: new Date().toISOString(),
      status: 'pending',
      retryCount: 0
    };

    const targetNs = `tenant.${tenantId}.system.sync`;
    await tx.put(`outbox_${newOp.id}`, newOp, targetNs);

    // Atualiza estado reativo em memória
    this.outbox.update(list => [...list, newOp]);
  }

  /**
   * Garante a trinca indivisível ACID: [Estado Local + Outbox + Event Log]
   * Gravados de forma atômica na mesma transação de banco.
   */
  async queueOperationTransactedWithEvent(
    tx: OsDatabaseTransaction,
    action: string,
    payload: unknown,
    eventPayload?: Record<string, unknown>,
    appId?: string
  ): Promise<void> {
    const tenantId = this.identityService.currentTenant()?.tenantId || this.deviceService.deviceState().companyId;
    if (!tenantId) {
      throw new Error('[SyncService] Não é possível enfileirar operação transacionada sem contexto de empresa ativo.');
    }

    await this.queueOperationTransacted(tx, action, payload, appId);

    const eventRecord = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      action,
      payload: eventPayload || payload,
      timestamp: new Date().toISOString(),
      tenantId
    };

    const eventsNs = `tenant.${tenantId}.system.events`;
    await tx.put(`event_${eventRecord.id}`, eventRecord, eventsNs);
  }

  /**
   * Replay seguro de operações não confirmadas ou retidas na outbox
   */
  async replayUnacknowledged(): Promise<number> {
    const pendingOps = this.outbox().filter(op => op.status === 'pending' || op.status === 'failed');
    if (pendingOps.length === 0) return 0;

    console.log(`[SyncService] Reexecutando replay seguro para ${pendingOps.length} operações não confirmadas...`);
    await this.sync();
    return pendingOps.length;
  }

  /**
   * Reconciliação completa do estado local por domínio aplicando resolução de conflitos
   */
  async reconcileDomainState<T extends { id: string; version?: number; updatedAt?: string }>(
    domainName: string,
    remoteRecords: T[],
    strategy: 'append-only' | 'last-write-wins' | 'crdt' = 'last-write-wins'
  ): Promise<void> {
    const tenantId = this.identityService.currentTenant()?.tenantId || this.deviceService.deviceState().companyId;
    if (!tenantId) return;

    const ns = this.osDb.getNamespace(`tenant.${tenantId}.${domainName}`);
    const localEntries = await ns.query<T>();
    const localMap = new Map(localEntries.map(e => [e.key, e.value]));
    const resolver = this.getResolver(domainName);

    await ns.transaction(async (tx) => {
      for (const remote of remoteRecords) {
        const local = localMap.get(remote.id);
        if (!local) {
          await tx.put(remote.id, remote);
        } else {
          const resolved = resolver.resolve(local, remote, strategy) as T;
          await tx.put(remote.id, resolved);
        }
      }
    });

    console.log(`[SyncService] Reconciliação do domínio '${domainName}' concluída (${remoteRecords.length} registros analisados).`);
  }

  async queueOperation(action: string, payload: unknown, appId?: string): Promise<void> {
    const tenantId = this.identityService.currentTenant()?.tenantId || this.deviceService.deviceState().companyId;
    if (!tenantId) {
      console.warn('[SyncService] Cannot queue operation without active tenant context');
      return;
    }

    const deviceState = this.deviceService.deviceState();
    const randSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').substring(0, 8) : Math.random().toString(36).substring(2, 7);
    const idempSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').substring(0, 12) : Math.random().toString(36).substring(2, 9);
    const newOp: OutboxOperation = {
      id: `op_${Date.now()}_${randSuffix}`,
      idempotencyKey: `idemp_${Date.now()}_${idempSuffix}`,
      tenantId,
      deviceId: deviceState.deviceId || undefined,
      branchId: deviceState.branchId || undefined,
      appId,
      action,
      payload,
      
      timestamp: new Date().toISOString(),
      status: 'pending',
      retryCount: 0
    };

    // Atualiza estado reativo e persiste na base local
    this.outbox.update(list => [...list, newOp]);
    await this.syncDb.put(`outbox_${newOp.id}`, newOp);
    this.syncStatus.set('idle');

    // Se estiver online, aciona a sincronização automática em segundo plano
    if (this.isOnline()) {
      this.sync().catch(err => console.warn('[SyncService] Auto-sync falhou, operação retida na outbox:', err));
    }
  }

  async sync(): Promise<void> {
    if (!this.isOnline()) {
      this.syncStatus.set('error');
      throw new Error('Sem conexão com a internet para sincronizar.');
    }

    const now = Date.now();
    const pendingOps = this.outbox().filter(op => 
      op.status === 'pending' || 
      (op.status === 'failed' && (!op.nextRetryAt || op.nextRetryAt <= now)) ||
      (op.status === 'processing' && op.leaseUntil && op.leaseUntil <= now)
    );

    if (pendingOps.length === 0) {
      this.syncStatus.set('synced');
      await this.pullServerChanges();
      return;
    }

    this.syncStatus.set('syncing');

    // Atribuir lease de processamento (60 segundos)
    const leaseUntil = Date.now() + LEASE_DURATION_MS;
    const processingAt = new Date().toISOString();

    for (const op of pendingOps) {
      await this.updateOpProcessing(op.id, leaseUntil, processingAt);
    }

    try {
      const activeCompanyId = this.identityService.currentTenant()?.tenantId || this.deviceService.deviceState().companyId;
      const deviceState = this.deviceService.deviceState();

      let headers = new HttpHeaders();
      if (deviceState.deviceId) headers = headers.set('x-device-id', deviceState.deviceId);
      if (deviceState.fingerprintHash) headers = headers.set('x-device-fingerprint', deviceState.fingerprintHash);
      if (deviceState.deviceToken) headers = headers.set('x-device-token', deviceState.deviceToken);
      if (deviceState.installationId) headers = headers.set('x-device-installation-id', deviceState.installationId);

      const response = await firstValueFrom(
        this.http.post<SyncBatchResponse>(
          '/api/v1/sync/batch',
          {
            companyId: activeCompanyId,
            operations: pendingOps
          },
          { headers }
        )
      );

      if (response && response.acks) {
        this.serverReachable.set(true);
        const isBatchSuccessful = response.success === true && !response.rolledBack;
        const ackedIds = new Set(response.acks.map(a => a.opId));

        for (const ack of response.acks) {
          if (isBatchSuccessful && (ack.status === 'ACK' || ack.status === 'DUPLICATE')) {
            await this.updateOpStatus(ack.opId, 'acknowledged');
            await this.removeOp(ack.opId);
          } else {
            const op = pendingOps.find(o => o.id === ack.opId);
            const isNonRecoverable = ack.error && (
              ack.error.toLowerCase().includes('unsupported') ||
              ack.error.toLowerCase().includes('invalid') ||
              ack.error.toLowerCase().includes('validation') ||
              ack.error.toLowerCase().includes('bad request')
            );

            if (isNonRecoverable) {
              console.error(`[SyncService] Operação ${ack.opId} rejeitada permanentemente devido a erro não-recuperável:`, ack.error);
              await this.syncDb.put(`sync_rejected_${ack.opId}`, {
                op,
                error: ack.error,
                rejectedAt: new Date().toISOString()
              });
              await this.updateOpStatus(ack.opId, 'acknowledged');
              await this.removeOp(ack.opId);
            } else {
              const retryCount = ((op?.retryCount) || 0) + 1;
              if (retryCount >= MAX_OUTBOX_RETRIES) {
                console.warn(`[SyncService] Operação ${ack.opId} atingiu o limite de ${MAX_OUTBOX_RETRIES} tentativas. Movendo para Dead-Letter Queue.`);
                await this.moveToDeadLetter(ack.opId, ack.error || 'Limite de tentativas excedido ou rollback do lote', retryCount);
              } else {
                const backoffMs = this.calculateBackoffWithJitter(retryCount);
                await this.updateOpFailure(ack.opId, ack.error || 'Lote revertido no servidor', retryCount, Date.now() + backoffMs);
              }
            }
          }
        }

        // Recuperação de Partial ACKs: operações não mencionadas nos ACKs devem voltar para 'pending'
        const unackedOps = pendingOps.filter(o => !ackedIds.has(o.id));
        for (const unacked of unackedOps) {
          console.warn(`[SyncService] Operação ${unacked.id} não recebeu ACK no lote (Partial ACK). Resetando para 'pending'.`);
          await this.updateOpStatus(unacked.id, 'pending');
        }
      }

      const hasFailures = this.outbox().some(op => op.status === 'failed');
      this.syncStatus.set(hasFailures ? 'error' : 'synced');
      this.lastSyncedAt.set(new Date());

      if (!hasFailures) {
        await this.pullServerChanges();
      }
    } catch (err) {
      this.serverReachable.set(false);
      const httpError = err instanceof HttpErrorResponse ? err : null;
      const isNonRecoverable = httpError && httpError.status >= 400 && httpError.status < 500 && httpError.status !== 429;
      
      const errorMsg = err instanceof Error ? err.message : String(err);
      
      for (const op of pendingOps) {
        if (isNonRecoverable) {
            console.error(`[SyncService] Operação ${op.id} rejeitada permanentemente devido a erro 4xx:`, errorMsg);
            await this.moveToDeadLetter(op.id, `Erro 4xx: ${errorMsg}`, op.retryCount || 0);
        } else {
            const retryCount = (op.retryCount || 0) + 1;
            if (retryCount >= MAX_OUTBOX_RETRIES) {
                await this.moveToDeadLetter(op.id, errorMsg, retryCount);
            } else {
                const backoffMs = this.calculateBackoffWithJitter(retryCount);
                await this.updateOpFailure(op.id, errorMsg, retryCount, Date.now() + backoffMs);
            }
        }
      }
      this.syncStatus.set('error');
    }
  }

  /**
   * Puxa as alterações mais recentes do servidor Central (via GET /api/v1/sync/pull)
   * e as sincroniza de forma atômica no banco de dados local (IndexedDB/SQLite).
   */
  async pullServerChanges(): Promise<void> {
    if (!this.isOnline()) {
      return;
    }

    try {
      const activeCompanyId = this.identityService.currentTenant()?.tenantId || this.deviceService.deviceState().companyId;
      if (!activeCompanyId) return;

      console.log(`[SyncService] Iniciando pull de alterações para a empresa ${activeCompanyId}...`);
      const response = await firstValueFrom(
        this.http.get<{
          success: boolean;
          data: {
            sales: { id: string }[];
            products: { id: string }[];
            financeTransactions: { id: string }[];
            customers: { id: string }[];
            tables: { id: string }[];
            publicSpace?: unknown;
          }
        }>(`/api/v1/sync/pull?companyId=${activeCompanyId}`)
      );

      if (response && response.success && response.data) {
        const { sales, products, financeTransactions, customers, tables, publicSpace } = response.data;
        const tenantId = activeCompanyId;

        if (sales && sales.length > 0) {
          await this.osDb.getNamespace(`tenant.${tenantId}.sales`).transaction(async (tx) => {
            for (const s of sales) {
              await tx.put(s.id, s);
            }
          });
        }

        if (products && products.length > 0) {
          await this.osDb.getNamespace(`tenant.${tenantId}.products`).transaction(async (tx) => {
            for (const p of products) {
              await tx.put(p.id, p);
            }
          });
        }

        if (financeTransactions && financeTransactions.length > 0) {
          await this.osDb.getNamespace(`tenant.${tenantId}.finance`).transaction(async (tx) => {
            for (const f of financeTransactions) {
              await tx.put(f.id, f);
            }
          });
        }

        if (customers && customers.length > 0) {
          await this.osDb.getNamespace(`tenant.${tenantId}.customers`).transaction(async (tx) => {
            for (const c of customers) {
              await tx.put(c.id, c);
            }
          });
        }

        if (tables && tables.length > 0) {
          await this.osDb.getNamespace(`tenant.${tenantId}.tables`).transaction(async (tx) => {
            for (const t of tables) {
              await tx.put(t.id, t);
            }
          });
        }

        if (publicSpace) {
          const psNs = this.osDb.getNamespace(`tenant.${tenantId}.public_space`);
          await psNs.put('config', publicSpace);
        }

        console.log('[SyncService] Sincronização bidirecional (PULL) concluída com sucesso.');
      }
    } catch (err) {
      console.warn('[SyncService] Falha ao realizar pull de alterações bidirecionais:', err);
    }
  }

  private calculateBackoffWithJitter(retryCount: number): number {
    const baseBackoff = Math.min(1000 * Math.pow(2, retryCount), MAX_BACKOFF_MS);
    // Full jitter between 0.75 and 1.25 of base backoff to prevent thundering herd
    const jitterFactor = 0.75 + Math.random() * 0.5;
    return Math.round(baseBackoff * jitterFactor);
  }

  toggleOnlineStatus() {
    this.networkOnline.update(status => !status);
    if (!this.networkOnline()) {
      this.syncStatus.set('idle');
    }
  }

  private async moveToDeadLetter(id: string, error: string, retryCount: number): Promise<void> {
    this.outbox.update(list =>
      list.map(op => op.id === id ? { ...op, status: 'dead_letter', lastError: error, retryCount, leaseUntil: undefined } : op)
    );
    const op = this.outbox().find(o => o.id === id);
    if (op) {
      await this.syncDb.put(`outbox_${id}`, op);
      await this.syncDb.put(`sync_deadletter_${id}`, {
        op,
        failedAt: new Date().toISOString(),
        error,
        retryCount
      });
    }
  }

  private async updateOpProcessing(id: string, leaseUntil: number, processingAt: string): Promise<void> {
    this.outbox.update(list =>
      list.map(op => op.id === id ? { ...op, status: 'processing', leaseUntil, processingAt } : op)
    );
    const op = this.outbox().find(o => o.id === id);
    if (op) {
      await this.syncDb.put(`outbox_${id}`, op);
    }
  }

  private async updateOpStatus(id: string, status: 'pending' | 'processing' | 'failed' | 'acknowledged'): Promise<void> {
    this.outbox.update(list =>
      list.map(op => op.id === id ? { ...op, status, leaseUntil: undefined } : op)
    );
    const op = this.outbox().find(o => o.id === id);
    if (op) {
      await this.syncDb.put(`outbox_${id}`, op);
    }
  }

  private async updateOpFailure(id: string, error: string, retryCount: number, nextRetryAt: number): Promise<void> {
    this.outbox.update(list =>
      list.map(op => op.id === id ? { ...op, status: 'failed', lastError: error, retryCount, nextRetryAt, leaseUntil: undefined } : op)
    );
    const op = this.outbox().find(o => o.id === id);
    if (op) {
      await this.syncDb.put(`outbox_${id}`, op);
    }
  }

  private async removeOp(id: string): Promise<void> {
    this.outbox.update(list => list.filter(op => op.id !== id));
    await this.syncDb.delete(`outbox_${id}`);
  }
}
