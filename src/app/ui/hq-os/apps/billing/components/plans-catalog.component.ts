import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface PlanDefinition {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  monthlyPrice: number;
  maxTerminals: number;
  description: string;
  includedApps: string[];
  features: string[];
}

@Component({
  selector: 'app-plans-catalog',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <mat-icon class="text-indigo-400 text-sm">workspace_premium</mat-icon>
            Catálogo Canônico de Planos SaaS & Quotas
          </h4>
          <p class="text-xs text-slate-400 mt-0.5">Planos que definem limites de terminais (Client OS) e pacotes de módulos inclusos.</p>
        </div>
      </div>

      <div class="grid md:grid-cols-3 gap-4">
        @for (plan of plans(); track plan.id) {
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
            <div>
              <div class="flex items-start justify-between gap-2 mb-2">
                <span class="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider font-mono border"
                      [ngClass]="{
                        'bg-indigo-500/10 text-indigo-400 border-indigo-500/30': plan.id === 'enterprise',
                        'bg-blue-500/10 text-blue-400 border-blue-500/30': plan.id === 'pro',
                        'bg-slate-800 text-slate-400 border-slate-700': plan.id === 'starter'
                      }">
                  {{ plan.name }}
                </span>
                <span class="text-xs text-slate-500 font-mono">Quota: {{ plan.maxTerminals }} terminais</span>
              </div>

              <div class="my-3">
                <div class="text-2xl font-black font-mono text-white">
                  {{ plan.monthlyPrice | currency:'BRL' }}
                  <span class="text-xs font-normal text-slate-400 font-sans">/mês</span>
                </div>
                <p class="text-xs text-slate-400 mt-1">{{ plan.description }}</p>
              </div>

              <!-- Features list -->
              <div class="space-y-1.5 my-4 border-t border-slate-900 pt-3">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Capacidades:</span>
                @for (feat of plan.features; track feat) {
                  <div class="flex items-center gap-2 text-xs text-slate-300">
                    <mat-icon class="text-xs text-emerald-400 shrink-0">check</mat-icon>
                    <span>{{ feat }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Included Apps badges -->
            <div class="pt-3 border-t border-slate-900">
              <span class="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Apps Inclusos:</span>
              <div class="flex flex-wrap gap-1">
                @for (app of plan.includedApps; track app) {
                  <span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono">
                    {{ app.replace('app_', '') }}
                  </span>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class PlansCatalogComponent {
  plans = input.required<PlanDefinition[]>();
}
