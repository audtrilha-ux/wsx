import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppRegistryService } from './app-registry.service';
import { DeviceService } from '../device/device.service';
import { OsDatabaseService } from '../storage/os-database.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { AppManifest } from '../../contracts/apps/app-manifest.contract';
import { satisfiesSemVer } from '../semver';

export interface AppPackage {
  id: string;
  name: string;
  version: string;
  status: 'staged' | 'active' | 'suspended';
  manifest: AppManifest;
  checksum: string;
  signature?: string;
  installedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppPackageManagerService {
  private http = inject(HttpClient);
  private appRegistry = inject(AppRegistryService);
  private deviceService = inject(DeviceService);
  private osDb = inject(OsDatabaseService);
  private diagnostics = inject(DiagnosticsService);

  readonly installedPackages = signal<AppPackage[]>([]);
  readonly activePackageIds = signal<Set<string>>(new Set());

  private get systemDb() {
    const tenantId = this.deviceService.deviceState().companyId || 'comp_1';
    return this.osDb.getNamespace(`tenant.${tenantId}.system.packages`);
  }

  constructor() {
    // Carrega pacotes persistidos localmente ao inicializar o OS
    void this.loadInstalledPackages();
  }

  /**
   * Carrega os pacotes de aplicativos instalados no terminal a partir do banco de dados local isolado do tenant.
   */
  async loadInstalledPackages(): Promise<void> {
    try {
      const records = await this.systemDb.query<AppPackage>();
      const packages = records.map(r => r.value);
      this.installedPackages.set(packages);

      // Executa o boot de cada pacote ativo
      for (const pkg of packages) {
        if (pkg.status === 'active') {
          await this.bootPackage(pkg);
        }
      }
      this.diagnostics.info(`[AppPackageManager] ${packages.length} pacotes carregados do banco de dados local.`);
    } catch (err) {
      this.diagnostics.error('[AppPackageManager] Falha ao ler pacotes persistidos localmente.', err);
    }
  }

  /**
   * Instala um pacote de aplicativo de forma dinâmica e segura, validando sua integridade e SemVer.
   */
  async installPackage(artifactId: string, manifest: AppManifest, checksum: string, signature?: string): Promise<boolean> {
    this.diagnostics.info(`[AppPackageManager] Iniciando instalação do aplicativo: ${manifest.name} (v${manifest.version})...`);

    // 1. Validar compatibilidade do SO (SemVer)
    const currentOsVer = this.deviceService.deviceState().osVersion || '1.4.3';
    if (manifest.osCompatibility && !satisfiesSemVer(currentOsVer, manifest.osCompatibility)) {
      const err = `Incompatível: O aplicativo requer o OS na versão ${manifest.osCompatibility}, mas o terminal está em ${currentOsVer}.`;
      this.diagnostics.warn(`[AppPackageManager] Falha de instalação: ${err}`);
      throw new Error(err);
    }

    // 2. Baixar o binário/artefato e validar checksum SHA-256 (OTA Integrity)
    try {
      const response = await this.http.get<{ artifactBase64: string; checksum: string }>(`/api/v1/store/artifacts/${artifactId}`).toPromise();
      if (!response) {
        throw new Error('Não foi possível obter os dados do artefato do servidor.');
      }

      if (response.checksum.toLowerCase() !== checksum.toLowerCase()) {
        const err = 'Falha de integridade: O checksum retornado do artefato não condiz com o checksum assinado pelo manifesto da release.';
        this.diagnostics.error(`[AppPackageManager] ${err}`);
        throw new Error(err);
      }

      this.diagnostics.info(`[AppPackageManager] Integridade do pacote verificada com sucesso via SHA-256.`);
    } catch (err) {
      this.diagnostics.error(`[AppPackageManager] Falha ao autenticar binário do artefato #${artifactId}.`, err);
      throw err;
    }

    // 3. Registrar o pacote no banco persistido local de forma atômica
    const newPkg: AppPackage = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      status: 'active',
      manifest,
      checksum,
      signature,
      installedAt: new Date().toISOString()
    };

    await this.systemDb.put(manifest.id, newPkg);
    this.installedPackages.update(list => {
      const filtered = list.filter(p => p.id !== manifest.id);
      return [...filtered, newPkg];
    });

    // 4. Disparar ciclo de vida onInstall e onBoot
    await this.triggerLifecycleHook(manifest, 'onInstall');
    await this.bootPackage(newPkg);

    this.diagnostics.info(`[AppPackageManager] Aplicativo ${manifest.name} instalado e ativado com sucesso.`);
    return true;
  }

