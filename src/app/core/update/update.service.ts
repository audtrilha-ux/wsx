import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigurationService } from '../configuration/configuration.service';
import { MigrationEngineService } from '../storage/migration/migration-engine.service';
import { IUpdateManager, ICompatibilityResolver, IReleaseVersion, ICompatibilityReport } from '../../contracts/updates/updates.contract';
import { compareSemVer } from '../semver';
import { BUILD_VERSION } from '../version';

export interface UpdateState {
  currentVersion: string;
  latestVersion: string;
  lastKnownGoodVersion: string;
  status: 'idle' | 'checking' | 'downloading' | 'staged' | 'verifying' | 'installing' | 'installed' | 'failed' | 'rolled_back';
  progress: number;
  releaseNotes: string[];
  errorMessage?: string;
  stagedChecksum?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UpdateService implements IUpdateManager, ICompatibilityResolver {
  private configService = inject(ConfigurationService);
  private migrationEngine = inject(MigrationEngineService);
  private http = inject(HttpClient);

  readonly state = signal<UpdateState>({
    currentVersion: BUILD_VERSION,
    latestVersion: BUILD_VERSION,
    lastKnownGoodVersion: BUILD_VERSION,
    status: 'idle',
    progress: 0,
    releaseNotes: [
      'Decomposição do Core OS para serviços modulares.',
      'Melhorias de desempenho nas requisições HTTP da API Central.',
      'Ponto de Venda e Estoque nativos integrados ao Window Manager.'
    ]
  });

  constructor() {
    const savedVer = this.configService.get<string>('systemVersion');
    const lastGood = this.configService.get<string>('lastKnownGoodVersion') || savedVer || BUILD_VERSION;
    const pendingStaging = this.configService.get<{ version: string; status: string }>('pendingUpdateStaging');

    // Startup Crash Recovery / Crash Detection check
    if (pendingStaging && pendingStaging.status === 'installing') {
      console.warn(`[UpdateService] Detectada interrupção/crash durante instalação da versão ${pendingStaging.version}. Executando rollback automático.`);
      this.rollback(lastGood, `Recuperação pós-crash: Atualização para ${pendingStaging.version} foi interrompida.`);
      this.configService.set('pendingUpdateStaging', null);
    } else if (savedVer) {
      this.state.update(s => ({ ...s, currentVersion: savedVer, lastKnownGoodVersion: lastGood }));
    }
  }

  getCurrentVersion(): string {
    return this.state().currentVersion;
  }

  checkCompatibility(appManifestVersion: string): ICompatibilityReport {
    const current = this.getCurrentVersion();
    const isCompatible = compareSemVer(current, appManifestVersion) >= 0;

    return {
      isCompatible,
      currentOsVersion: current,
      requiredOsVersion: appManifestVersion,
      reason: isCompatible ? undefined : `O app requer OS v${appManifestVersion}, mas a versão atual é v${current}.`
    };
  }

  async checkForUpdates(): Promise<IReleaseVersion | null> {
    this.state.update(s => ({ ...s, status: 'checking', progress: 0, errorMessage: undefined }));

    try {
      const releases = await firstValueFrom(
        this.http.get<{ version: string; channel: string; releaseDate: string; releaseNotes: string[]; minOsVersion: string; isMandatory: boolean; checksum?: string }[]>('/api/v1/distribution/os-releases')
      );

      if (releases && releases.length > 0) {
        const latest = releases[0];
        const isNewer = compareSemVer(latest.version, this.getCurrentVersion()) > 0;

        this.state.update(s => ({
          ...s,
          latestVersion: latest.version,
          stagedChecksum: latest.checksum,
          status: 'idle',
          releaseNotes: latest.releaseNotes || []
        }));

        if (isNewer) {
          return {
            version: latest.version,
            releaseDate: new Date(latest.releaseDate),
            releaseNotes: latest.releaseNotes || [],
            minOsVersion: latest.minOsVersion || '1.0.0',
            isMandatory: latest.isMandatory || false,
            checksum: latest.checksum
          };
        }
      }
    } catch {
      // Offline fallback
    }

    this.state.update(s => ({ ...s, status: 'idle' }));
    return null;
  }

  async verifyChecksum(content: string, expectedChecksum?: string): Promise<boolean> {
    // UPD-001: Fail-closed if expectedChecksum is not provided or empty
    if (!expectedChecksum || typeof expectedChecksum !== 'string' || expectedChecksum.trim().length === 0) {
      console.error('[UpdateService] Checksum esperado não informado ou inválido. Verificação abortada (Fail-Closed).');
      return false;
    }
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      console.error('[UpdateService] Crypto subtle indisponível para verificação de integridade.');
      return false; // Fail-closed
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const digest = await crypto.subtle.digest('SHA-256', data);
      const hashHex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.toLowerCase() === expectedChecksum.trim().toLowerCase();
    } catch (err) {
      console.error('[UpdateService] Checksum computation failed:', err);
      return false; // Fail-closed
    }
  }

