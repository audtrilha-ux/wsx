import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { IdentityService } from '../../core/identity/identity.service';

@Component({
  selector: 'app-account-recovery',
  standalone: true,
  imports: [RouterLink, MatIconModule, CommonModule],
  template: `
    <div class="min-h-screen desk-wood-bg flex items-center justify-center p-4 font-sans text-stone-900 relative overflow-hidden select-none">
      
      <!-- Banker's Lamp Warm Glow -->
      <div class="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_75%_55%_at_75%_15%,rgba(245,158,11,0.24),transparent_75%)] mix-blend-screen desk-lamp-raytrace"></div>

      <div class="w-full max-w-md desk-paper-sheet p-8 sm:p-10 space-y-6 relative z-10 shadow-2xl">
        
        <!-- Screws in corners -->
        <div class="absolute top-3 left-3 desk-brass-screw"></div>
        <div class="absolute top-3 right-3 desk-brass-screw"></div>
        <div class="absolute bottom-3 left-3 desk-brass-screw"></div>
        <div class="absolute bottom-3 right-3 desk-brass-screw"></div>

        <!-- Header -->
        <div class="text-center space-y-2">
          <div class="w-13 h-13 rounded-xl desk-brass-plate mx-auto flex items-center justify-center text-amber-950 shadow-md">
             <mat-icon class="text-2xl font-bold">lock_reset</mat-icon>
          </div>
          <span class="desk-stamp-badge desk-stamp-security text-[9px]">PROTOCOLO SEGURO</span>
          <h2 class="text-xl font-bold text-stone-900 tracking-tight font-serif">Recuperação de Credencial</h2>
          <p class="text-stone-600 text-xs font-sans">
            Informe seu e-mail corporativo para emitir um despacho seguro de redefinição de chave.
          </p>
        </div>

        @if (successMessage()) {
          <div class="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs space-y-2 shadow-sm font-sans">
            <div class="flex items-center gap-2 font-bold text-emerald-800">
              <mat-icon class="text-base">check_circle</mat-icon>
              <span>Despacho Emitido</span>
            </div>
            <p class="text-stone-700 leading-relaxed">{{ successMessage() }}</p>
          </div>
        }

        @if (errorMessage()) {
          <div class="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center gap-2.5 font-medium shadow-sm">
            <mat-icon class="text-rose-600 text-base">error</mat-icon>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <form (submit)="onSubmit($event)" class="space-y-4 text-xs font-sans">
          <div>
            <label for="recovery-email" class="block font-bold text-stone-700 mb-1.5 font-serif">E-mail Corporativo</label>
            <div class="relative">
              <mat-icon class="absolute left-3.5 top-3 text-stone-400 text-sm">mail</mat-icon>
              <input 
                id="recovery-email" 
                type="email" 
                [value]="email()" 
                (input)="email.set($any($event.target).value)"
                required
                placeholder="operador@empresa.com" 
                class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono text-xs shadow-inner">
            </div>
          </div>

          <button 
            type="submit" 
            [disabled]="isLoading() || !!successMessage()"
            class="w-full desk-brass-button text-xs font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
            @if (isLoading()) {
              <mat-icon class="animate-spin text-sm">sync</mat-icon>
              Processando Protocolo de Segurança...
            } @else {
              <mat-icon class="text-sm">send</mat-icon>
              Enviar Despacho de Recuperação
            }
          </button>
        </form>

        <div class="pt-4 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 font-sans">
          <a routerLink="/access" class="hover:text-stone-900 transition-colors flex items-center gap-1 font-semibold">
            <mat-icon class="text-[14px]">arrow_back</mat-icon>
            Voltar à Bancada OS
          </a>
          <a routerLink="/hq/login" class="hover:text-amber-900 transition-colors flex items-center gap-1 font-mono font-bold">
            <mat-icon class="text-[14px]">shield</mat-icon>
            Gabinete HQ
          </a>
        </div>
      </div>
    </div>
  `
})
export class AccountRecoveryComponent {
  private identityService = inject(IdentityService);

  email = signal('');
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.email()) {
      this.errorMessage.set('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await this.identityService.requestPasswordRecovery(this.email());
      this.successMessage.set('Instruções despachadas com sucesso! Verifique a sua caixa postal corporativa.');
    } catch (e: unknown) {
      const err = e as { error?: { error?: string }; message?: string };
      this.errorMessage.set(err?.error?.error || err?.message || 'Falha ao despachar recuperação.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
