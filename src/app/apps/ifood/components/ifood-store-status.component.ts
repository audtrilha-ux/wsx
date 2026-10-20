import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-ifood-store-status',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
      <div class="flex items-center gap-5">
        <div class="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500 shrink-0">
          <mat-icon class="text-3xl w-auto h-auto">delivery_dining</mat-icon>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              [class.bg-emerald-500/10]="isOpen()"
              [class.text-emerald-400]="isOpen()"
              [class.border]="true"
              [class.border-emerald-500/20]="isOpen()"
              [class.bg-rose-500/10]="!isOpen()"
              [class.text-rose-400]="!isOpen()"
              [class.border-rose-500/20]="!isOpen()">
              <span class="w-1.5 h-1.5 rounded-full" [class.bg-emerald-400]="isOpen()" [class.bg-rose-400]="!isOpen()"></span>
              {{ isOpen() ? 'LOJA ABERTA NO IFOOD' : 'LOJA FECHADA / PAUSADA' }}
            </span>
            <span class="text-[10px] font-mono text-slate-500">Merchant ID: {{ merchantId() || '8841-39A' }}</span>
          </div>
          <h4 class="text-base font-black text-white mt-1">iFood Merchant Gateway</h4>
          <p class="text-xs text-slate-400 mt-0.5">Sincronismo automático de pedidos externos direto com o PDV e KDS de cozinha.</p>
        </div>
      </div>
 
      <div class="flex items-center gap-3 shrink-0">
        <button 
          type="button"
          (click)="toggleStoreStatus.emit()"
          class="px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          [class.bg-rose-600]="isOpen()"
          [class.hover:bg-rose-500]="isOpen()"
          [class.text-white]="isOpen()"
          [class.bg-emerald-600]="!isOpen()"
          [class.hover:bg-emerald-500]="!isOpen()"
          [class.text-white]="!isOpen()">
          <mat-icon class="text-sm">{{ isOpen() ? 'pause_circle' : 'play_circle' }}</mat-icon>
          {{ isOpen() ? 'Pausar Loja' : 'Abrir Loja no iFood' }}
        </button>
      </div>
    </div>
  `
})
export class IfoodStoreStatusComponent {
  isOpen = input.required<boolean>();
  merchantId = input<string>('IF-982834');
  toggleStoreStatus = output<void>();
}
