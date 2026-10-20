/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TelegramBotConfigComponent, TelegramConfig } from './components/telegram-bot-config.component';
import { TelegramAlertFeedComponent, TelegramAlert } from './components/telegram-alert-feed.component';
import { OsSdkService } from '../../sdk/os-sdk.service';
import { OsContext } from '../../contracts/os/os-context.contract';

@Component({
  selector: 'app-telegram-integration',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    TelegramBotConfigComponent,
    TelegramAlertFeedComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full bg-slate-950 text-slate-100 p-6 overflow-y-auto space-y-6 font-sans">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-5">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <mat-icon class="text-2xl">send</mat-icon>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-black text-white uppercase tracking-wider">Telegram Manager Bot</h2>
              <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                SANDBOX / DEMO CONNECTOR
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">Alertas em tempo real para gestores de {{ app.companyName }}: sangrias, fechamento e estoque.</p>
          </div>
        </div>

        <div class="text-right hidden sm:block">
          <span class="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">CONEXÃO BOT API</span>
          <span class="text-xs font-black text-sky-400 font-mono">LONG POLLING ATIVO</span>
        </div>
      </div>

      <!-- 1. Bot Credentials & Options -->
      <app-telegram-bot-config
        [config]="config()"
        (updateBotToken)="handleUpdateToken($event)"
        (updateChatId)="handleUpdateChatId($event)"
        (toggleOption)="handleToggleOption($event)" />

      <!-- 2. Alert Feed -->
      <app-telegram-alert-feed
        [alerts]="alerts()"
        (sendTestAlert)="handleSendTestAlert()" />
    </div>
  `
})
export class Telegram implements OnInit, OnDestroy {
  private sdk = inject(OsSdkService);
  app: OsContext = this.sdk.bind('app_telegram');

  private subs: { unsubscribe: () => void }[] = [];

  config = signal<TelegramConfig>({
    botToken: 'SANDBOX_TELEGRAM_BOT_TOKEN_MOCK_SECRET_STORE',
    chatId: '-1001892837482',
    alertOnBleed: true,
    alertOnLowStock: true,
    alertOnShiftClose: true,
    alertOnSuspiciousRefund: true,
    alertOnMarketplaceOrder: true
  });

  alerts = signal<TelegramAlert[]>([
    {
      id: 'alt_1',
      category: 'CASH',
      title: 'Sangria de Caixa Registrada',
      message: '⚠️ Sangria de R$ 350,00 efetuada no Terminal 01 (Operador: Lucas Souza). Motivo: Recolhimento de cofre.',
      senderTerminal: 'TERM-01-POS',
      timestamp: new Date(Date.now() - 25 * 60000).toISOString()
    },
    {
      id: 'alt_2',
      category: 'CASH',
      title: 'Fechamento de Caixa Z - Turno Almoço',
      message: '📊 Resumo do Turno: R$ 2.450,00 em 34 pedidos. PIX: R$ 1.200 | Cartão: R$ 980 | Dinheiro: R$ 270.',
      senderTerminal: 'TERM-01-POS',
      timestamp: new Date(Date.now() - 180 * 60000).toISOString()
    },
    {
      id: 'alt_3',
      category: 'STOCK',
      title: 'Estoque Mínimo Atingido',
      message: '🚨 O produto "Queijo Cheddar Fatiado" atingiu 2 unidades em estoque (Mínimo: 5 unidades).',
      senderTerminal: 'SERVER-INVENTORY-CORE',
      timestamp: new Date(Date.now() - 360 * 60000).toISOString()
    }
  ]);

  ngOnInit() {
    // Escuta movimentações financeiras críticas para despachar alertas no Telegram em tempo real
    this.subs.push(
      this.app.events.subscribe('finance.transaction_created', (evt: any) => {
        const payload = evt?.payload;
        if (!payload) return;

        // Sangria (Bleed)
        if (payload.type === 'OUTFLOW' && payload.category === 'BLEED' && this.config().alertOnBleed) {
          const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
          const newAlert: TelegramAlert = {
            id: `alt_${uuid}`,
            category: 'CASH',
            title: 'Sangria de Caixa Registrada',
            message: `⚠️ Sangria de R$ ${payload.amount.toFixed(2)} registrada por ${payload.operator}. Motivo: ${payload.description || 'Retirada de cofre'}.`,
            senderTerminal: 'TERM-01-POS',
            timestamp: new Date().toISOString()
          };
          this.alerts.update(list => [newAlert, ...list]);
          this.app.notify('Alerta Telegram', 'Telegram Bot transmitiu aviso de sangria de caixa ao grupo de gestores.', 'warning');
        }

        // Suprimento de troco
        if (payload.type === 'INFLOW' && payload.category === 'SUPPLY' && this.config().alertOnBleed) {
          const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
          const newAlert: TelegramAlert = {
            id: `alt_${uuid}`,
            category: 'CASH',
            title: 'Suprimento de Troco Registrado',
            message: `📥 Suprimento de R$ ${payload.amount.toFixed(2)} adicionado por ${payload.operator}. Finalidade: ${payload.description || 'Fundo de troco inicial'}.`,
            senderTerminal: 'TERM-01-POS',
            timestamp: new Date().toISOString()
          };
          this.alerts.update(list => [newAlert, ...list]);
          this.app.notify('Alerta Telegram', 'Telegram Bot transmitiu aviso de reforço de troco ao grupo de gestores.', 'info');
        }
      }),

      this.app.events.subscribe('finance.shift_closed', (evt: any) => {
        const payload = evt?.payload;
        if (payload && this.config().alertOnShiftClose) {
          const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
          const newAlert: TelegramAlert = {
            id: `alt_${uuid}`,
            category: 'CASH',
            title: 'Fechamento de Caixa - Relatório Z',
            message: `📊 Resumo de Fechamento: Saldo em Caixa R$ ${payload.currentBalance.toFixed(2)}. Entradas: R$ ${payload.totalInflow.toFixed(2)} | Saídas: R$ ${payload.totalOutflow.toFixed(2)}. Quantidade de Operações: ${payload.salesCount}. Operador: ${payload.operator}.`,
            senderTerminal: 'TERM-01-POS',
            timestamp: new Date().toISOString()
          };
          this.alerts.update(list => [newAlert, ...list]);
          this.app.notify('Alerta Telegram', 'Telegram Bot transmitiu o balanço do Relatório Z de fechamento aos gestores.', 'success');
        }
      }),

      this.app.events.subscribe('marketplace.order_created', (evt: any) => {
        const payload = evt?.payload;
        if (payload && this.config().alertOnMarketplaceOrder) {
          const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
          const orderIdDisplay = payload.orderId ? String(payload.orderId).slice(-6).toUpperCase() : 'NOVO';
          const totalDisplay = Number(payload.total || 0).toFixed(2);
          const customer = payload.customerName || 'Cliente Online';
          const itemsCount = Array.isArray(payload.items) ? payload.items.length : 1;
          const newAlert: TelegramAlert = {
            id: `alt_${uuid}`,
            category: 'ORDER',
            title: `Novo Pedido Marketplace #${orderIdDisplay}`,
            message: `🛍️ Pedido online recebido via vitrine pública de ${customer}! Total: R$ ${totalDisplay} (${itemsCount} itens). Despachado para o KDS.`,
            senderTerminal: 'MARKETPLACE-WEB',
            timestamp: new Date().toISOString()
          };
          this.alerts.update(list => [newAlert, ...list]);
          this.app.notify('Telegram Bot', `Novo pedido online #${orderIdDisplay} notificado no canal de gestão.`, 'success');
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  handleUpdateToken(token: string) {
    this.config.update(c => ({ ...c, botToken: token }));
    this.app.notify('Configuração Salva', 'Token do Telegram Bot atualizado.', 'info');
  }

  handleUpdateChatId(chatId: string) {
    this.config.update(c => ({ ...c, chatId }));
    this.app.notify('Configuração Salva', 'Chat ID do Telegram atualizado.', 'info');
  }

  handleToggleOption(key: keyof TelegramConfig) {
    this.config.update(c => ({ ...c, [key]: !c[key] }));
    this.app.notify('Regra de Alerta', 'Gatilho de alerta atualizado.', 'info');
  }

  handleSendTestAlert() {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const newAlert: TelegramAlert = {
      id: `alt_${uuid}`,
      category: 'SYSTEM',
      title: '🔔 Teste de Conexão - 3eatcru OS',
      message: '✅ Conexão com Telegram Bot estabelecida com sucesso! Todos os alertas operacionais do sistema serão transmitidos neste canal.',
      senderTerminal: 'TERM-DEV-HUB',
      timestamp: new Date().toISOString()
    };

    this.alerts.update(list => [newAlert, ...list]);
    this.app.notify('Alerta Enviado', 'Mensagem de teste transmitida para o canal do Telegram.', 'info');
  }
}
