import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CashSummary } from '../../domain/finance.entity';

@Component({
  selector: 'app-finance-summary-cards',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <!-- KPI Summary Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Card 1: Saldo em Caixa -->
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <mat-icon class="text-2xl">account_balance</mat-icon>
          </div>
          <div>
            <span class="text-xs text-slate-500 font-medium">Saldo Líquido em Caixa</span>
            <div class="text-xl font-bold text-slate-900 font-mono">
              R$ {{ (summary()?.currentCashBalance || 0) | number:'1.2-2' }}
            </div>
            <span class="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
              <mat-icon class="text-[12px]">trending_up</mat-icon> Caixa Operacional Ativo
            </span>
          </div>
        </div>

        <!-- Card 2: Total de Entradas -->
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <mat-icon class="text-2xl">arrow_downward</mat-icon>
          </div>
          <div>
            <span class="text-xs text-slate-500 font-medium">Total Entradas (Vendas + Supr.)</span>
            <div class="text-xl font-bold text-blue-700 font-mono">
              R$ {{ (summary()?.totalInflow || 0) | number:'1.2-2' }}
            </div>
            <span class="text-[10px] text-slate-400">
              {{ summary()?.salesCount || 0 }} vendas processadas
            </span>
          </div>
        </div>

        <!-- Card 3: Total de Saídas / Despesas -->
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <mat-icon class="text-2xl">arrow_upward</mat-icon>
          </div>
          <div>
            <span class="text-xs text-slate-500 font-medium">Total Saídas & Despesas</span>
            <div class="text-xl font-bold text-rose-600 font-mono">
              R$ {{ (summary()?.totalOutflow || 0) | number:'1.2-2' }}
            </div>
            <span class="text-[10px] text-rose-500 font-medium">
              Despesas e compras locais
            </span>
          </div>
        </div>

        <!-- Card 4: Sangrias de Caixa -->
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <mat-icon class="text-2xl">lock_clock</mat-icon>
          </div>
          <div>
            <span class="text-xs text-slate-500 font-medium">Sangrias (Retiradas Cofre)</span>
            <div class="text-xl font-bold text-amber-700 font-mono">
              R$ {{ (summary()?.totalBleed || 0) | number:'1.2-2' }}
            </div>
            <span class="text-[10px] text-slate-500">
              Suprimentos: R$ {{ (summary()?.totalSupply || 0) | number:'1.2-2' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Breakdown by Payment Method Bar -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <mat-icon class="text-slate-400 text-sm">pie_chart</mat-icon>
            Distribuição por Meio de Pagamento
          </h3>
          <span class="text-[11px] text-slate-400 font-mono">Conferência de gaveta e contas bancárias</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="p-3 bg-slate-50 border border-slate-100 rounded-lg flex flex-col">
            <span class="text-[11px] text-slate-500 font-bold flex items-center gap-1">
              <mat-icon class="text-xs text-emerald-600">payments</mat-icon> Dinheiro em Espécie
            </span>
            <span class="text-sm font-bold font-mono text-slate-900 mt-1">
              R$ {{ (summary()?.breakdownByMethod?.dinheiro || 0) | number:'1.2-2' }}
            </span>
          </div>

          <div class="p-3 bg-slate-50 border border-slate-100 rounded-lg flex flex-col">
            <span class="text-[11px] text-slate-500 font-bold flex items-center gap-1">
              <mat-icon class="text-xs text-teal-600">qr_code</mat-icon> PIX Instantâneo
            </span>
            <span class="text-sm font-bold font-mono text-slate-900 mt-1">
              R$ {{ (summary()?.breakdownByMethod?.pix || 0) | number:'1.2-2' }}
            </span>
          </div>

          <div class="p-3 bg-slate-50 border border-slate-100 rounded-lg flex flex-col">
            <span class="text-[11px] text-slate-500 font-bold flex items-center gap-1">
              <mat-icon class="text-xs text-blue-600">credit_card</mat-icon> Cartão de Débito
            </span>
            <span class="text-sm font-bold font-mono text-slate-900 mt-1">
              R$ {{ (summary()?.breakdownByMethod?.cartaoDebito || 0) | number:'1.2-2' }}
            </span>
          </div>

          <div class="p-3 bg-slate-50 border border-slate-100 rounded-lg flex flex-col">
            <span class="text-[11px] text-slate-500 font-bold flex items-center gap-1">
              <mat-icon class="text-xs text-indigo-600">credit_card</mat-icon> Cartão de Crédito
            </span>
            <span class="text-sm font-bold font-mono text-slate-900 mt-1">
              R$ {{ (summary()?.breakdownByMethod?.cartaoCredito || 0) | number:'1.2-2' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class FinanceSummaryCardsComponent {
  summary = input<CashSummary | null>(null);
}
