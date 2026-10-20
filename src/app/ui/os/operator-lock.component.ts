import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { OperatorLockService, OperatorUser } from '../../core/operator-lock/operator-lock.service';
import { IdentityService } from '../../core/identity/identity.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-operator-lock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[99999] flex items-center justify-center p-4 text-slate-100 select-none font-sans">
      
      <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-900/40 p-8 rounded-3xl border border-white/5 shadow-2xl">
        
        <!-- Left Pane: Select Operator -->
        <div class="space-y-6">
          <div class="space-y-1">
            <h2 class="text-2xl font-black tracking-tight text-white uppercase">Estação Bloqueada</h2>
            <p class="text-xs text-slate-400">Selecione seu perfil de operador para desbloquear esta estação de trabalho.</p>
          </div>

          <div class="space-y-2 max-h-[320px] overflow-y-auto pr-2 no-scrollbar">
            @for (op of operators(); track op.id) {
              <button 
                type="button"
                (click)="selectOperator(op)"
                [class]="selectedOperator()?.id === op.id ? 'bg-indigo-600/20 border-indigo-500/80 text-white' : 'bg-slate-800/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/80'"
                class="w-full p-3 rounded-2xl border text-left flex items-center gap-3.5 transition-all">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/10">
                  {{ getInitials(op.name) }}
                </div>
                <div class="flex-1 min-w-0">
                  <span class="block text-xs font-bold truncate">{{ op.name }}</span>
                  <span class="block text-[10px] text-slate-500 capitalize">{{ op.role }}</span>
                </div>
                @if (selectedOperator()?.id === op.id) {
                  <div class="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
                }
              </button>
            }
            @if (operators().length === 0) {
              <p class="text-xs text-slate-500 py-4 text-center">Nenhum operador disponível.</p>
            }
          </div>

          <div class="pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span class="font-semibold text-slate-400">Empresa: {{ tenantName() }}</span>
            <button (click)="logout()" class="text-rose-400 hover:text-rose-300 font-bold hover:underline inline-flex items-center gap-1">
              <mat-icon class="text-xs">logout</mat-icon> Sair da Sessão
            </button>
          </div>
        </div>

        <!-- Right Pane: Enter PIN Keypad -->
        <div class="flex flex-col items-center justify-center p-6 bg-slate-900/50 rounded-2xl border border-white/5 space-y-6">
          <div class="text-center space-y-1.5 w-full">
            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Inserir Código PIN</span>
            <div class="text-sm font-bold text-slate-300 h-5 truncate">
              {{ selectedOperator() ? selectedOperator()?.name : 'Selecione um Operador' }}
            </div>
          </div>

          <!-- PIN Display -->
          <div class="flex gap-3 justify-center">
            @for (slot of [0, 1, 2, 3]; track slot) {
              <div 
                [class]="pin().length > slot ? 'bg-indigo-500 shadow-lg shadow-indigo-500/30 scale-110 border-indigo-400' : 'bg-slate-850 border-slate-700'"
                class="w-4 h-4 rounded-full border transition-all duration-150">
              </div>
            }
          </div>

          <!-- Keypad Grid -->
          <div class="grid grid-cols-3 gap-3 w-full max-w-[240px]">
            @for (num of [1, 2, 3, 4, 5, 6, 7, 8, 9]; track num) {
              <button 
                type="button" 
                (click)="pressKey(num.toString())"
                [disabled]="!selectedOperator()"
                class="w-14 h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-600/80 border border-slate-750 font-mono font-bold text-lg flex items-center justify-center text-white transition-all hover:scale-105 disabled:opacity-30 disabled:pointer-events-none">
                {{ num }}
              </button>
            }
            <button 
              type="button" 
              (click)="clearPin()"
              [disabled]="!selectedOperator()"
              class="w-14 h-14 rounded-2xl bg-rose-950/20 hover:bg-rose-900/20 border border-rose-950 text-rose-400 flex items-center justify-center text-xs font-bold disabled:opacity-30 disabled:pointer-events-none">
              CLEAR
            </button>
            <button 
              type="button" 
              (click)="pressKey('0')"
              [disabled]="!selectedOperator()"
              class="w-14 h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-750 font-mono font-bold text-lg flex items-center justify-center text-white disabled:opacity-30 disabled:pointer-events-none">
              0
            </button>
            <button 
              type="button" 
              (click)="backspace()"
              [disabled]="!selectedOperator()"
              class="w-14 h-14 rounded-2xl bg-slate-850 hover:bg-slate-750 border border-slate-800 text-slate-400 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none">
              <mat-icon class="text-sm">backspace</mat-icon>
            </button>
          </div>

          @if (errorMessage()) {
            <div class="text-[11px] text-rose-400 font-medium text-center animate-pulse">
              {{ errorMessage() }}
            </div>
          } @else {
            <div class="text-[10px] text-slate-500 font-mono text-center">
              Digite o PIN individual do operador cadastrado
            </div>
          }
        </div>

      </div>

    </div>
  `
})
export class OperatorLockComponent {
  private lockService = inject(OperatorLockService);
  private identityService = inject(IdentityService);
  private router = inject(Router);

  operators = this.lockService.operators;
  selectedOperator = signal<OperatorUser | null>(null);
  pin = signal<string>('');
  errorMessage = signal<string | null>(null);

  tenantName = computed(() => this.identityService.currentTenant()?.tenantName || 'Empresa');

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  selectOperator(op: OperatorUser) {
    this.selectedOperator.set(op);
    this.pin.set('');
    this.errorMessage.set(null);
  }

  pressKey(num: string) {
    if (!this.selectedOperator()) return;
    this.errorMessage.set(null);

    if (this.pin().length < 4) {
      this.pin.update(p => p + num);
      
      // Auto-submit on 4th digit
      if (this.pin().length === 4) {
        this.submitPin();
      }
    }
  }

  backspace() {
    this.pin.update(p => p.slice(0, -1));
    this.errorMessage.set(null);
  }

  clearPin() {
    this.pin.set('');
    this.errorMessage.set(null);
  }

  logout() {
    this.identityService.logout();
    this.router.navigate(['/access']);
  }

  private async submitPin() {
    const op = this.selectedOperator();
    if (!op) return;

    try {
      const success = await this.lockService.unlock(op.id, this.pin());
      if (success) {
        this.pin.set('');
        this.selectedOperator.set(null);
        this.errorMessage.set(null);
      } else {
        this.pin.set('');
        this.errorMessage.set('Código PIN incorreto.');
      }
    } catch (e: unknown) {
      this.pin.set('');
      const err = e as Error;
      this.errorMessage.set(err.message || 'Erro ao validar operador.');
    }
  }
}
