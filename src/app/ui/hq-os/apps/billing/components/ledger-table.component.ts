import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface CompanyLedgerEntry {
  id: string;
  companyId: string;
  type: 'CREDIT_ADDED' | 'APP_CHARGE' | 'PLAN_CHARGE';
  amount: number;
  previousBalance: number;
  newBalance: number;
  description: string;
  timestamp: string;
}

@Component({
  selector: 'app-ledger-table',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <mat-icon class="text-indigo-400 text-sm">history_edu</mat-icon>
          Livro-Razão & Extrato de Auditoria (Ledger)
        </h5>
        <span class="text-xs text-slate-500 font-mono">{{ entries().length }} lançamentos registrados</span>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
        <table class="w-full text-left text-xs text-slate-300">
          <thead class="text-[10px] text-slate-400 uppercase bg-slate-900/80 border-b border-slate-800">
            <tr>
              <th class="px-4 py-2.5">Data / Hora</th>
              <th class="px-4 py-2.5">Tipo</th>
              <th class="px-4 py-2.5">Descrição</th>
              <th class="px-4 py-2.5 text-right">Valor</th>
              <th class="px-4 py-2.5 text-right">Saldo Resultante</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-900">
            @for (entry of entries(); track entry.id) {
              <tr class="hover:bg-slate-900/40 transition-colors">
                <td class="px-4 py-3 font-mono text-slate-400 text-[11px]">
                  {{ entry.timestamp | date:'dd/MM/yyyy HH:mm' }}
                </td>
                <td class="px-4 py-3">
                  <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono border"
                        [ngClass]="{
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': entry.type === 'CREDIT_ADDED',
                          'bg-rose-500/10 text-rose-400 border-rose-500/20': entry.type === 'APP_CHARGE',
                          'bg-indigo-500/10 text-indigo-400 border-indigo-500/20': entry.type === 'PLAN_CHARGE'
                        }">
                    {{ entry.type === 'CREDIT_ADDED' ? 'Aporte' : (entry.type === 'APP_CHARGE' ? 'Módulo' : 'Plano') }}
                  </span>
                </td>
                <td class="px-4 py-3 font-medium text-white">{{ entry.description }}</td>
                <td class="px-4 py-3 text-right font-mono font-bold"
                    [ngClass]="entry.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                  {{ entry.amount >= 0 ? '+' : '' }}{{ entry.amount | currency:'BRL' }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-slate-300 font-bold">
                  {{ entry.newBalance | currency:'BRL' }}
                </td>
              </tr>
            }
            @if (entries().length === 0) {
              <tr>
                <td colspan="5" class="px-4 py-8 text-center text-slate-500 font-mono">
                  Nenhum lançamento no livro-razão para o filtro selecionado.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class LedgerTableComponent {
  entries = input.required<CompanyLedgerEntry[]>();
}
