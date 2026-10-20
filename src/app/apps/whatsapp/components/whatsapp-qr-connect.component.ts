import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-whatsapp-qr-connect',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
      <div class="flex items-center gap-5">
        <div class="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0">
          @if (isConnected()) {
            <mat-icon class="text-emerald-400 text-4xl w-auto h-auto">check_circle</mat-icon>
          } @else {
            <mat-icon class="text-emerald-400 text-4xl w-auto h-auto">qr_code_2</mat-icon>
          }
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              [class.bg-emerald-500/10]="isConnected()"
              [class.text-emerald-400]="isConnected()"
              [class.border]="true"
              [class.border-emerald-500/20]="isConnected()"
              [class.bg-amber-500/10]="!isConnected()"
              [class.text-amber-400]="!isConnected()"
              [class.border-amber-500/20]="!isConnected()">
              <span class="w-1.5 h-1.5 rounded-full" [class.bg-emerald-400]="isConnected()" [class.bg-amber-400]="!isConnected()"></span>
              {{ isConnected() ? 'SESSÃO CONECTADA (ONLINE)' : 'AGUARDANDO LEITURA DO QR CODE' }}
            </span>
          </div>
          <h4 class="text-base font-black text-white mt-1">WhatsApp Cloud API & Webhook Bot</h4>
          <p class="text-xs text-slate-400 mt-0.5">
            {{ isConnected() ? 'Dispositivo conectado: +55 (11) 98765-4321 • Instância: srv-wa-01' : 'Abra o WhatsApp > Aparelhos conectados > Conectar um aparelho' }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        @if (isConnected()) {
          <button 
            type="button"
            (click)="disconnect.emit()"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5">
            <mat-icon class="text-sm">phonelink_erase</mat-icon> Desconectar
          </button>
        } @else {
          <button 
            type="button"
            (click)="connect.emit()"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-900/30">
            <mat-icon class="text-sm">qr_code_scanner</mat-icon> Simular Leitura do QR Code
          </button>
        }
      </div>
    </div>
  `
})
export class WhatsappQrConnectComponent {
  isConnected = input.required<boolean>();
  connect = output<void>();
  disconnect = output<void>();
}
