import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface TelegramAlert {
  id: string;
  category: 'CASH' | 'STOCK' | 'SYSTEM' | 'AUDIT' | 'ORDER';
  title: string;
  message: string;
  senderTerminal: string;
  timestamp: string;
}

@Component({
  selector: 'app-telegram-alert-feed',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h4 class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <mat-icon class="text-sky-400 text-base">send</mat-icon>
            Feed de Notificações Enviadas ao Telegram
          </h4>
          <p class="text-xs text-slate-400 mt-0.5">Histórico de alertas push gerenciais encaminhados aos diretores.</p>
        </div>
        <button 
          type="button"
          (click)="sendTestAlert.emit()"
          class="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-sky-900/20">
          <mat-icon class="text-sm">notifications_active</mat-icon> Disparar Alerta Teste
        </button>
      </div>

      <div class="space-y-3 max-h-[300px] overflow-y-auto pr-1">
        @for (alert of alerts(); track alert.id) {
          <div class="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2 hover:border-slate-700 transition-colors">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded"
                  [class.bg-emerald-500/10]="alert.category === 'ORDER'"
                  [class.text-emerald-400]="alert.category === 'ORDER'"
                  [class.border-emerald-500/20]="alert.category === 'ORDER'"
                  [class.bg-amber-500/10]="alert.category === 'CASH'"
                  [class.text-amber-400]="alert.category === 'CASH'"
                  [class.border]="true"
                  [class.border-amber-500/20]="alert.category === 'CASH'"
                  [class.bg-rose-500/10]="alert.category === 'STOCK'"
                  [class.text-rose-400]="alert.category === 'STOCK'"
                  [class.border-rose-500/20]="alert.category === 'STOCK'"
                  [class.bg-sky-500/10]="alert.category === 'SYSTEM' || alert.category === 'AUDIT'"
                  [class.text-sky-400]="alert.category === 'SYSTEM' || alert.category === 'AUDIT'"
                  [class.border-sky-500/20]="alert.category === 'SYSTEM' || alert.category === 'AUDIT'">
                  {{ alert.category }}
                </span>
                <span class="text-xs font-bold text-white">{{ alert.title }}</span>
              </div>
              <span class="text-[10px] font-mono text-slate-500">{{ alert.timestamp | date:'shortTime' }}</span>
            </div>

            <p class="text-xs text-slate-300 font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
              {{ alert.message }}
            </p>

            <div class="flex items-center justify-between text-[10px] text-slate-500">
              <span>Terminal Origem: {{ alert.senderTerminal }}</span>
              <span class="text-sky-400 font-bold flex items-center gap-1">
                <mat-icon class="text-[11px] w-3 h-3">done_all</mat-icon> Entregue no Grupo
              </span>
            </div>
          </div>
        }
        @if (alerts().length === 0) {
          <div class="text-center py-8 text-slate-500 text-xs">Nenhum alerta enviado ainda.</div>
        }
      </div>
    </div>
  `
})
export class TelegramAlertFeedComponent {
  alerts = input.required<TelegramAlert[]>();
  sendTestAlert = output<void>();
}
