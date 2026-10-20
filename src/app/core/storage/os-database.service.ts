import { Injectable, inject } from '@angular/core';
import { IOsDatabaseService, OsDatabaseNamespace, IOsDatabaseAdapter, OsQueryOptions, OsDatabaseTransaction, OS_DATABASE_ADAPTER } from '../../contracts/os/os-database.contract';

@Injectable({
  providedIn: 'root'
})
export class OsDatabaseService implements IOsDatabaseService {
  private adapter: IOsDatabaseAdapter = inject(OS_DATABASE_ADAPTER);

  getNamespace(namespace: string): OsDatabaseNamespace {
    return {
      namespace,
      get: <T = unknown>(key: string) => this.adapter.get<T>(namespace, key),
      put: <T = unknown>(key: string, value: T) => this.adapter.put<T>(namespace, key, value),
      delete: (key: string) => this.adapter.delete(namespace, key),
      query: <T = unknown>(options?: OsQueryOptions) => this.adapter.query<T>(namespace, options),
      clear: () => this.adapter.clear(namespace),
      transaction: <R>(callback: (tx: OsDatabaseTransaction) => Promise<R>) => this.adapter.transaction<R>(namespace, callback)
    };
  }

  async migrate(): Promise<void> {
    await this.adapter.migrate();
  }

  async backup(passphrase?: string): Promise<Blob | null> {
    return await this.adapter.backup(passphrase);
  }

  async restore(data: string | Blob, passphrase?: string): Promise<{ success: boolean; recordCount: number }> {
    if (this.adapter.restore) {
      return await this.adapter.restore(data, passphrase);
    }
    throw new Error('O adaptador de banco atual não suporta restauração de backup.');
  }

  async verifyBackup(
    data: string | Blob,
    passphrase?: string
  ): Promise<{ valid: boolean; recordCount: number; timestamp?: string; source?: string; error?: string }> {
    try {
      let contentStr: string;
      if (typeof data === 'string') {
        contentStr = data;
      } else if (typeof data.text === 'function') {
        contentStr = await data.text();
      } else if (typeof data.arrayBuffer === 'function') {
        const arrayBuffer = await data.arrayBuffer();
        contentStr = new TextDecoder().decode(arrayBuffer);
      } else {
        contentStr = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsText(data);
        });
      }

      let parsed = JSON.parse(contentStr);

      if (parsed.encrypted && parsed.ciphertextHex) {
        if (!passphrase) {
          return { valid: false, recordCount: 0, error: 'Backup criptografado requer senha para validação.' };
        }
        if (typeof crypto === 'undefined' || !crypto.subtle) {
          return { valid: false, recordCount: 0, error: 'WebCrypto API indisponível.' };
        }
        const salt = new Uint8Array((parsed.saltHex.match(/.{1,2}/g) || []).map((b: string) => parseInt(b, 16)));
        const iv = new Uint8Array((parsed.ivHex.match(/.{1,2}/g) || []).map((b: string) => parseInt(b, 16)));
        const cipherBytes = new Uint8Array((parsed.ciphertextHex.match(/.{1,2}/g) || []).map((b: string) => parseInt(b, 16)));
        const encoder = new TextEncoder();
        const passKey = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
        const aesKey = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
          passKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipherBytes);
        parsed = JSON.parse(new TextDecoder().decode(decrypted));
      }

      if (!Array.isArray(parsed.records)) {
        return { valid: false, recordCount: 0, error: 'Formato de backup inválido: chave de registros ausente.' };
      }

      return {
        valid: true,
        recordCount: parsed.records.length,
        timestamp: parsed.exportedAt,
        source: parsed.source || 'os_database'
      };
    } catch (err) {
      return {
        valid: false,
        recordCount: 0,
        error: `Falha na verificação do backup: ${(err as Error)?.message || 'Erro de leitura'}`
      };
    }
  }

  async exportDatabase(passphrase?: string): Promise<Blob> {
    const backupBlob = await this.backup(passphrase);
    if (!backupBlob) {
      throw new Error('Erro ao gerar exportação do banco de dados.');
    }
    return backupBlob;
  }

  async importDatabase(data: string | Blob, passphrase?: string): Promise<{ success: boolean; recordCount: number }> {
    const verification = await this.verifyBackup(data, passphrase);
    if (!verification.valid) {
      throw new Error(`Falha na importação: ${verification.error}`);
    }
    return await this.restore(data, passphrase);
  }

  async purgeOldBackups(retentionDays = 30): Promise<number> {
    try {
      const ns = this.getNamespace('system.backups_metadata');
      const entries = await ns.query<{ id: string; createdAt: string }>();
      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      let purgedCount = 0;

      for (const entry of entries) {
        const createdTime = new Date(entry.value.createdAt).getTime();
        if (createdTime < cutoff) {
          await ns.delete(entry.key);
          purgedCount++;
        }
      }
      return purgedCount;
    } catch {
      return 0;
    }
  }

  async recoverCorruptedDatabase(): Promise<{ recovered: boolean; details: string }> {
    try {
      // Tenta re-executar migrations e reinstanciar tabelas limpas
      await this.adapter.migrate();
      return {
        recovered: true,
        details: 'Banco restaurado e recompilado com integridade de esquema SQLite.'
      };
    } catch (err) {
      return {
        recovered: false,
        details: `Falha na recuperação de emergência: ${(err as Error)?.message}`
      };
    }
  }

  async getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'error'; details: string; latencyMs: number }> {
    const start = performance.now();
    try {
      const ns = this.getNamespace('system.health');
      const testKey = `ping_${Date.now()}`;
      await ns.put(testKey, { ok: true, timestamp: new Date().toISOString() });
      const readBack = await ns.get<{ ok: boolean }>(testKey);
      await ns.delete(testKey);
      const latency = Math.round(performance.now() - start);

      if (readBack?.ok) {
        return {
          status: 'healthy',
          details: `${this.adapter.constructor.name} transacional ativo (Latência: ${latency}ms)`,
          latencyMs: latency
        };
      } else {
        return {
          status: 'degraded',
          details: 'Storage respondeu mas falhou na integridade de leitura imediata.',
          latencyMs: latency
        };
      }
    } catch (err) {
      return {
        status: 'error',
        details: `Erro crítico no storage do OS: ${err instanceof Error ? err.message : 'Falha desconhecida'}`,
        latencyMs: Math.round(performance.now() - start)
      };
    }
  }
}
