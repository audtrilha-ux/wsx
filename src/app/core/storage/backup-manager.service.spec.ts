import { TestBed } from '@angular/core/testing';
import { BackupManagerService } from './backup-manager.service';
import { OsDatabaseService } from './os-database.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { SyncService } from '../sync/sync.service';

describe('BackupManagerService — Backup, Retention & Disaster Recovery', () => {
  let service: BackupManagerService;

  beforeEach(() => {
    const mockDb = {
      exportDatabase: async () => new Blob(['{"records":[]}'], { type: 'application/json' }),
      verifyBackup: async () => ({ valid: true, recordCount: 10 }),
      restore: async () => ({ success: true, recordCount: 10 }),
      recoverCorruptedDatabase: async () => ({ recovered: true, details: 'Database schema clean' }),
      purgeOldBackups: async () => 2,
      getNamespace: () => ({
        get: async () => null,
        put: async () => undefined,
        query: async () => []
      })
    };

    const mockDiagnostics = { info: () => true, warn: () => true, error: () => true };
    const mockSync = { 
      reconcileDomainState: async () => undefined,
      replayUnacknowledged: async () => undefined 
    };

    TestBed.configureTestingModule({
      providers: [
        BackupManagerService,
        { provide: OsDatabaseService, useValue: mockDb },
        { provide: DiagnosticsService, useValue: mockDiagnostics },
        { provide: SyncService, useValue: mockSync }
      ]
    });

    service = TestBed.inject(BackupManagerService);
  });

  it('should create manual backup and register metadata', async () => {
    const blob = await service.createManualBackup();
    expect(blob).toBeTruthy();
  });

  it('should verify and restore full backup', async () => {
    const backupBlob = new Blob(['{"records":[{"key":"1"}]}'], { type: 'application/json' });
    const success = await service.restoreFullBackup(backupBlob);
    expect(success).toBe(true);
  });

  it('should execute disaster recovery protocol across database and outbox', async () => {
    const result = await service.executeDisasterRecovery();
    expect(result.databaseRecovered).toBe(true);
    expect(result.osRecovered).toBe(true);
    expect(result.outboxRecovered).toBe(true);
  });

  it('should purge old backups using retention policy', async () => {
    const purged = await service.applyRetentionPolicy(30);
    expect(purged).toBe(2);
  });
});
