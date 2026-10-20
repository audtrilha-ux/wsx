import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HqApiClient } from '../../../../core/api/api-client';
import { firstValueFrom } from 'rxjs';
import { HqStateService } from '../../hq-state.service';
import { OsReleasesManagerComponent } from './components/os-releases-manager.component';

@Component({
  selector: 'app-hq-dev-hub',
  standalone: true,
  imports: [CommonModule, MatIconModule, OsReleasesManagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <mat-icon class="text-sm">terminal</mat-icon>
            </div>
            <h3 class="text-lg font-bold text-white uppercase tracking-wider">HQ Developer Hub & Engenharia</h3>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            Distribuição OTA do Core OS, sandbox de API REST e simulador de webhooks para integradores e engenheiros.
          </p>
        </div>

        <div class="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button (click)="activeTab.set('OTA')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  [ngClass]="activeTab() === 'OTA' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
            <mat-icon class="text-xs">system_update</mat-icon>
            Distribuição & OTA
          </button>
          <button (click)="activeTab.set('SANDBOX')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  [ngClass]="activeTab() === 'SANDBOX' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
            <mat-icon class="text-xs">api</mat-icon>
            API Sandbox
          </button>
          <button (click)="activeTab.set('WEBHOOKS')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  [ngClass]="activeTab() === 'WEBHOOKS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
            <mat-icon class="text-xs">webhook</mat-icon>
            Webhooks
          </button>
        </div>
      </div>

      <!-- Tab 1: OTA & OS Releases Distribution -->
      @if (activeTab() === 'OTA') {
        <app-os-releases-manager />
      }

      <!-- Tab 2: REST API Sandbox -->
      @if (activeTab() === 'SANDBOX') {
        <div class="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
          <div class="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
            <mat-icon class="text-indigo-400 text-sm">api</mat-icon>
            <h4 class="text-sm font-bold text-white uppercase tracking-wider">REST API Sandbox</h4>
          </div>
          
          <div class="p-5 space-y-4">
            <div>
              <label for="sandbox-endpoint-select" class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Endpoint de Teste (GET)</label>
              <div class="flex flex-col sm:flex-row gap-3">
                <select id="sandbox-endpoint-select" [value]="selectedEndpoint()" (change)="onEndpointChange($event)" class="flex-1 bg-slate-950 border border-slate-700 rounded text-sm text-slate-300 px-3 py-2 outline-none focus:border-indigo-500 font-mono">
                  <option value="companies">/api/v1/companies</option>
                  <option value="marketplace">/api/v1/marketplace/listings</option>
                  <option value="hq-apps">/api/v1/hq/apps</option>
                  <option value="licensing">/api/v1/licensing/plans</option>
                  <option value="releases">/api/v1/distribution/os-releases</option>
                </select>
                <button (click)="executeSandboxRequest()" [disabled]="responseLoading()" class="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded flex items-center gap-2 transition-colors shrink-0">
                  @if (responseLoading()) {
                    <mat-icon class="text-sm animate-spin">sync</mat-icon>
                  } @else {
                    <mat-icon class="text-sm">send</mat-icon>
                  }
                  SEND
                </button>
              </div>
            </div>
          </div>

          <div class="flex-1 bg-slate-950 p-4 border-t border-slate-800 flex flex-col min-h-[250px]">
            <div class="flex justify-between items-center mb-3">
              <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Response Payload</span>
              @if (responseStatus()) {
                <span class="px-2 py-0.5 rounded text-[10px] font-bold font-mono"
                      [class]="responseStatus() === 200 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'">
                  HTTP {{ responseStatus() }}
                </span>
              }
            </div>
            
            <div class="flex-1 bg-slate-900/50 rounded border border-slate-800/60 p-3 overflow-y-auto max-h-[300px]">
              @if (responsePayload()) {
                <pre class="text-[11px] font-mono text-indigo-300">{{ responsePayload() | json }}</pre>
              } @else {
                <div class="h-full flex items-center justify-center text-slate-600 text-xs font-mono">
                  Nenhuma requisição executada. Selecione um endpoint e clique em SEND.
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Tab 3: Webhooks Simulator -->
      @if (activeTab() === 'WEBHOOKS') {
        <div class="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
          <div class="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
            <mat-icon class="text-emerald-400 text-sm">webhook</mat-icon>
            <h4 class="text-sm font-bold text-white uppercase tracking-wider">Simulador de Webhooks</h4>
          </div>
          
          <div class="p-5 space-y-4">
            <div>
              <label for="webhook-destination-url" class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">URL de Destino (Recebedor)</label>
              <div class="flex flex-col sm:flex-row gap-3">
                <input id="webhook-destination-url" type="url" [value]="webhookUrl()" (input)="onWebhookUrlInput($event)" placeholder="https://seu-sistema.com/webhook" class="flex-1 bg-slate-950 border border-slate-700 rounded text-sm text-slate-300 px-3 py-2 outline-none focus:border-indigo-500 font-mono">
                <button (click)="triggerTestWebhook()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded flex items-center gap-2 transition-colors border border-slate-700 shrink-0">
                  <mat-icon class="text-sm">bolt</mat-icon>
                  Disparar
                </button>
              </div>
            </div>
          </div>

          <div class="flex-1 bg-slate-950 p-4 border-t border-slate-800 flex flex-col min-h-[250px]">
            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Console de Tráfego Recente</span>
            
            <div class="flex-1 overflow-y-auto max-h-[300px] space-y-3">
              @for (log of webhookLogs(); track log.time) {
                <div class="border border-slate-800 bg-slate-900/40 rounded p-3">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] text-slate-500 font-mono">{{ log.time | date:'HH:mm:ss' }}</span>
                    <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-1.5 py-0.5 rounded font-bold uppercase text-[8px]">
                      {{ log.status }} (Simulado)
                    </span>
                  </div>
                  <pre class="text-indigo-400 text-[10px] font-mono whitespace-pre-wrap">{{ log.payload }}</pre>
                </div>
              }
              @if (webhookLogs().length === 0) {
                <div class="h-full flex items-center justify-center text-slate-600 text-xs font-mono">
                  Nenhum webhook disparado.
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class HqDevHubComponent {
  private http = inject(HqApiClient);
  private hqState = inject(HqStateService);

  activeTab = signal<'OTA' | 'SANDBOX' | 'WEBHOOKS'>('OTA');

  selectedEndpoint = signal<'companies' | 'marketplace' | 'hq-apps' | 'licensing' | 'releases'>('companies');
  responsePayload = signal<unknown>(null);
  responseStatus = signal<number | null>(null);
  responseLoading = signal<boolean>(false);
  
  webhookUrl = signal('');
  webhookLogs = signal<{ time: Date; status: 'pending' | 'success' | 'failed'; payload: string }[]>([]);

  onEndpointChange(event: Event) {
    this.selectedEndpoint.set((event.target as HTMLSelectElement).value as 'companies' | 'marketplace' | 'hq-apps' | 'licensing' | 'releases');
  }

  onWebhookUrlInput(event: Event) {
    this.webhookUrl.set((event.target as HTMLInputElement).value);
  }

  async executeSandboxRequest() {
    this.responseLoading.set(true);
    this.responseStatus.set(null);
    this.responsePayload.set(null);
    let url = '';
    
    if (this.selectedEndpoint() === 'companies') url = '/api/v1/companies';
    else if (this.selectedEndpoint() === 'marketplace') url = '/api/v1/marketplace/listings';
    else if (this.selectedEndpoint() === 'hq-apps') url = '/api/v1/hq/apps';
    else if (this.selectedEndpoint() === 'licensing') url = '/api/v1/licensing/plans';
    else if (this.selectedEndpoint() === 'releases') url = '/api/v1/distribution/os-releases';
    
    try {
      const start = Date.now();
      const res = await firstValueFrom(this.http.get<unknown>(url));
      const duration = Date.now() - start;
      this.responseStatus.set(200);
      this.responsePayload.set(res);
      this.hqState.addLog(`Sandbox API: GET ${url} executado com sucesso em ${duration}ms.`, 'info');
    } catch (err: unknown) {
      this.responseStatus.set(500);
      this.responsePayload.set({ error: 'Erro ao executar chamada no barramento local.', details: err });
    } finally {
      this.responseLoading.set(false);
    }
  }

  triggerTestWebhook() {
    const url = this.webhookUrl().trim();
    if (!url) {
      alert('Por favor, informe a URL de destino do Webhook.');
      return;
    }
    const payload = {
      event: 'sale.created',
      timestamp: new Date().toISOString(),
      data: {
        id: `sale_${Math.random().toString(36).substr(2, 9)}`,
        companyId: 'comp_burger',
        total: 49.90,
        items: [
          { productId: 'prod_cheeseburger', quantity: 1 }
        ]
      }
    };
    
    this.webhookLogs.update(logs => [
      {
        time: new Date(),
        status: 'success',
        payload: JSON.stringify(payload, null, 2)
      },
      ...logs
    ]);
    this.hqState.addLog(`Simulador Webhook: Evento "sale.created" disparado para ${url}.`, 'success');
  }
}
