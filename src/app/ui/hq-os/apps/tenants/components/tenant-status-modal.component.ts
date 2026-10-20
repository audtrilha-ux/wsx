import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Company } from '../../../../../core/domain/company/company.entity';

export interface StatusTogglePayload {
  company: Company;
  newStatus: 'active' | 'suspended';
  reason: string;
}

@Component({
  selector: 'app-tenant-status-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center border"
                 [ngClass]="company().status === 'active' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'">
              <mat-icon class="text-sm">{{ company().status === 'active' ? 'lock' : 'lock_open' }}</mat-icon>
            </div>
            <div>
              <h4 class="text-sm font-bold text-white uppercase tracking-wider">
                {{ company().status === 'active' ? 'Suspender Tenant' : 'Reativar Tenant' }}
              </h4>
              <p class="text-[11px] text-slate-400 font-mono">{{ company().name }}</p>
            </div>
          </div>
          <button (click)="dismiss.emit()" class="text-slate-500 hover:text-white transition-colors">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          @if (company().status === 'active') {
            <div class="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2.5">
              <mat-icon class="text-base text-rose-400 shrink-0">warning</mat-icon>
              <div>
                <strong>Atenção:</strong> Ao suspender este tenant, todos os terminais do <strong>Client OS</strong> vinculados exibirão imediatamente a tela de bloqueio administrativo, interrompendo emissões e transações.
              </div>
            </div>
          } @else {
            <div class="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2.5">
              <mat-icon class="text-base text-emerald-400 shrink-0">check_circle</mat-icon>
              <div>
                <strong>Reativação:</strong> O terminal do <strong>Client OS</strong> voltará ao estado operacional normal assim que a suspensão for revogada.
              </div>
            </div>
          }

          <div>
            <label for="tenant-status-reason" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Motivo da Ação *
            </label>
            <input id="tenant-status-reason" type="text" 
                   [value]="reason()"
                   (input)="onReasonInput($event)"
                   [placeholder]="company().status === 'active' ? 'Ex: Inadimplência ou Auditoria Contratual' : 'Ex: Regularização financeira confirmada'"
                   class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 outline-none">
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
          <button (click)="dismiss.emit()" class="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white text-xs font-bold uppercase transition-colors">
            Cancelar
          </button>
          <button (click)="confirm()"
                  class="px-5 py-2 rounded-lg text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                  [ngClass]="company().status === 'active' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'">
            <mat-icon class="text-sm">{{ company().status === 'active' ? 'block' : 'check' }}</mat-icon>
            {{ company().status === 'active' ? 'Confirmar Suspensão' : 'Confirmar Reativação' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class TenantStatusModalComponent {
  company = input.required<Company>();
  confirmStatus = output<StatusTogglePayload>();
  dismiss = output<void>();

  reason = signal('');

  onReasonInput(event: Event) {
    this.reason.set((event.target as HTMLInputElement).value);
  }

  confirm() {
    const nextStatus = this.company().status === 'active' ? 'suspended' : 'active';
    this.confirmStatus.emit({
      company: this.company(),
      newStatus: nextStatus,
      reason: this.reason().trim() || (nextStatus === 'suspended' ? 'Suspensão manual via HQ OS' : 'Reativação manual via HQ OS')
    });
  }
}