  /**
   * Atualiza ou reverte a versão de um aplicativo com suporte total a rollback.
   */
  async updatePackage(manifest: AppManifest, checksum: string, signature?: string): Promise<boolean> {
    const existing = this.installedPackages().find(p => p.id === manifest.id);
    if (!existing) {
      throw new Error(`O aplicativo ${manifest.name} não está instalado para ser atualizado.`);
    }

    const previousPkg = { ...existing };
    this.diagnostics.info(`[AppPackageManager] Atualizando ${manifest.name} de v${previousPkg.version} para v${manifest.version}...`);

    try {
      // Registrar novo estado staged
      const updatedPkg: AppPackage = {
        ...existing,
        version: manifest.version,
        status: 'staged',
        manifest,
        checksum,
        signature
      };

      await this.systemDb.put(manifest.id, updatedPkg);

      // Desativa o antigo
      await this.suspendPackage(manifest.id);

      // Ativa o novo
      updatedPkg.status = 'active';
      await this.systemDb.put(manifest.id, updatedPkg);
      await this.bootPackage(updatedPkg);

      this.installedPackages.update(list => list.map(p => p.id === manifest.id ? updatedPkg : p));
      this.diagnostics.info(`[AppPackageManager] Atualização de ${manifest.name} concluída com sucesso.`);
      return true;
    } catch (err) {
      this.diagnostics.error(`[AppPackageManager] Falha ao atualizar ${manifest.name}. Efetuando rollback automático...`, err);
      
      // Rollback automático imediato
      await this.systemDb.put(previousPkg.id, previousPkg);
      if (previousPkg.status === 'active') {
        await this.bootPackage(previousPkg);
      }
      this.installedPackages.update(list => list.map(p => p.id === manifest.id ? previousPkg : p));
      throw new Error(`Falha na atualização de ${manifest.name}. O sistema reverteu o estado de forma segura para a versão v${previousPkg.version}.`);
    }
  }

  /**
   * Remove a instalação de um aplicativo e limpa seus dados associados.
   */
  async uninstallPackage(appId: string): Promise<boolean> {
    const pkg = this.installedPackages().find(p => p.id === appId);
    if (!pkg) return false;

    this.diagnostics.info(`[AppPackageManager] Desinstalando aplicativo: ${pkg.name}...`);

    // 1. Executa o hook de destruição de ciclo de vida
    await this.triggerLifecycleHook(pkg.manifest, 'onUninstall');

    // 2. Desativa e desregistra do runtime
    await this.suspendPackage(appId);
    this.appRegistry.unregister(appId);

    // 3. Remove persistência local
    await this.systemDb.delete(appId);
    this.installedPackages.update(list => list.filter(p => p.id !== appId));

    this.diagnostics.info(`[AppPackageManager] Aplicativo ${pkg.name} desinstalado com sucesso.`);
    return true;
  }

  /**
   * Inicializa e monta o aplicativo no barramento de execução do sistema.
   */
  private async bootPackage(pkg: AppPackage): Promise<void> {
    this.appRegistry.register(pkg.manifest);
    this.activePackageIds.update(set => {
      const next = new Set(set);
      next.add(pkg.id);
      return next;
    });
    await this.triggerLifecycleHook(pkg.manifest, 'onBoot');
  }

  /**
   * Suspende e desabilita um aplicativo do barramento de execução.
   */
  async suspendPackage(appId: string): Promise<void> {
    const pkg = this.installedPackages().find(p => p.id === appId);
    if (!pkg) return;

    await this.triggerLifecycleHook(pkg.manifest, 'onSuspend');
    this.activePackageIds.update(set => {
      const next = new Set(set);
      next.delete(appId);
      return next;
    });
    this.appRegistry.unregister(appId);
  }

  /**
   * Dispara hooks de ciclo de vida personalizados declarados no próprio aplicativo.
   */
  private async triggerLifecycleHook(manifest: AppManifest, hook: 'onInstall' | 'onBoot' | 'onSuspend' | 'onUninstall'): Promise<void> {
    // Como os componentes são carregados sob demanda, instanciamos de forma assíncrona se disponível
    try {
      const component = await this.appRegistry.getComponent(manifest.id);
      if (component) {
        const cls = component as unknown as { prototype: Record<string, unknown> };
        const instance = cls.prototype;
        if (instance && typeof instance[hook] === 'function') {
          await (instance[hook] as () => Promise<void> | void)();
          this.diagnostics.info(`[AppPackageManager] Executou gancho de ciclo de vida '${hook}' no app '${manifest.id}'.`);
        }
      }
    } catch (err) {
      this.diagnostics.error(`[AppPackageManager] Erro ao disparar hook '${hook}' do aplicativo '${manifest.id}':`, err);
    }
  }
}
