import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface ProvisionTenantPayload {
  name: string;
  balance: number;
  plan: 'starter' | 'pro' | 'enterprise';
  maxTerminals: number;
  channel: 'stable' | 'beta';
  installedApps: string[];
}

@Component({
  selector: 'app-tenant-provision-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <mat-icon class="text-sm">rocket_launch</mat-icon>
            </div>
            <div>
              <h4 class="text-sm font-bold text-white uppercase tracking-wider">Provisionar Novo Tenant</h4>
              <p class="text-[11px] text-slate-400">Criar novo espaço corporativo no ecossistema 3eatcru.</p>
            </div>
          </div>
          <button (click)="dismiss.emit()" class="text-slate-500 hover:text-white transition-colors">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <!-- Nome da Empresa -->
          <div>
            <label for="tenant-modal-name" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Nome da Empresa (Tenant) *
            </label>
            <input id="tenant-modal-name" type="text" [value]="name()" (input)="onNameInput($event)" placeholder="Ex: Hamburgueria 3eatcru"
                   class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-colors">
          </div>

          <!-- Plano Selection -->
          <div>
            <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Plano de Licenciamento</span>
            <div class="grid grid-cols-3 gap-2">
              <button type="button" (click)="selectPlan('starter')"
                      class="p-3 rounded-xl border text-left transition-all"
                      [ngClass]="plan() === 'starter' ? 'bg-indigo-600/10 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'">
                <div class="text-xs font-bold uppercase">Starter</div>
                <div class="text-sm font-mono font-bold text-indigo-400 mt-1">R$ 99/mês</div>
                <div class="text-[10px] text-slate-500 mt-1">Até 2 terminais</div>
              </button>

              <button type="button" (click)="selectPlan('pro')"
                      class="p-3 rounded-xl border text-left transition-all"
                      [ngClass]="plan() === 'pro' ? 'bg-indigo-600/10 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'">
                <div class="text-xs font-bold uppercase">Pro</div>
                <div class="text-sm font-mono font-bold text-indigo-400 mt-1">R$ 249/mês</div>
                <div class="text-[10px] text-slate-500 mt-1">Até 5 terminais</div>
              </button>

              <button type="button" (click)="selectPlan('enterprise')"
                      class="p-3 rounded-xl border text-left transition-all"
                      [ngClass]="plan() === 'enterprise' ? 'bg-indigo-600/10 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'">
                <div class="text-xs font-bold uppercase">Enterprise</div>
                <div class="text-sm font-mono font-bold text-indigo-400 mt-1">R$ 499/mês</div>
                <div class="text-[10px] text-slate-500 mt-1">Ilimitado</div>
              </button>
            </div>
          </div>

          <!-- Saldo e Terminais -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="tenant-modal-balance" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Saldo Inicial (R$)
              </label>
              <input id="tenant-modal-balance" type="number" [value]="balance()" (input)="onBalanceInput($event)"
                     class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none">
            </div>

            <div>
              <label for="tenant-modal-terminals" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Limite de Terminais
              </label>
              <input id="tenant-modal-terminals" type="number" [value]="maxTerminals()" (input)="onMaxTerminalsInput($event)"
                     class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none">
            </div>
          </div>

          <!-- Canal de Distribuição -->
          <div>
            <label for="tenant-modal-channel" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Canal de Distribuição do Core OS
            </label>
            <select id="tenant-modal-channel" [value]="channel()" (change)="onChannelChange($event)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none">
              <option value="stable">Stable (Releases Homologadas e LTS)</option>
              <option value="beta">Beta / Canary (Acesso Antecipado)</option>
            </select>
          </div>

          <!-- Apps Iniciais -->
          <div>
            <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Módulos Selecionados</span>
            <div class="grid grid-cols-2 gap-2">
              @for (app of availableAppOptions; track app.id) {
                <label class="flex items-center gap-2 text-xs text-slate-300 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input type="checkbox" [checked]="selectedApps().includes(app.id)" (change)="toggleApp(app.id)"
                         class="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500">
                  <span>{{ app.name }}</span>
                </label>
              }
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
          <button (click)="dismiss.emit()" class="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white text-xs font-bold uppercase transition-colors">
            Cancelar
          </button>
          <button (click)="submit()" [disabled]="!name().trim()"
                  class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors">
            <mat-icon class="text-sm">check</mat-icon>
            Provisionar Workspace
          </button>
        </div>
      </div>
    </div>
  `
})
export class TenantProvisionModalComponent {
  submitTenant = output<ProvisionTenantPayload>();
  dismiss = output<void>();

  name = signal('');
  balance = signal(1000);
  plan = signal<'starter' | 'pro' | 'enterprise'>('pro');
  maxTerminals = signal(5);
  channel = signal<'stable' | 'beta'>('stable');
  selectedApps = signal<string[]>(['app_settings', 'app_pos', 'app_inventory', 'app_crm', 'app_finance', 'app_public_space']);

  onNameInput(event: Event) {
    this.name.set((event.target as HTMLInputElement).value);
  }

  onBalanceInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.balance.set(val ? Number(val) : 0);
  }

  onMaxTerminalsInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.maxTerminals.set(val ? Number(val) : 1);
  }

  onChannelChange(event: Event) {
    this.channel.set((event.target as HTMLSelectElement).value as 'stable' | 'beta');
  }

  availableAppOptions = [
    { id: 'app_settings', name: 'Painel de Controle' },
    { id: 'app_pos', name: 'Ponto de Venda' },
    { id: 'app_inventory', name: 'Estoque' },
    { id: 'app_crm', name: 'CRM & Fidelidade' },
    { id: 'app_finance', name: 'Finanças & Caixa' },
    { id: 'app_tables', name: 'Mesas & KDS' },
    { id: 'app_public_space', name: 'Presença Digital' }
  ];

  selectPlan(p: 'starter' | 'pro' | 'enterprise') {
    this.plan.set(p);
    if (p === 'starter') {
      this.maxTerminals.set(2);
      this.selectedApps.set(['app_settings', 'app_pos', 'app_public_space']);
    } else if (p === 'pro') {
      this.maxTerminals.set(5);
      this.selectedApps.set(['app_settings', 'app_pos', 'app_inventory', 'app_crm', 'app_finance', 'app_tables', 'app_public_space']);
    } else {
      this.maxTerminals.set(99);
      this.selectedApps.set(['app_settings', 'app_pos', 'app_inventory', 'app_crm', 'app_finance', 'app_tables', 'app_public_space']);
    }
  }

  toggleApp(appId: string) {
    this.selectedApps.update(apps => 
      apps.includes(appId) ? apps.filter(id => id !== appId) : [...apps, appId]
    );
  }

  submit() {
    if (!this.name().trim()) return;
    this.submitTenant.emit({
      name: this.name().trim(),
      balance: this.balance(),
      plan: this.plan(),
      maxTerminals: this.maxTerminals(),
      channel: this.channel(),
      installedApps: this.selectedApps()
    });
  }
}
