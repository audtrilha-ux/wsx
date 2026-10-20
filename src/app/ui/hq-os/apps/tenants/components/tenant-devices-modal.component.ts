import { Component, ChangeDetectionStrategy, input, output, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HqApiClient } from '../../../../../core/api/api-client';
import { firstValueFrom } from 'rxjs';
import { Company, CompanyBranch } from '../../../../../core/domain/company/company.entity';
import { HqStateService } from '../../../hq-state.service';

export interface DeviceData {
  deviceId: string;
  companyId: string;
  branchId?: string;
  name: string;
  installationId: string;
  fingerprintHash: string;
  platform: 'web' | 'windows' | 'android';
  osVersion: string;
  status: 'active' | 'blocked' | 'pending';
  lastSeenAt: string;
  registeredAt: string;
  ipAddress?: string;
}

@Component({
  selector: 'app-tenant-devices-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <mat-icon class="text-sm">devices</mat-icon>
            </div>
            <div>
              <h4 class="text-sm font-bold text-white uppercase tracking-wider">Terminais de Hardware & Quotas</h4>
              <p class="text-[11px] text-slate-400 font-mono">{{ company().name }} ({{ devices().length }} / {{ company().maxTerminals }} terminais)</p>
            </div>
          </div>
          <button (click)="dismiss.emit()" class="text-slate-500 hover:text-white transition-colors">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          <!-- Quota Warning / Progress Bar -->
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-slate-300 uppercase tracking-wider">Quota de Terminais Autorizados</span>
              <span class="font-mono font-bold" [ngClass]="isQuotaFull() ? 'text-amber-400' : 'text-emerald-400'">
                {{ devices().length }} de {{ company().maxTerminals }} utilizados
              </span>
            </div>
            <div class="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div class="h-full transition-all duration-300"
                   [style.width.%]="quotaPercentage()"
                   [ngClass]="isQuotaFull() ? 'bg-amber-500' : 'bg-indigo-500'"></div>
            </div>
            <p class="text-[11px] text-slate-500">
              Terminais excedentes serão bloqueados até que o plano seja atualizado ou um dispositivo inativo seja desvinculado.
            </p>
          </div>

          <!-- Register Device Form -->
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <mat-icon class="text-indigo-400 text-sm">add_to_queue</mat-icon>
              Registrar / Autorizar Novo Terminal
            </h5>

            <div class="grid sm:grid-cols-3 gap-3">
              <div>
                <label for="dev-name" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome do Terminal *</label>
                <input id="dev-name" type="text" [value]="formName()" (input)="onNameInput($event)" placeholder="Ex: PDV Caixa 01"
                       class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
              </div>

              <div>
                <label for="dev-branch" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filial Vinculada</label>
                <select id="dev-branch" [value]="formBranchId()" (change)="onBranchChange($event)"
                        class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
                  @for (b of branches(); track b.id) {
                    <option [value]="b.id">{{ b.name }} ({{ b.id }})</option>
                  }
                </select>
              </div>

              <div>
                <label for="dev-platform" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Plataforma</label>
                <select id="dev-platform" [value]="formPlatform()" (change)="onPlatformChange($event)"
                        class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
                  <option value="web">Web Browser</option>
                  <option value="windows">Windows Desktop (Offline-first)</option>
                  <option value="android">Android POS / SmartPOS</option>
                </select>
              </div>
            </div>

            <div class="flex justify-end pt-1">
              <button (click)="registerDevice()" [disabled]="!formName().trim() || isQuotaFull()"
                      class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm">
                <mat-icon class="text-xs">add</mat-icon>
                Autorizar Terminal
              </button>
            </div>
          </div>

          <!-- Devices List -->
          <div class="space-y-3">
            <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Terminais Registrados ({{ devices().length }})
            </h5>

            <div class="space-y-2.5">
              @for (dev of devices(); track dev.deviceId) {
                <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <h6 class="text-sm font-bold text-white">{{ dev.name }}</h6>
                      <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono border"
                            [ngClass]="{
                              'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': dev.status === 'active',
                              'bg-rose-500/10 text-rose-400 border-rose-500/20': dev.status === 'blocked',
                              'bg-amber-500/10 text-amber-400 border-amber-500/20': dev.status === 'pending'
                            }">
                        {{ dev.status === 'active' ? 'Ativo' : dev.status === 'blocked' ? 'Bloqueado' : 'Pendente' }}
                      </span>
                      <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono bg-slate-900 border border-slate-800 text-slate-400">
                        {{ dev.platform }}
                      </span>
                    </div>

                    <div class="text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span>ID: <strong class="text-slate-300 font-mono">{{ dev.deviceId }}</strong></span>
                      <span>Filial: <strong class="text-slate-300">{{ getBranchName(dev.branchId) }}</strong></span>
                      <span>OS: <strong class="text-slate-300 font-mono">{{ dev.osVersion }}</strong></span>
                      @if (dev.ipAddress) {
                        <span>IP: <strong class="text-slate-300 font-mono">{{ dev.ipAddress }}</strong></span>
                      }
                      <span>Visto em: <strong class="text-slate-300 font-mono">{{ dev.lastSeenAt | date:'dd/MM HH:mm' }}</strong></span>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button (click)="toggleDeviceStatus(dev)"
                            [title]="dev.status === 'active' ? 'Bloquear terminal' : 'Ativar terminal'"
                            class="px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors border"
                            [ngClass]="dev.status === 'active' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'">
                      <mat-icon class="text-xs">{{ dev.status === 'active' ? 'block' : 'check_circle' }}</mat-icon>
                      {{ dev.status === 'active' ? 'Bloquear' : 'Desbloquear' }}
                    </button>

                    <button (click)="deleteDevice(dev.deviceId)" title="Desvincular terminal"
                            class="p-1.5 rounded text-rose-400 hover:bg-rose-500/10 transition-colors">
                      <mat-icon class="text-sm">delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
              @if (devices().length === 0) {
                <div class="text-center py-6 text-slate-500 text-xs font-mono">Nenhum terminal cadastrado para esta empresa.</div>
              }
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button (click)="dismiss.emit()" class="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `
})
export class TenantDevicesModalComponent implements OnInit {
  company = input.required<Company>();
  dismiss = output<void>();

