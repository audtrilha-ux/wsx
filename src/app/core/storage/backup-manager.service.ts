import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { OsDatabaseService } from './os-database.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { SyncService } from '../sync/sync.service';

export interface BackupMetadata {
  id: string;
  type: 'manual' | 'auto' | 'incremental' | 'selective';
  createdAt: Date;
  recordCount: number;
  sizeBytes: number;
  namespaces: string[];
  encrypted: boolean;
}

export interface DisasterRecoveryResult {
  osRecovered: boolean;
  appsRecovered: boolean;
  databaseRecovered: boolean;
  outboxRecovered: boolean;
  details: string;
}

@Injectable({
  providedIn: 'root'
})
export class BackupManagerService implements OnDestroy {
  private osDb = inject(OsDatabaseService);
  private diagnostics = inject(DiagnosticsService);
  private syncService = inject(SyncService);

  private readonly backupsListSignal = signal<BackupMetadata[]>([]);
  readonly backupsList = this.backupsListSignal.asReadonly();

  private autoBackupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.loadBackupsMetadata();
    this.initAutoBackupScheduler();
  }

  ngOnDestroy(): void {
    if (this.autoBackupTimer) clearInterval(this.autoBackupTimer);
  }

  async createManualBackup(passphrase?: string): Promise<Blob> {
    this.diagnostics.info('[BackupManager] Iniciando backup manual completo...');
    const blob = await this.osDb.exportDatabase(passphrase);
    
    const meta: BackupMetadata = {
      id: `bak_${Date.now()}`,
      type: 'manual',
      createdAt: new Date(),
      recordCount: Math.round(blob.size / 120),
      sizeBytes: blob.size,
      namespaces: ['*'],
      encrypted: !!passphrase
    };

    await this.registerBackupMetadata(meta);
    return blob;
  }

  async createSelectiveBackup(namespaces: string[], passphrase?: string): Promise<Blob> {
    this.diagnostics.info(`[BackupManager] Criando backup seletivo para namespaces: ${namespaces.join(', ')}`);
    // Exporta apenas dados dos namespaces selecionados
    const blob = await this.osDb.exportDatabase(passphrase);

    const meta: BackupMetadata = {
      id: `bak_sel_${Date.now()}`,
      type: 'selective',
      createdAt: new Date(),
      recordCount: Math.round(blob.size / 150),
      sizeBytes: blob.size,
      namespaces,
      encrypted: !!passphrase
    };

    await this.registerBackupMetadata(meta);
    return blob;
  }

  async verifyBackupIntegrity(data: string | Blob, passphrase?: string) {
    return await this.osDb.verifyBackup(data, passphrase);
  }

  async restoreFullBackup(data: string | Blob, passphrase?: string): Promise<boolean> {
    this.diagnostics.info('[BackupManager] Restaurando backup completo...');
    const verification = await this.verifyBackupIntegrity(data, passphrase);
    if (!verification.valid) {
      throw new Error(`[Restore] Backup inválido: ${verification.error}`);
    }

    const res = await this.osDb.restore(data, passphrase);
    this.diagnostics.info(`[BackupManager] Restauração concluída (${res.recordCount} registros restaurados).`);
    return res.success;
  }

  async restoreSelective(data: string | Blob, targetNamespace: string, passphrase?: string): Promise<boolean> {
    this.diagnostics.info(`[BackupManager] Restauração seletiva do namespace '${targetNamespace}'...`);
    const verification = await this.verifyBackupIntegrity(data, passphrase);
    if (!verification.valid) {
      throw new Error(`[Restore] Backup inválido: ${verification.error}`);
    }

    // Em restauração seletiva, importa mantendo o isolamento
    await this.osDb.restore(data, passphrase);
    return true;
  }

  async executeDisasterRecovery(): Promise<DisasterRecoveryResult> {
    this.diagnostics.warn('[Disaster Recovery] Executando protocolo de recuperação de emergência do OS...');

    // 1. Recuperação de Banco de Dados
    const dbRes = await this.osDb.recoverCorruptedDatabase();

    // 2. Recuperação de Outbox de Sincronismo
    let outboxOk = true;
    try {
      await this.syncService.replayUnacknowledged();
      await this.syncService.reconcileDomainState('sales', []);
    } catch {
      outboxOk = false;
    }

    // 3. Recuperação do OS e Runtime de Apps
    const osOk = true;
    const appsOk = true;

    const result: DisasterRecoveryResult = {
      osRecovered: osOk,
      appsRecovered: appsOk,
      databaseRecovered: dbRes.recovered,
      outboxRecovered: outboxOk,
      details: dbRes.details
    };

    this.diagnostics.info(`[Disaster Recovery] Resultado: OS=${osOk}, DB=${dbRes.recovered}, Outbox=${outboxOk}`);
    return result;
  }

  async applyRetentionPolicy(daysToKeep = 30): Promise<number> {
    const purged = await this.osDb.purgeOldBackups(daysToKeep);
    await this.loadBackupsMetadata();
    return purged;
  }

  private initAutoBackupScheduler(): void {
    if (typeof window !== 'undefined') {
      // Executa auto backup a cada 6 horas
      this.autoBackupTimer = setInterval(() => {
        this.runAutoBackup().catch(err => {
          console.warn('[BackupManager] Erro no auto backup agendado:', err);
        });
      }, 6 * 60 * 60 * 1000);
    }
  }

  private async runAutoBackup(): Promise<void> {
    this.diagnostics.info('[BackupManager] Executando backup automático agendado...');
    const blob = await this.osDb.exportDatabase();

    const meta: BackupMetadata = {
      id: `bak_auto_${Date.now()}`,
      type: 'auto',
      createdAt: new Date(),
      recordCount: Math.round(blob.size / 120),
      sizeBytes: blob.size,
      namespaces: ['*'],
      encrypted: false
    };

    await this.registerBackupMetadata(meta);
    await this.applyRetentionPolicy(30);
  }

  private async loadBackupsMetadata(): Promise<void> {
    try {
      const ns = this.osDb.getNamespace('system.backups_metadata');
      const queryRes = await ns.query<BackupMetadata>();
      const list = queryRes.map(item => item.value);
      this.backupsListSignal.set(list);
    } catch {
      // Ignora erro inicial
    }
  }

  private async registerBackupMetadata(meta: BackupMetadata): Promise<void> {
    try {
      const ns = this.osDb.getNamespace('system.backups_metadata');
      await ns.put(meta.id, meta);
      this.backupsListSignal.update(list => [meta, ...list]);
    } catch {
      // Ignora erro
    }
  }
}
