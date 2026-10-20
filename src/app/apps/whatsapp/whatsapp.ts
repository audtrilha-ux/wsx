/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, ChangeDetectionStrategy, signal, inject, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WhatsappQrConnectComponent } from './components/whatsapp-qr-connect.component';
import { WhatsappTemplateConfigComponent, WhatsappTemplate } from './components/whatsapp-template-config.component';
import { WhatsappMessageLogsComponent, WhatsappMessageLog } from './components/whatsapp-message-logs.component';
import { OsSdkService } from '../../sdk/os-sdk.service';
import { OsContext } from '../../contracts/os/os-context.contract';

@Component({
  selector: 'app-whatsapp-integration',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    WhatsappQrConnectComponent,
    WhatsappTemplateConfigComponent,
    WhatsappMessageLogsComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full bg-slate-950 text-slate-100 p-6 overflow-y-auto space-y-6 font-sans">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-5">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <mat-icon class="text-2xl">chat</mat-icon>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-black text-white uppercase tracking-wider">WhatsApp Business Hub</h2>
              <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                SANDBOX / DEMO CONNECTOR
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">Automação de notificações, recibos digitais e status de pedidos para {{ app.companyName }}.</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="text-right hidden sm:block">
            <span class="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">TAXA DE ENTREGA</span>
            <span class="text-xs font-black text-emerald-400 font-mono">99.8% ONLINE</span>
          </div>
        </div>
      </div>

      <!-- 1. QR Code / Connection Box -->
      <app-whatsapp-qr-connect
        [isConnected]="isConnected()"
        (connect)="handleConnect()"
        (disconnect)="handleDisconnect()" />

      <!-- 2. Notification Templates -->
      <app-whatsapp-template-config
        [templates]="templates()"
        [sandboxNumber]="sandboxNumber()"
        (toggleTemplate)="handleToggleTemplate($event)"
        (testDispatch)="handleTestDispatch($event)" />

      <!-- 3. Message Dispatch Logs -->
      <app-whatsapp-message-logs
        [logs]="messageLogs()" />
    </div>
  `
})
export class Whatsapp implements OnInit, OnDestroy {
  private sdk = inject(OsSdkService);
  app: OsContext = this.sdk.bind('app_whatsapp');

  isConnected = signal<boolean>(false);
  private subs: { unsubscribe: () => void }[] = [];
  
  sandboxNumber = computed(() => String(this.app.config.get('whatsapp_sandbox_num') || '+55 (11) 98765-4321'));
  templates = signal<WhatsappTemplate[]>([
    {
      id: 'tpl_sale',
      trigger: 'SALE_COMPLETED',
      title: 'Comprovante Digital de Compra & Pontos',
      enabled: true,
      messageText: 'Olá {{customer_name}}! 🛍️ Sua compra de R$ {{total}} foi confirmada com sucesso. Você acumulou {{points_earned}} pontos no Clube Fidelidade!'
    },
    {
      id: 'tpl_order_created',
      trigger: 'ORDER_CREATED',
      title: 'Confirmação de Pedido Online (Marketplace)',
      enabled: true,
      messageText: 'Olá {{customer_name}}! 🛍️ Seu pedido #{{order_id}} no valor de R$ {{total}} foi recebido e já está na fila de preparo da cozinha.'
    },
    {
      id: 'tpl_order_ready',
      trigger: 'ORDER_READY',
      title: 'Pedido Pronto para Retirada / Servir',
      enabled: true,
      messageText: 'Seu pedido #{{order_id}} está prontinho e quentinho! 🎉 Pode retirar no balcão de atendimento.'
    },
    {
      id: 'tpl_delivery',
      trigger: 'DELIVERY_DISPATCHED',
      title: 'Saiu para Entrega / Delivery',
      enabled: true,
      messageText: '🛵 Seu pedido #{{order_id}} acabou de sair para entrega com o motorista parceiro. Tempo estimado: 15-25 min.'
    }
  ]);

  messageLogs = signal<WhatsappMessageLog[]>([
    {
      id: 'log_1',
      recipientPhone: '+55 (11) 98765-4321',
      recipientName: 'Carlos Eduardo Silva',
      event: 'SALE_COMPLETED',
      content: 'Olá Carlos! Sua compra de R$ 84,80 foi confirmada (+8 pontos)',
      status: 'DELIVERED',
      timestamp: new Date(Date.now() - 10 * 60000).toISOString()
    },
    {
      id: 'log_2',
      recipientPhone: '+55 (11) 97654-3210',
      recipientName: 'Mariana Oliveira Costa',
      event: 'ORDER_READY',
      content: 'Seu pedido #ORD-8419 está pronto no balcão',
      status: 'DELIVERED',
      timestamp: new Date(Date.now() - 45 * 60000).toISOString()
    },
    {
      id: 'log_3',
      recipientPhone: '+55 (21) 99887-6655',
      recipientName: 'Juliana Beatriz Santos',
      event: 'DELIVERY_DISPATCHED',
      content: '🛵 Seu pedido #DEL-104 saiu para entrega',
      status: 'SENT',
      timestamp: new Date(Date.now() - 120 * 60000).toISOString()
    }
  ]);

  ngOnInit() {
    // Escuta eventos de vendas finalizadas no PDV para envio de mensagem instantânea pelo WhatsApp
    this.subs.push(
      this.app.events.subscribe('sale.completed', (evt: any) => {
        const payload = evt?.payload;
        if (payload && this.isConnected()) {
          const tpl = this.templates().find(t => t.id === 'tpl_sale');
          if (tpl && tpl.enabled) {
            const text = tpl.messageText
              .replace('{{customer_name}}', payload.customerName || 'Cliente')
              .replace('{{total}}', (payload.total || 0).toFixed(2))
              .replace('{{points_earned}}', String(payload.earnedPoints || 0));

            const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
            const newLog: WhatsappMessageLog = {
              id: `log_${uuid}`,
              recipientPhone: this.sandboxNumber(),
              recipientName: payload.customerName || 'Consumidor Presencial',
              event: 'SALE_COMPLETED',
              content: text,
              status: 'DELIVERED',
              timestamp: new Date().toISOString()
            };

            this.messageLogs.update(logs => [newLog, ...logs]);
            this.app.notify(
              'Notificação WhatsApp',
              `Mensagem enviada com sucesso para ${payload.customerName || 'Cliente'} sobre sua última compra.`,
              'success'
            );
          }
        }
      }),

      this.app.events.subscribe('marketplace.order_created', (evt: any) => {
        const payload = evt?.payload;
        if (payload && this.isConnected()) {
          const tpl = this.templates().find(t => t.id === 'tpl_order_created');
          if (tpl && tpl.enabled) {
            const customerName = payload.customerName || 'Cliente';
            const customerPhone = payload.customerPhone || this.sandboxNumber();
            const orderId = payload.orderId ? String(payload.orderId).slice(-6).toUpperCase() : 'ORD';
            const total = Number(payload.total || 0).toFixed(2);
            const text = tpl.messageText
              .replace('{{customer_name}}', customerName)
              .replace('{{order_id}}', orderId)
              .replace('{{total}}', total);

            const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
            const newLog: WhatsappMessageLog = {
              id: `log_${uuid}`,
              recipientPhone: customerPhone,
              recipientName: customerName,
              event: 'ORDER_CREATED',
              content: text,
              status: 'DELIVERED',
              timestamp: new Date().toISOString()
            };

            this.messageLogs.update(logs => [newLog, ...logs]);
            this.app.notify(
              'Notificação WhatsApp',
              `Confirmação de pedido #${orderId} enviada para ${customerName}.`,
              'success'
            );
          }
        }
      })
    );

    // Escuta alterações de status de pedidos no KDS / Marketplace para envio de notificações instantâneas de preparo e entrega
    this.subs.push(
      this.app.events.subscribe('marketplace.order_status_updated', (evt: any) => {
        const payload = evt?.payload;
        if (payload && this.isConnected()) {
          const { orderId, status, order } = payload;
          if (status === 'READY' || status === 'DELIVERING') {
            const templateId = status === 'READY' ? 'tpl_order_ready' : 'tpl_delivery';
            const tpl = this.templates().find(t => t.id === templateId);
            if (tpl && tpl.enabled) {
              const customerName = order?.customerName || payload.customerName || 'Cliente Online';
              const customerPhone = order?.customerPhone || payload.customerPhone || this.sandboxNumber();
              const text = tpl.messageText
                .replace('{{customer_name}}', customerName)
                .replace('{{order_id}}', (orderId || 'ORD').slice(-6).toUpperCase());

              const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
              const newLog: WhatsappMessageLog = {
                id: `log_${uuid}`,
                recipientPhone: customerPhone,
                recipientName: customerName,
                event: status === 'READY' ? 'ORDER_READY' : 'DELIVERY_DISPATCHED',
                content: text,
                status: 'DELIVERED',
                timestamp: new Date().toISOString()
              };

              this.messageLogs.update(logs => [newLog, ...logs]);
              this.app.notify(
                'Notificação WhatsApp',
                `Mensagem enviada: status do pedido #${(orderId || 'ORD').slice(-6).toUpperCase()} é agora ${status}.`,
                'success'
              );
            }
          }
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  handleConnect() {
    this.isConnected.set(true);
    this.app.notify('WhatsApp Conectado', 'Instância do WhatsApp Cloud vinculada com sucesso.', 'info');
  }

  handleDisconnect() {
    this.isConnected.set(false);
    this.app.notify('WhatsApp Desconectado', 'Sessão do WhatsApp finalizada.', 'warning');
  }

  handleToggleTemplate(templateId: string) {
    this.templates.update(list => list.map(item => {
      if (item.id === templateId) {
        return { ...item, enabled: !item.enabled };
      }
      return item;
    }));
    this.app.notify('Configuração Salva', 'Gatilho de notificação atualizado.', 'info');
  }

  handleTestDispatch(templateId: string) {
    const tpl = this.templates().find(t => t.id === templateId);
    if (!tpl) return;

    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const newLog: WhatsappMessageLog = {
      id: `log_${uuid}`,
      recipientPhone: this.sandboxNumber(),
      recipientName: 'Cliente Teste (Simulação)',
      event: tpl.trigger,
      content: tpl.messageText.replace('{{customer_name}}', 'Cliente').replace('{{total}}', '99.90').replace('{{points_earned}}', '10'),
      status: 'DELIVERED',
      timestamp: new Date().toISOString()
    };

    this.messageLogs.update(logs => [newLog, ...logs]);
    this.app.notify('WhatsApp Enviado', `Mensagem de teste disparada com sucesso para o evento ${tpl.trigger}`, 'info');
  }
}
