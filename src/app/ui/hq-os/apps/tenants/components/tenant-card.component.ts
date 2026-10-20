import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Company } from '../../../../../core/domain/company/company.entity';

@Component({
  selector: 'app-tenant-card',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between gap-4">
      <div>
        <div class="flex items-start justify-between gap-3 mb-2">
          <div>
            <div class="flex items-center gap-2">
              <h5 class="font-bold text-white text-base">{{ company().name }}</h5>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono"
                    [ngClass]="company().status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'">
                {{ company().status === 'active' ? 'Ativo' : 'Suspenso' }}
              </span>
            </div>
            <div class="text-[10px] text-slate-500 font-mono mt-0.5">ID: {{ company().id }}</div>
          </div>

          <!-- Plan Badge -->
          <div class="text-right">
            <span class="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider font-mono border"
                  [ngClass]="{
                    'bg-indigo-500/10 text-indigo-400 border-indigo-500/30': company().plan === 'enterprise',
                    'bg-blue-500/10 text-blue-400 border-blue-500/30': company().plan === 'pro',
                    'bg-slate-800 text-slate-400 border-slate-700': company().plan === 'starter'
                  }">
              Plano {{ company().plan | uppercase }}
            </span>
          </div>
        </div>

        <!-- Metadata badges -->
        <div class="grid grid-cols-3 gap-2 my-3 py-2 border-y border-slate-900 bg-slate-900/40 rounded-lg px-3">
          <div>
            <div class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Terminais</div>
            <div class="text-xs font-mono font-bold text-slate-300">
              {{ company().activeTerminals || 0 }} / {{ company().maxTerminals || 5 }}
            </div>
          </div>
          <div>
            <div class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Canal OS</div>
            <div class="text-xs font-mono font-bold" [ngClass]="company().channel === 'beta' ? 'text-amber-400' : 'text-slate-300'">
              {{ (company().channel || 'stable') | uppercase }}
            </div>
          </div>
          <div>
            <div class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Versão OS</div>
            <div class="text-xs font-mono font-bold text-slate-300">
              {{ company().osTargetVersion || '1.1.0-lts' }}
            </div>
          </div>
        </div>

        <!-- Installed Modules -->
        <div class="text-xs text-slate-400">
          <span class="font-bold text-slate-500 text-[10px] uppercase tracking-wider block mb-1">Módulos Instalados ({{ company().installedApps.length }}):</span>
          <div class="flex flex-wrap gap-1">
            @for (app of company().installedApps; track app) {
              <span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono">
                {{ app.replace('app_', '') }}
              </span>
            }
            @if (company().installedApps.length === 0) {
              <span class="text-[10px] text-slate-600 italic">Nenhum módulo ativo</span>
            }
          </div>
        </div>
      </div>

      <!-- Footer: Balance & Actions -->
      <div class="pt-3 border-t border-slate-800/80 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Saldo de Licença</div>
            <div class="text-sm font-mono font-black" [ngClass]="company().balance < 0 ? 'text-rose-400' : 'text-emerald-400'">
              {{ company().balance | currency:'BRL' }}
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button (click)="impersonateTenant.emit(company())" title="Acessar Workspace no Client OS (Magic Link / Suporte HQ)"
                    class="h-7 px-2 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/20 flex items-center gap-1 text-xs font-bold transition-colors">
              <mat-icon class="text-xs">open_in_new</mat-icon>
              <span>Acessar</span>
            </button>

            <button (click)="adjustCredit.emit(company())" title="Adicionar Créditos / Recarga"
                    class="h-7 px-2 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 flex items-center gap-1 text-xs font-bold transition-colors">
              <mat-icon class="text-xs">add_card</mat-icon>
              <span>Crédito</span>
            </button>

            <button (click)="toggleStatus.emit(company())" 
                    [title]="company().status === 'active' ? 'Suspender Tenant' : 'Ativar Tenant'"
                    class="w-7 h-7 rounded flex items-center justify-center transition-colors"
                    [ngClass]="company().status === 'active' ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'">
              <mat-icon class="text-xs">{{ company().status === 'active' ? 'lock' : 'lock_open' }}</mat-icon>
            </button>
          </div>
        </div>

        <!-- Management Row -->
        <div class="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-900">
          <button (click)="manageBranches.emit(company())" title="Gerenciar Filiais e Unidades"
                  class="py-1.5 px-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors border border-slate-800">
            <mat-icon class="text-xs text-emerald-400">storefront</mat-icon>
            <span>Filiais</span>
          </button>

          <button (click)="manageDevices.emit(company())" title="Gerenciar Terminais de Hardware e Quotas"
                  class="py-1.5 px-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors border border-slate-800">
            <mat-icon class="text-xs text-indigo-400">devices</mat-icon>
            <span>Terminais</span>
          </button>

          <button (click)="manageUsers.emit(company())" title="Gerenciar Usuários e Operadores"
                  class="py-1.5 px-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors border border-slate-800">
            <mat-icon class="text-xs text-blue-400">people</mat-icon>
            <span>Usuários</span>
          </button>

          <button (click)="configureTenant.emit(company())" title="Configurar Plano e Módulos"
                  class="py-1.5 px-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors border border-slate-800">
            <mat-icon class="text-xs text-slate-400">tune</mat-icon>
            <span>Configs</span>
          </button>
        </div>
      </div>
    </div>
  `
})
export class TenantCardComponent {
  company = input.required<Company>();

  adjustCredit = output<Company>();
  manageBranches = output<Company>();
  manageDevices = output<Company>();
  manageUsers = output<Company>();
  toggleStatus = output<Company>();
  configureTenant = output<Company>();
  impersonateTenant = output<Company>();
}