  private http = inject(HqApiClient);
  private hqState = inject(HqStateService);

  devices = signal<DeviceData[]>([]);
  branches = signal<CompanyBranch[]>([]);

  formName = signal('');
  formBranchId = signal('');
  formPlatform = signal<'web' | 'windows' | 'android'>('web');

  isQuotaFull = () => this.devices().length >= (this.company().maxTerminals || 5);
  quotaPercentage = () => Math.min(100, Math.round((this.devices().length / (this.company().maxTerminals || 5)) * 100));

  ngOnInit() {
    this.loadBranches();
    this.loadDevices();
  }

  onNameInput(e: Event) { this.formName.set((e.target as HTMLInputElement).value); }
  onBranchChange(e: Event) { this.formBranchId.set((e.target as HTMLSelectElement).value); }
  onPlatformChange(e: Event) { this.formPlatform.set((e.target as HTMLSelectElement).value as 'web' | 'windows' | 'android'); }

  getBranchName(branchId?: string): string {
    if (!branchId) return 'Padrão / Matriz';
    const found = this.branches().find(b => b.id === branchId);
    return found ? found.name : branchId;
  }

  async loadBranches() {
    try {
      const list = await firstValueFrom(this.http.get<CompanyBranch[]>(`/api/v1/companies/${this.company().id}/branches`));
      this.branches.set(list);
      if (list.length > 0 && !this.formBranchId()) {
        this.formBranchId.set(list[0].id);
      }
    } catch (err) {
      console.error('Falha ao carregar filiais', err);
    }
  }

  async loadDevices() {
    try {
      const list = await firstValueFrom(this.http.get<DeviceData[]>(`/api/v1/companies/${this.company().id}/devices`));
      this.devices.set(list);
    } catch (err) {
      console.error('Falha ao carregar dispositivos', err);
    }
  }

  async registerDevice() {
    const name = this.formName().trim();
    if (!name) return;

    const payload = {
      name,
      branchId: this.formBranchId() || undefined,
      platform: this.formPlatform(),
      installationId: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fingerprintHash: `fp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      osVersion: this.company().osTargetVersion || '1.1.0-lts'
    };

    try {
      await firstValueFrom(this.http.post(`/api/v1/companies/${this.company().id}/devices`, payload));
      this.hqState.addLog(`Terminal '${name}' registrado com sucesso para ${this.company().name}.`, 'success');
      this.formName.set('');
      await this.loadDevices();
    } catch (err: unknown) {
      console.error('Falha ao registrar dispositivo', err);
    }
  }

  async toggleDeviceStatus(dev: DeviceData) {
    const nextStatus = dev.status === 'active' ? 'blocked' : 'active';
    try {
      await firstValueFrom(this.http.patch(`/api/v1/companies/${this.company().id}/devices/${dev.deviceId}/status`, {
        status: nextStatus
      }));
      this.hqState.addLog(`Status do terminal '${dev.name}' alterado para ${nextStatus.toUpperCase()}.`, 'info');
      await this.loadDevices();
    } catch (err) {
      console.error('Falha ao alterar status do terminal', err);
    }
  }

  async deleteDevice(deviceId: string) {
    try {
      await firstValueFrom(this.http.delete(`/api/v1/companies/${this.company().id}/devices/${deviceId}`));
      this.hqState.addLog(`Terminal desvinculado com sucesso.`, 'warn');
      await this.loadDevices();
    } catch (err) {
      console.error('Falha ao desvincular terminal', err);
    }
  }
}
