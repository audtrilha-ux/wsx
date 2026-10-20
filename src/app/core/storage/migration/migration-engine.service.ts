import { Injectable, inject } from '@angular/core';
import { OsDatabaseService } from '../os-database.service';
import { IMigration, ITransaction } from '../../../contracts/storage/storage.contract';

export interface MigrationJournalRecord {
  version: number;
  namespace: string;
  appliedAt: string;
  status: 'success' | 'failed';
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MigrationEngineService {
  private osDb = inject(OsDatabaseService);
  private migrationDb = this.osDb.getNamespace('system.migrations');

  async getCurrentVersion(namespace = 'global'): Promise<number> {
    try {
      const records = await this.migrationDb.query<MigrationJournalRecord>();
      const nsRecords = records
        .map(r => r.value)
        .filter(r => r.namespace === namespace && r.status === 'success')
        .sort((a, b) => b.version - a.version);

      return nsRecords.length > 0 ? nsRecords[0].version : 0;
    } catch (err) {
      console.warn('[MigrationEngine] Falha ao ler versão atual de schema:', err);
      return 0;
    }
  }

  async applyMigrations(migrations: IMigration[], namespace = 'global'): Promise<void> {
    const currentVersion = await this.getCurrentVersion(namespace);
    const pending = migrations
      .filter(m => m.version > currentVersion)
      .sort((a, b) => a.version - b.version);

    if (pending.length === 0) {
      return;
    }

    const ns = this.osDb.getNamespace(namespace);

    for (const migration of pending) {
      try {
        await ns.transaction(async (tx: ITransaction) => {
          await migration.up(tx);
        });

        const record: MigrationJournalRecord = {
          version: migration.version,
          namespace,
          appliedAt: new Date().toISOString(),
          status: 'success'
        };
        await this.migrationDb.put(`mig_${namespace}_v${migration.version}`, record);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const failRecord: MigrationJournalRecord = {
          version: migration.version,
          namespace,
          appliedAt: new Date().toISOString(),
          status: 'failed',
          error: errorMsg
        };
        await this.migrationDb.put(`mig_${namespace}_v${migration.version}`, failRecord);
        console.error(`[MigrationEngine] Erro ao aplicar migração v${migration.version} no namespace ${namespace}:`, err);
        throw new Error(`Migration v${migration.version} failed: ${errorMsg}`);
      }
    }
  }

  async getJournal(): Promise<MigrationJournalRecord[]> {
    try {
      const records = await this.migrationDb.query<MigrationJournalRecord>();
      return records.map(r => r.value).sort((a, b) => a.version - b.version);
    } catch {
      return [];
    }
  }
}