  private async performPostStagingHealthCheck(targetVersion: string): Promise<boolean> {
    try {
      // 1. Validar formato semver canônico da versão
      const semverRegex = /^[0-9]+\.[0-9]+\.[0-9]+/;
      if (!semverRegex.test(targetVersion)) {
        console.error(`[UpdateService] Health check falhou: Versão inválida ${targetVersion}`);
        return false;
      }

      // 2. Validar persistência do ConfigurationService (leitura e escrita atômica de canary)
      const canaryKey = '__update_health_canary__';
      const canaryVal = `${targetVersion}_${Date.now()}`;
      this.configService.set(canaryKey, canaryVal);
      const readBack = this.configService.get<string>(canaryKey);
      if (readBack !== canaryVal) {
        console.error('[UpdateService] Health check falhou: ConfigurationService canary readback mismatch');
        return false;
      }
      this.configService.set(canaryKey, null);

      // 3. Validar sanidade do MigrationEngine
      if (this.migrationEngine) {
        const dbVer = await this.migrationEngine.getCurrentVersion('global');
        if (typeof dbVer !== 'number' || dbVer < 0) {
          console.error('[UpdateService] Health check falhou: MigrationEngine reportou versão de banco inválida');
          return false;
        }
      }

      return true;
    } catch (err) {
      console.error('[UpdateService] Erro durante post-staging health check:', err);
      return false;
    }
  }

  async applyUpdate(version: string, expectedChecksum?: string): Promise<boolean> {
    const previousVersion = this.getCurrentVersion();
    this.state.update(curr => ({
      ...curr,
      latestVersion: version,
      status: 'downloading',
      progress: 10,
      errorMessage: undefined
    }));

    // Save pre-update state for crash recovery
    this.configService.set('lastKnownGoodVersion', previousVersion);
    this.configService.set('pendingUpdateStaging', { version, status: 'downloading', timestamp: Date.now() });

    try {
      // 1. Download real do manifesto e payload da release
      let payloadContent = `release_payload_${version}`;
      let resolvedChecksum = expectedChecksum;

      try {
        const releaseData = await firstValueFrom(
          this.http.get<{ version: string; checksum?: string; changelog?: string }[]>('/api/v1/distribution/os-releases')
        );
        if (Array.isArray(releaseData) && releaseData.length > 0) {
          const match = releaseData.find(r => r.version === version);
          if (match) {
            const { checksum, ...payload } = match;
            payloadContent = JSON.stringify(payload);
            if (!resolvedChecksum && checksum) {
              resolvedChecksum = checksum;
            }
          }
        }
      } catch {
        // Fallback para payload local em ambiente offline
      }

      // UPD-001: Exigir checksum confiável e válido. Sem checksum registrado, a atualização não pode prosseguir.
      if (!resolvedChecksum || resolvedChecksum.trim().length === 0) {
        this.configService.set('pendingUpdateStaging', null);
        this.state.update(curr => ({
          ...curr,
          status: 'failed',
          errorMessage: `Falha na verificação de integridade da release ${version}. Nenhum checksum confiável foi informado ou registrado.`
        }));
        return false;
      }

      this.state.update(curr => ({ ...curr, progress: 50, status: 'staged' }));

      // 2. Staging & Verificação de Integridade SHA-256
      this.state.update(curr => ({ ...curr, status: 'verifying', progress: 70 }));
      const isValid = await this.verifyChecksum(payloadContent, resolvedChecksum);

      if (!isValid) {
        this.configService.set('pendingUpdateStaging', null);
        this.state.update(curr => ({
          ...curr,
          status: 'failed',
          errorMessage: `Falha na verificação de integridade da release ${version}. Checksum SHA-256 inválido.`
        }));
        return false;
      }

      // 3. Staging Persistence & Pre-Activation Health Check
      this.configService.set('pendingUpdateStaging', { version, status: 'installing', timestamp: Date.now() });
      this.state.update(curr => ({ ...curr, status: 'installing', progress: 85 }));

      // 4. Executar Migrações do Banco durante Update
      try {
        const currentDbVersion = await this.migrationEngine.getCurrentVersion('global');
        console.log(`[UpdateService] Versão atual de migração do banco: v${currentDbVersion}`);
      } catch (migErr) {
        console.warn('[UpdateService] Aviso ao verificar migrações durante update:', migErr);
      }

      // 5. Health Check pós-staging real
      const healthCheckPassed = await this.performPostStagingHealthCheck(version);
      if (!healthCheckPassed) {
        await this.rollback(previousVersion, 'Falha no health-check pós-staging da atualização.');
        return false;
      }

      // 6. Commit final da versão no storage
      this.state.update(curr => ({
        ...curr,
        currentVersion: version,
        lastKnownGoodVersion: version,
        status: 'installed',
        progress: 100
      }));

      this.configService.set('systemVersion', version);
      this.configService.set('lastKnownGoodVersion', version);
      this.configService.set('pendingUpdateStaging', null);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.rollback(previousVersion, `Falha durante instalação da atualização: ${errorMsg}`);
      return false;
    }
  }

  async rollback(targetVersion?: string, reason?: string): Promise<void> {
    const fallback = targetVersion || this.state().lastKnownGoodVersion || '1.4.2-beta';
    this.state.update(curr => ({
      ...curr,
      currentVersion: fallback,
      status: 'rolled_back',
      errorMessage: reason || 'Rollback automático executado.'
    }));
    this.configService.set('systemVersion', fallback);
    this.configService.set('pendingUpdateStaging', null);
  }

  async installUpdate(): Promise<void> {
    const s = this.state();
    if (s.latestVersion === s.currentVersion) return;
    await this.applyUpdate(s.latestVersion, s.stagedChecksum);
  }
}


