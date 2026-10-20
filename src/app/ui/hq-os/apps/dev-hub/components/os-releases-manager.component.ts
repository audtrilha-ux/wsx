import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HqApiClient } from '../../../../../core/api/api-client';
import { firstValueFrom } from 'rxjs';
import { HqStateService } from '../../../hq-state.service';
import { Company } from '../../../../../core/domain/company/company.entity';

export interface OsRelease {
  version: string;
  channel: 'stable' | 'beta';
  releaseDate: string;
  changelog: string[];
  mandatory?: boolean;
  minCoreVersion?: string;
  minRequiredByApps?: string;
  status?: string;
}

@Component({
  selector: 'app-os-releases-manager',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <mat-icon class="text-indigo-400 text-sm">system_update</mat-icon>
            Canal de Distribuição OTA & Gestão de Versões do Core OS
          </h4>
          <p class="text-xs text-slate-400 mt-0.5">
            Publicação de pacotes de runtime, controle de canais (Stable vs Beta) e rollouts para os terminais Client OS.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="loadReleases()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 transition-colors">
            <mat-icon class="text-xs">refresh</mat-icon>
            Atualizar
          </button>
          <button (click)="showPublishModal.set(true)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-sm">
            <mat-icon class="text-xs">add_circle</mat-icon>
            Publicar Nova Release
          </button>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Releases List -->
        <div class="lg:col-span-2 space-y-3">
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Releases Registradas no HQ ({{ releases().length }})</h5>
            <div class="space-y-3">
              @for (rel of releases(); track rel.version) {
                <div class="bg-slate-950 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors">
                  <div class="flex items-start justify-between gap-3 mb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-base font-bold font-mono text-white">v{{ rel.version }}</span>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border"
                            [ngClass]="rel.channel === 'stable' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'">
                        Canal {{ rel.channel | uppercase }}
                      </span>
                      @if (rel.mandatory || rel.status === 'lts') {
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Mandatória / LTS
                        </span>
                      }
                    </div>
                    <span class="text-[11px] text-slate-500 font-mono">{{ rel.releaseDate }}</span>
                  </div>

                  <div class="space-y-1 mb-3">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Changelog:</span>
                    @for (item of rel.changelog; track item) {
                      <div class="text-xs text-slate-300 flex items-center gap-1.5">
                        <mat-icon class="text-xs text-indigo-400">check_small</mat-icon>
                        <span>{{ item }}</span>
                      </div>
                    }
                  </div>

                  <div class="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-900">
                    <span>Requer Core Mínimo: <strong class="text-slate-400 font-mono">{{ rel.minCoreVersion || rel.minRequiredByApps || '1.0.0' }}</strong></span>
                    <button (click)="prepareRollout(rel.version)" class="text-indigo-400 hover:text-indigo-300 font-bold uppercase text-[10px] flex items-center gap-1">
                      <mat-icon class="text-xs">publish</mat-icon>
                      Disparar Rollout
                    </button>
                  </div>
                </div>
              }
              @if (releases().length === 0) {
                <div class="text-center py-8 text-slate-500 text-xs font-mono">Nenhuma release registrada no catálogo de distribuição.</div>
              }
            </div>
          </div>
        </div>

        <!-- Rollout & Emergency Rollback Controls -->
        <div class="space-y-6">
          <!-- Rollout Box -->
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <mat-icon class="text-indigo-400 text-sm">rocket</mat-icon>
              Executar Rollout OTA
            </h5>

            <div>
              <label for="rollout-version-select" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Versão de Destino</label>
              <select id="rollout-version-select" [value]="rolloutVersion()" (change)="onRolloutVersionChange($event)" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono">
                @for (rel of releases(); track rel.version) {
                  <option [value]="rel.version">v{{ rel.version }} ({{ rel.channel | uppercase }})</option>
                }
              </select>
            </div>

            <div>
              <label for="rollout-target-select" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Escopo do Rollout</label>
              <select id="rollout-target-select" [value]="rolloutTarget()" (change)="onRolloutTargetChange($event)" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500">
                <option value="ALL_STABLE">Todos os Tenants no Canal Stable</option>
                <option value="ALL_BETA">Todos os Tenants no Canal Beta</option>
                @for (c of companies(); track c.id) {
                  <option [value]="c.id">Específico: {{ c.name }} ({{ c.id }})</option>
                }
              </select>
            </div>

            <button (click)="executeRollout()" [disabled]="isRolloutRunning() || releases().length === 0"
                    class="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors">
              <mat-icon class="text-xs">send</mat-icon>
              {{ isRolloutRunning() ? 'Propagando...' : 'Propagar Atualização' }}
            </button>
          </div>

          <!-- Emergency Rollback Box -->
          <div class="bg-rose-950/20 border border-rose-500/30 rounded-xl p-5 space-y-3">
            <h5 class="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <mat-icon class="text-rose-400 text-sm">history</mat-icon>
              Rollback de Emergência
            </h5>
            <p class="text-[11px] text-rose-300/80 leading-relaxed">
              Caso uma release recente apresente instabilidade operacional em campo, reverta imediatamente o terminal para a versão homologada LTS (1.1.0-lts).
            </p>

            <div>
              <label for="rollback-target-select" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tenant para Rollback</label>
              <select id="rollback-target-select" [value]="rollbackTarget()" (change)="onRollbackTargetChange($event)" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-rose-500">
                @for (c of companies(); track c.id) {
                  <option [value]="c.id">{{ c.name }} (Versão Atual: {{ c.osTargetVersion || '1.1.0-lts' }})</option>
                }
              </select>
            </div>

            <button (click)="executeRollback()"
                    class="w-full py-2 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors">
              <mat-icon class="text-xs">undo</mat-icon>
              Reverter para 1.1.0-LTS
            </button>
          </div>
        </div>
      </div>

      <!-- Publish Release Modal -->
      @if (showPublishModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
            <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <mat-icon class="text-sm">publish</mat-icon>
                </div>
                <h4 class="text-sm font-bold text-white uppercase tracking-wider">Publicar Nova Release OTA</h4>
              </div>
              <button (click)="showPublishModal.set(false)" class="text-slate-500 hover:text-white transition-colors">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>

            <div class="p-6 space-y-4">
              <div>
                <label for="pub-version" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Versão SemVer *</label>
                <input id="pub-version" type="text" [value]="newVersion()" (input)="onNewVersionInput($event)" placeholder="Ex: 1.4.0 ou 1.5.0-beta"
                       class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none font-mono">
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="pub-channel" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Canal</label>
                  <select id="pub-channel" [value]="newChannel()" (change)="onNewChannelChange($event)"
                          class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
                    <option value="stable">Stable (Produção)</option>
                    <option value="beta">Beta (Homologação)</option>
                  </select>
                </div>

                <div>
                  <label for="pub-min-core" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Core Mínimo Exigido</label>
                  <input id="pub-min-core" type="text" [value]="newMinCore()" (input)="onNewMinCoreInput($event)" placeholder="1.0.0"
                         class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none font-mono">
                </div>
              </div>

              <div>
                <label for="pub-changelog" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Changelog (Um item por linha) *</label>
                <textarea id="pub-changelog" [value]="newChangelogText()" (input)="onNewChangelogInput($event)" rows="4" placeholder="Adicionado suporte a novas impressoras&#10;Melhoria na velocidade do checkout&#10;Correção de sincronismo offline"
                          class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"></textarea>
              </div>
            </div>

            <div class="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2">
              <button (click)="showPublishModal.set(false)" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider transition-colors">
                Cancelar
              </button>
              <button (click)="publishRelease()" [disabled]="!newVersion().trim() || !newChangelogText().trim()"
                      class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm">
                <mat-icon class="text-xs">cloud_upload</mat-icon>
                Publicar Release
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class OsReleasesManagerComponent implements OnInit {
  private http = inject(HqApiClient);
  private hqState = inject(HqStateService);

  releases = signal<OsRelease[]>([]);
  companies = signal<Company[]>([]);

  rolloutVersion = signal<string>('1.1.0-lts');
  rolloutTarget = signal<string>('ALL_STABLE');
  rollbackTarget = signal<string>('comp_burger');
  isRolloutRunning = signal(false);

  showPublishModal = signal(false);
  newVersion = signal('');
  newChannel = signal<'stable' | 'beta'>('stable');
  newMinCore = signal('1.0.0');
  newChangelogText = signal('');

  ngOnInit() {
    this.loadReleases();
    this.loadCompanies();
  }

  onRolloutVersionChange(event: Event) {
    this.rolloutVersion.set((event.target as HTMLSelectElement).value);
  }

  onRolloutTargetChange(event: Event) {
    this.rolloutTarget.set((event.target as HTMLSelectElement).value);
  }

  onRollbackTargetChange(event: Event) {
    this.rollbackTarget.set((event.target as HTMLSelectElement).value);
  }

  onNewVersionInput(e: Event) { this.newVersion.set((e.target as HTMLInputElement).value); }
  onNewChannelChange(e: Event) { this.newChannel.set((e.target as HTMLSelectElement).value as 'stable' | 'beta'); }
  onNewMinCoreInput(e: Event) { this.newMinCore.set((e.target as HTMLInputElement).value); }
  onNewChangelogInput(e: Event) { this.newChangelogText.set((e.target as HTMLTextAreaElement).value); }

  async loadReleases() {
    try {
      const data = await firstValueFrom(this.http.get<OsRelease[]>('/api/v1/distribution/os-releases'));
      this.releases.set(data);
      if (data.length > 0 && !this.rolloutVersion()) {
        this.rolloutVersion.set(data[0].version);
      }
    } catch (err: unknown) {
      console.error('Failed to load OS releases', err);
    }
  }

  async loadCompanies() {
    try {
      const data = await firstValueFrom(this.http.get<Company[]>('/api/v1/companies'));
      this.companies.set(data);
      if (data.length > 0) {
        this.rollbackTarget.set(data[0].id);
      }
    } catch (err: unknown) {
      console.error('Failed to load companies for rollout', err);
    }
  }

  prepareRollout(version: string) {
    this.rolloutVersion.set(version);
  }

  async publishRelease() {
    const version = this.newVersion().trim();
    const changelog = this.newChangelogText()
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (!version || changelog.length === 0) return;

    const payload = {
      version,
      channel: this.newChannel(),
      minRequiredByApps: this.newMinCore().trim() || '1.0.0',
      changelog
    };

    try {
      await firstValueFrom(this.http.post('/api/v1/distribution/os-releases', payload));
      this.hqState.addLog(`Release do OS '${version}' publicada com sucesso no canal '${this.newChannel()}'.`, 'success');
      this.showPublishModal.set(false);
      this.newVersion.set('');
      this.newChangelogText.set('');
      await this.loadReleases();
    } catch (err) {
      console.error('Falha ao publicar release', err);
    }
  }

  async executeRollout() {
    this.isRolloutRunning.set(true);
    try {
      const isSpecific = this.rolloutTarget() !== 'ALL_STABLE' && this.rolloutTarget() !== 'ALL_BETA';
      const payload = {
        version: this.rolloutVersion(),
        channel: this.rolloutTarget() === 'ALL_BETA' ? 'beta' : 'stable',
        targetCompanyId: isSpecific ? this.rolloutTarget() : undefined
      };
      await firstValueFrom(this.http.post('/api/v1/distribution/rollout-os', payload));
      this.hqState.addLog(`Rollout OTA disparado: Versão ${this.rolloutVersion()} aplicada para ${this.rolloutTarget()}`, 'success');
      await this.loadCompanies();
    } catch (err: unknown) {
      console.error('Failed to execute rollout', err);
      this.hqState.addLog('Falha ao disparar rollout OTA.', 'warn');
    } finally {
      this.isRolloutRunning.set(false);
    }
  }

  async executeRollback() {
    try {
      const targetId = this.rollbackTarget();
      await firstValueFrom(this.http.post('/api/v1/distribution/rollback-os', {
        targetCompanyId: targetId,
        targetVersion: '1.1.0-lts'
      }));
      const compName = this.companies().find(c => c.id === targetId)?.name || targetId;
      this.hqState.addLog(`Rollback de emergência acionado: ${compName} revertido para 1.1.0-lts com sucesso.`, 'warn');
      await this.loadCompanies();
    } catch (err: unknown) {
      console.error('Failed to execute rollback', err);
    }
  }
}
