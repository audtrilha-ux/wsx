import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  alertOnBleed: boolean;
  alertOnLowStock: boolean;
  alertOnShiftClose: boolean;
  alertOnSuspiciousRefund: boolean;
  alertOnMarketplaceOrder: boolean;
}

@Component({
  selector: 'app-telegram-bot-config',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h4 class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <mat-icon class="text-sky-400 text-base">smart_toy</mat-icon>
            Credenciais do Bot & Chat de Gestão
          </h4>
          <p class="text-xs text-slate-400 mt-0.5">Configure o BotFather Token e o Chat ID do grupo de diretores/gerentes.</p>
        </div>
        <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
          BOT ATIVO
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="tg-bot-token" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Telegram Bot Token</label>
          <input 
            id="tg-bot-token"
            type="password"
            [value]="config().botToken"
            (input)="onTokenInput($event)"
            placeholder="684920194:AAF389xj_..."
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-sky-500 outline-none">
        </div>

        <div>
          <label for="tg-chat-id" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Target Chat / Group ID</label>
          <input 
            id="tg-chat-id"
            type="text"
            [value]="config().chatId"
            (input)="onChatIdInput($event)"
            placeholder="-1001892837482"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-sky-500 outline-none">
        </div>
      </div>

      <!-- Triggers Grid -->
      <div class="space-y-3 pt-2">
        <h5 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Alertas Gerenciais em Tempo Real</h5>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-white block">Sangrias de Caixa (CASH_OUT)</span>
              <span class="text-[10px] text-slate-500">Notificar retiradas manuais de dinheiro</span>
            </div>
            <input 
              type="checkbox"
              [checked]="config().alertOnBleed"
              (change)="toggleOption.emit('alertOnBleed')"
              class="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700">
          </label>

          <label class="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-white block">Fechamento de Turno / Caixa Z</span>
              <span class="text-[10px] text-slate-500">Enviar resumo consolidado de faturamento</span>
            </div>
            <input 
              type="checkbox"
              [checked]="config().alertOnShiftClose"
              (change)="toggleOption.emit('alertOnShiftClose')"
              class="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700">
          </label>

          <label class="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-white block">Alerta de Estoque Crítico</span>
              <span class="text-[10px] text-slate-500">Avisar quando itens atingem estoque mínimo</span>
            </div>
            <input 
              type="checkbox"
              [checked]="config().alertOnLowStock"
              (change)="toggleOption.emit('alertOnLowStock')"
              class="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700">
          </label>

          <label class="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-white block">Cancelamentos & Estornos</span>
              <span class="text-[10px] text-slate-500">Auditoria de estornos no PDV</span>
            </div>
            <input 
              type="checkbox"
              [checked]="config().alertOnSuspiciousRefund"
              (change)="toggleOption.emit('alertOnSuspiciousRefund')"
              class="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700">
          </label>

          <label class="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-white block">Pedidos do Marketplace</span>
              <span class="text-[10px] text-slate-500">Alertar novos pedidos da vitrine online</span>
            </div>
            <input 
              type="checkbox"
              [checked]="config().alertOnMarketplaceOrder"
              (change)="toggleOption.emit('alertOnMarketplaceOrder')"
              class="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700">
          </label>
        </div>
      </div>
    </div>
  `
})
export class TelegramBotConfigComponent {
  config = input.required<TelegramConfig>();
  updateBotToken = output<string>();
  updateChatId = output<string>();
  toggleOption = output<keyof TelegramConfig>();

  onTokenInput(event: Event) {
    this.updateBotToken.emit((event.target as HTMLInputElement).value);
  }

  onChatIdInput(event: Event) {
    this.updateChatId.emit((event.target as HTMLInputElement).value);
  }
}
