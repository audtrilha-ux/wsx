import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface WhatsappMessageLog {
  id: string;
  recipientPhone: string;
  recipientName: string;
  event: string;
  content: string;
  status: 'DELIVERED' | 'SENT' | 'FAILED';
  timestamp: string;
}

@Component({
  selector: 'app-whatsapp-message-logs',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h4 class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <mat-icon class="text-emerald-400 text-base">receipt_long</mat-icon>
            Fila de Mensagens & Logs de Entrega
          </h4>
          <p class="text-xs text-slate-400 mt-0.5">Histórico recente de mensagens enviadas aos clientes via WhatsApp Cloud API.</p>
        </div>
        <span class="text-xs text-slate-400 font-mono">{{ logs().length }} registros</span>
      </div>

      <div class="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
        @for (log of logs(); track log.id) {
          <div class="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors">
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-white">{{ log.recipientName }}</span>
                <span class="text-[11px] font-mono text-slate-400">({{ log.recipientPhone }})</span>
                <span class="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                  {{ log.event }}
                </span>
              </div>
              <p class="text-[11px] text-slate-400 font-mono line-clamp-1">{{ log.content }}</p>
            </div>

            <div class="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <span class="text-[10px] text-slate-500 font-mono">{{ log.timestamp | date:'shortTime' }}</span>
              <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                [class.bg-emerald-500/10]="log.status === 'DELIVERED'"
                [class.text-emerald-400]="log.status === 'DELIVERED'"
                [class.border]="true"
                [class.border-emerald-500/20]="log.status === 'DELIVERED'"
                [class.bg-sky-500/10]="log.status === 'SENT'"
                [class.text-sky-400]="log.status === 'SENT'"
                [class.border-sky-500/20]="log.status === 'SENT'">
                <mat-icon class="text-[12px] w-3 h-3">
                  {{ log.status === 'DELIVERED' ? 'done_all' : 'done' }}
                </mat-icon>
                {{ log.status }}
              </span>
            </div>
          </div>
        }
        @if (logs().length === 0) {
          <div class="text-center py-8 text-slate-500 text-xs">Nenhuma mensagem disparada recentemente.</div>
        }
      </div>
    </div>
  `
})
export class WhatsappMessageLogsComponent {
  logs = input.required<WhatsappMessageLog[]>();
}
