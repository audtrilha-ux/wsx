import { Component, ChangeDetectionStrategy, input, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Company } from '../../../../../core/domain/company/company.entity';

export interface TenantConfigPayload {
  companyId: string;
  name: string;
  plan: 'starter' | 'pro' | 'enterprise';
  maxTerminals: number;
  channel: 'stable' | 'beta';
  osTargetVersion: string;
  installedApps: string[];
}

const ALL_AVAILABLE_APPS = [
  { id: 'app_pos', name: 'PDV 365 & Vendas', icon: 'point_of_sale' },
  { id: 'app_tables', name: 'Mesas & Comandas', icon: 'table_restaurant' },
  { id: 'app_inventory', name: 'Estoque & Insumos', icon: 'inventory_2' },
  { id: 'app_crm', name: 'CRM & Fidelidade', icon: 'card_membership' },
  { id: 'app_finance', name: 'Financeiro & Caixa', icon: 'payments' },
  { id: 'app_ifood', name: 'Integração iFood', icon: 'delivery_dining' },
  { id: 'app_whatsapp', name: 'WhatsApp Bot API', icon: 'chat' },
  { id: 'app_telegram', name: 'Telegram Bot API', icon: 'send' }
];

@Component({
  selector: 'app-tenant-config-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <!-- Header -->
        <div class="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <mat-icon class="text-lg">tune</mat-icon>
            </div>
            <div>
              <h4 class="text-sm font-bold text-white uppercase tracking-wider">Configurações & Módulos do Tenant</h4>
              <p class="text-xs text-slate-400">{{ company().name }} (ID: {{ company().id }})</p>
            </div>
          </div>
          <button (click)="dismiss.emit()" class="text-slate-500 hover:text-white transition-colors">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto space-y-6 font-sans">
          <!-- Basic Info & Tier -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="config-name" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nome do Tenant</label>
              <input id="config-name" type="text" [value]="name()" (input)="onNameInput($event)"
                     class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
            </div>

            <div>
              <label for="config-plan" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Plano Contratado</label>
              <select id="config-plan" [value]="plan()" (change)="onPlanChange($event)"
                      class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
                <option value="starter">Starter (Básico)</option>
                <option value="pro">Pro (Profissional)</option>
                <option value="enterprise">Enterprise (Corporativo)</option>
              </select>
            </div>

            <div>
              <label for="config-terminals" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quota de Terminais Máximos</label>
              <input id="config-terminals" type="number" min="1" max="50" [value]="maxTerminals()" (input)="onTerminalsInput($event)"
                     class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none font-mono">
            </div>

            <div>
              <label for="config-channel" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Canal do Client OS</label>
              <select id="config-channel" [value]="channel()" (change)="onChannelChange($event)"
                      class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
                <option value="stable">STABLE (Produção)</option>
                <option value="beta">BETA (Early Access)</option>
              </select>
            </div>
          </div>

          <!-- Modules Checklist -->
          <div class="border-t border-slate-800/80 pt-5">
            <div class="flex items-center justify-between mb-3">
              <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <mat-icon class="text-xs text-indigo-400">apps</mat-icon>
                Módulos & Aplicativos Habilitados ({{ selectedApps().length }})
              </h5>
              <button (click)="selectAllApps()" class="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold">
                Selecionar Todos
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              @for (app of availableApps; track app.id) {
                <button type="button" (click)="toggleApp(app.id)"
                        class="p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3"
                        [ngClass]="isAppEnabled(app.id) 
                          ? 'bg-indigo-950/30 border-indigo-500/40 text-white' 
                          : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                         [ngClass]="isAppEnabled(app.id) ? 'bg-indigo-600/30 text-indigo-300' : 'bg-slate-900 text-slate-500'">
                      <mat-icon class="text-sm">{{ app.icon }}</mat-icon>
                    </div>
                    <span class="text-xs font-bold truncate">{{ app.name }}</span>
                  </div>
                  <mat-icon class="text-sm shrink-0"
                            [ngClass]="isAppEnabled(app.id) ? 'text-indigo-400' : 'text-slate-600'">
                    {{ isAppEnabled(app.id) ? 'check_box' : 'check_box_outline_blank' }}
                  </mat-icon>
                </button>
              }
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
          <button (click)="dismiss.emit()" class="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors">
            Cancelar
          </button>
          <button (click)="submitConfig()" class="px-5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-600/20">
            <mat-icon class="text-sm">save</mat-icon>
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  `
})
export class TenantConfigModalComponent implements OnInit {
  company = input.required<Company>();

  dismiss = output<void>();
  saveConfig = output<TenantConfigPayload>();

  availableApps = ALL_AVAILABLE_APPS;

  name = signal('');
  plan = signal<'starter' | 'pro' | 'enterprise'>('pro');
  maxTerminals = signal(5);
  channel = signal<'stable' | 'beta'>('stable');
  osTargetVersion = signal('1.1.0-lts');
  selectedApps = signal<string[]>([]);

  ngOnInit() {
    const comp = this.company();
    this.name.set(comp.name);
    this.plan.set(comp.plan || 'pro');
    this.maxTerminals.set(comp.maxTerminals || 5);
    this.channel.set(comp.channel || 'stable');
    this.osTargetVersion.set(comp.osTargetVersion || '1.1.0-lts');
    this.selectedApps.set([...(comp.installedApps || [])]);
  }

  onNameInput(event: Event) {
    this.name.set((event.target as HTMLInputElement).value);
  }

  onPlanChange(event: Event) {
    this.plan.set((event.target as HTMLSelectElement).value as 'starter' | 'pro' | 'enterprise');
  }

  onTerminalsInput(event: Event) {
    this.maxTerminals.set(Number((event.target as HTMLInputElement).value) || 1);
  }

  onChannelChange(event: Event) {
    this.channel.set((event.target as HTMLSelectElement).value as 'stable' | 'beta');
  }

  isAppEnabled(appId: string): boolean {
    return this.selectedApps().includes(appId);
  }

  toggleApp(appId: string) {
    this.selectedApps.update(list => {
      if (list.includes(appId)) {
        return list.filter(id => id !== appId);
      } else {
        return [...list, appId];
      }
    });
  }

  selectAllApps() {
    this.selectedApps.set(this.availableApps.map(a => a.id));
  }

  submitConfig() {
    this.saveConfig.emit({
      companyId: this.company().id,
      name: this.name().trim() || this.company().name,
      plan: this.plan(),
      maxTerminals: this.maxTerminals(),
      channel: this.channel(),
      osTargetVersion: this.osTargetVersion(),
      installedApps: this.selectedApps()
    });
  }
}
