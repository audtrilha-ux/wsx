import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface WhatsappTemplate {
  id: string;
  trigger: 'SALE_COMPLETED' | 'ORDER_READY' | 'DELIVERY_DISPATCHED' | 'ORDER_CREATED';
  title: string;
  enabled: boolean;
  messageText: string;
}

@Component({
  selector: 'app-whatsapp-template-config',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h4 class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <mat-icon class="text-emerald-400 text-base">forum</mat-icon>
            Gatilhos de Notificação Automática
          </h4>
          <p class="text-xs text-slate-400 mt-0.5">Mensagens transacionais disparadas automaticamente quando eventos ocorrem no OS.</p>
        </div>
        <div class="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-right hidden md:block">
          <span class="text-[9px] text-slate-500 uppercase font-black block">WHATSAPP SANDBOX</span>
          <span class="text-[11px] font-mono text-emerald-400 font-bold">{{ sandboxNumber() }}</span>
        </div>
      </div>

      <div class="space-y-4">
        @for (tpl of templates(); track tpl.id) {
          <div class="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" [class.bg-emerald-400]="tpl.enabled" [class.bg-slate-600]="!tpl.enabled"></span>
                <span class="text-xs font-bold text-white uppercase tracking-wide">{{ tpl.title }}</span>
                <span class="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Evento: {{ tpl.trigger }}
                </span>
              </div>
              <button 
                type="button"
                (click)="toggleTemplate.emit(tpl.id)"
                class="text-[11px] font-bold px-3 py-1 rounded-lg transition-colors"
                [class.bg-emerald-500/10]="tpl.enabled"
                [class.text-emerald-400]="tpl.enabled"
                [class.border]="true"
                [class.border-emerald-500/20]="tpl.enabled"
                [class.bg-slate-800]="!tpl.enabled"
                [class.text-slate-400]="!tpl.enabled">
                {{ tpl.enabled ? 'ATIVO' : 'DESATIVADO' }}
              </button>
            </div>

            <div class="relative">
              <p class="text-xs font-mono text-slate-300 bg-slate-900/90 border border-slate-800 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                {{ tpl.messageText }}
              </p>
            </div>

            <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1">
              <span>Variáveis disponíveis: &#123;customer_name&#125;, &#123;total&#125;, &#123;order_id&#125;, &#123;points_earned&#125;</span>
              <button 
                type="button"
                (click)="testDispatch.emit(tpl.id)"
                class="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors">
                <mat-icon class="text-xs">send</mat-icon> Simular Envio de Teste
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class WhatsappTemplateConfigComponent {
  templates = input.required<WhatsappTemplate[]>();
  sandboxNumber = input<string>('+55 (11) 98765-4321');
  toggleTemplate = output<string>();
  testDispatch = output<string>();
}
