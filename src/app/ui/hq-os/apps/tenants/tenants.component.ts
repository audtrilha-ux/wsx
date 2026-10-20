import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HqApiClient } from '../../../../core/api/api-client';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HqStateService } from '../../hq-state.service';
import { IdentityService } from '../../../../core/identity/identity.service';
import { Company } from '../../../../core/domain/company/company.entity';
import { TenantCardComponent } from './components/tenant-card.component';
import { TenantProvisionModalComponent, ProvisionTenantPayload } from './components/tenant-provision-modal.component';
import { TenantCreditModalComponent, CreditAdjustmentPayload } from './components/tenant-credit-modal.component';
import { TenantUsersModalComponent } from './components/tenant-users-modal.component';
import { TenantStatusModalComponent, StatusTogglePayload } from './components/tenant-status-modal.component';
import { TenantConfigModalComponent, TenantConfigPayload } from './components/tenant-config-modal.component';
import { TenantBranchesModalComponent } from './components/tenant-branches-modal.component';
import { TenantDevicesModalComponent } from './components/tenant-devices-modal.component';

@Component({
  selector: 'app-hq-tenants',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    TenantCardComponent,
    TenantProvisionModalComponent,
    TenantCreditModalComponent,
    TenantUsersModalComponent,
    TenantStatusModalComponent,
    TenantConfigModalComponent,
    TenantBranchesModalComponent,
    TenantDevicesModalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Top Bar / Controls -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <mat-icon class="text-sm">domain</mat-icon>
            </div>
            <h3 class="text-lg font-bold text-white uppercase tracking-wider">Gestão de SaaS Tenants</h3>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            Controle de autoridade (HQ > Tenant > Filiais > Terminais), planos, quotas de hardware e suporte remoto.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button (click)="loadCompanies()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors">
            <mat-icon class="text-sm">refresh</mat-icon>
            Atualizar
          </button>

          <button (click)="showProvisionModal.set(true)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm">
            <mat-icon class="text-sm">add_circle</mat-icon>
            Provisionar Novo Tenant
          </button>
        </div>
      </div>

      <!-- Filters & Stats Row -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total de Tenants</div>
            <div class="text-lg font-mono font-bold text-white">{{ companiesList().length }}</div>
          </div>
          <mat-icon class="text-slate-600">business</mat-icon>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Workspaces Ativos</div>
            <div class="text-lg font-mono font-bold text-emerald-400">{{ activeCount() }}</div>
          </div>
          <mat-icon class="text-emerald-500/50">check_circle</mat-icon>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Suspensos / Bloqueados</div>
            <div class="text-lg font-mono font-bold text-rose-400">{{ suspendedCount() }}</div>
          </div>
          <mat-icon class="text-rose-500/50">block</mat-icon>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Terminais Ativos</div>
            <div class="text-lg font-mono font-bold text-indigo-400">{{ totalTerminals() }}</div>
          </div>
          <mat-icon class="text-indigo-500/50">devices</mat-icon>
        </div>
      </div>

      <!-- Search & Status Filter -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
        <div class="relative w-full sm:w-72">
          <input type="text" [value]="searchQuery()" (input)="onSearchInput($event)" placeholder="Buscar por nome ou ID..."
                 class="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
          <mat-icon class="absolute left-2.5 top-2.5 text-slate-500 text-xs">search</mat-icon>
        </div>

        <div class="flex items-center gap-1.5 w-full sm:w-auto">
          <button (click)="statusFilter.set('ALL')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  [ngClass]="statusFilter() === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'">
            Todos ({{ companiesList().length }})
          </button>
          <button (click)="statusFilter.set('active')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  [ngClass]="statusFilter() === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'">
            Ativos ({{ activeCount() }})
          </button>
          <button (click)="statusFilter.set('suspended')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  [ngClass]="statusFilter() === 'suspended' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'">
            Suspensos ({{ suspendedCount() }})
          </button>
        </div>
      </div>

      <!-- Tenants Grid -->
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (company of filteredCompanies(); track company.id) {
          <app-tenant-card
            [company]="company"
            (adjustCredit)="openCreditModal($event)"
            (manageBranches)="openBranchesModal($event)"
            (manageDevices)="openDevicesModal($event)"
            (manageUsers)="openUsersModal($event)"
            (toggleStatus)="openStatusModal($event)"
            (configureTenant)="openConfigModal($event)"
            (impersonateTenant)="onImpersonateTenant($event)" />
        }
      </div>

      @if (filteredCompanies().length === 0) {
        <div class="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <mat-icon class="text-4xl text-slate-600 mb-2">search_off</mat-icon>
          <div class="text-sm text-slate-400 font-bold">Nenhum tenant encontrado</div>
          <div class="text-xs text-slate-500 mt-1">Verifique o filtro de status ou a busca digitada.</div>
        </div>
      }

      <!-- Modals -->
      @if (showProvisionModal()) {
        <app-tenant-provision-modal
          (submitTenant)="onProvisionTenant($event)"
          (dismiss)="showProvisionModal.set(false)" />
      }

      @if (selectedForBranches()) {
        <app-tenant-branches-modal
          [company]="selectedForBranches()!"
          (dismiss)="selectedForBranches.set(null)" />
      }

      @if (selectedForDevices()) {
        <app-tenant-devices-modal
          [company]="selectedForDevices()!"
          (dismiss)="selectedForDevices.set(null)" />
      }

      @if (selectedForCredit()) {
        <app-tenant-credit-modal
          [company]="selectedForCredit()!"
          (submitCredit)="onCreditSubmit($event)"
          (dismiss)="selectedForCredit.set(null)" />
      }

      @if (selectedForUsers()) {
        <app-tenant-users-modal
          [company]="selectedForUsers()!"
          (dismiss)="selectedForUsers.set(null)" />
      }

      @if (selectedForStatus()) {
        <app-tenant-status-modal
          [company]="selectedForStatus()!"
          (confirmStatus)="onStatusConfirm($event)"
          (dismiss)="selectedForStatus.set(null)" />
      }

      @if (selectedForConfig()) {
        <app-tenant-config-modal
          [company]="selectedForConfig()!"
          (saveConfig)="onSaveConfig($event)"
          (dismiss)="selectedForConfig.set(null)" />
      }
    </div>
  `
})
export class HqTenantsComponent implements OnInit {
  private http = inject(HqApiClient);
  private hqState = inject(HqStateService);
  private identityService = inject(IdentityService);
  private router = inject(Router);

  companiesList = signal<Company[]>([]);
  searchQuery = signal('');
  statusFilter = signal<'ALL' | 'active' | 'suspended'>('ALL');

  // Modals state
  showProvisionModal = signal(false);
  selectedForBranches = signal<Company | null>(null);
  selectedForDevices = signal<Company | null>(null);
  selectedForCredit = signal<Company | null>(null);
  selectedForUsers = signal<Company | null>(null);
  selectedForStatus = signal<Company | null>(null);
  selectedForConfig = signal<Company | null>(null);

  activeCount = computed(() => this.companiesList().filter(c => c.status === 'active').length);
  suspendedCount = computed(() => this.companiesList().filter(c => c.status === 'suspended').length);
  totalTerminals = computed(() => this.companiesList().reduce((acc, c) => acc + (c.activeTerminals || 1), 0));

  filteredCompanies = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.statusFilter();
    return this.companiesList().filter(c => {
      const matchesQuery = !query || c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query);
      const matchesStatus = filter === 'ALL' || c.status === filter;
      return matchesQuery && matchesStatus;
    });
  });

  ngOnInit() {
    this.loadCompanies();
  }

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  async loadCompanies() {
    try {
      const list = await firstValueFrom(this.http.get<Company[]>('/api/v1/companies'));
      this.companiesList.set(list);
    } catch (err: unknown) {
      console.error('Failed to load companies in HQ', err);
    }
  }

  openBranchesModal(company: Company) {
    this.selectedForBranches.set(company);
  }

  openDevicesModal(company: Company) {
    this.selectedForDevices.set(company);
  }

  openCreditModal(company: Company) {
    this.selectedForCredit.set(company);
  }

  openUsersModal(company: Company) {
    this.selectedForUsers.set(company);
  }

  openStatusModal(company: Company) {
    this.selectedForStatus.set(company);
  }

  openConfigModal(company: Company) {
    this.selectedForConfig.set(company);
  }

  onImpersonateTenant(company: Company) {
    this.identityService.impersonateTenant({ id: company.id, name: company.name });
    this.hqState.addLog(`Magic Link de Suporte ativado para o tenant: ${company.name} (${company.id})`, 'info');
    this.router.navigateByUrl('/os');
  }

  async onProvisionTenant(payload: ProvisionTenantPayload) {
    try {
      await firstValueFrom(this.http.post<{ id: string; company: Company }>('/api/v1/companies', payload));
      this.showProvisionModal.set(false);
      this.hqState.addLog(`Novo SaaS Tenant provisionado: ${payload.name} (Plano: ${payload.plan.toUpperCase()}, Limite: ${payload.maxTerminals} terminais)`, 'success');
      await this.loadCompanies();
    } catch (err: unknown) {
      console.error('Falha ao provisionar tenant', err);
    }
  }

  async onCreditSubmit(payload: CreditAdjustmentPayload) {
    try {
      await firstValueFrom(this.http.post(`/api/v1/companies/${payload.companyId}/adjust-balance`, {
        amount: payload.amount,
        description: payload.description,
        type: 'CREDIT_ADDED'
      }));
      this.selectedForCredit.set(null);
      this.hqState.addLog(`Aporte de R$ ${payload.amount.toFixed(2)} registrado com auditoria para ${this.companiesList().find(c => c.id === payload.companyId)?.name}. Motivo: ${payload.description}`, 'success');
      await this.loadCompanies();
    } catch (err: unknown) {
      console.error('Falha ao adicionar créditos', err);
    }
  }

  async onSaveConfig(payload: TenantConfigPayload) {
    try {
      const existing = this.companiesList().find(c => c.id === payload.companyId);
      if (!existing) return;

      const updated = {
        ...existing,
        name: payload.name,
        plan: payload.plan,
        maxTerminals: payload.maxTerminals,
        channel: payload.channel,
        osTargetVersion: payload.osTargetVersion,
        installedApps: payload.installedApps
      };

      await firstValueFrom(this.http.put(`/api/v1/companies/${payload.companyId}`, updated));
      this.selectedForConfig.set(null);
      this.hqState.addLog(`Configurações e módulos do tenant ${payload.name} atualizados com sucesso.`, 'success');
      await this.loadCompanies();
    } catch (err: unknown) {
      console.error('Falha ao atualizar configurações do tenant', err);
    }
  }

  async onStatusConfirm(payload: StatusTogglePayload) {
    try {
      await firstValueFrom(this.http.put(`/api/v1/companies/${payload.company.id}`, {
        ...payload.company,
        status: payload.newStatus
      }));
      this.selectedForStatus.set(null);
      const isBlock = payload.newStatus === 'suspended';
      this.hqState.addLog(`SaaS Tenant ${payload.company.name} foi ${isBlock ? 'SUSPENSO' : 'REATIVADO'}. Motivo: ${payload.reason}`, isBlock ? 'warn' : 'success');
      await this.loadCompanies();
    } catch (err: unknown) {
      console.error('Falha ao alterar status', err);
    }
  }
}
