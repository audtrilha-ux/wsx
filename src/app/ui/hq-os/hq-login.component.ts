import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { IdentityService } from '../../core/identity/identity.service';

@Component({
  selector: 'app-hq-login',
  standalone: true,
  imports: [RouterLink, MatIconModule, CommonModule],
  template: `
    <div class="min-h-screen desk-wood-bg flex items-center justify-center p-4 font-sans text-stone-900 relative overflow-hidden select-none">
      
      <!-- Banker's Lamp Warm Raytraced Glow -->
      <div class="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_75%_55%_at_75%_15%,rgba(245,158,11,0.24),transparent_75%)] mix-blend-screen desk-lamp-raytrace"></div>

      <div class="w-full max-w-md desk-paper-sheet p-8 sm:p-10 space-y-6 relative z-10 shadow-2xl border border-amber-900/30">
        
        <!-- Screws in corners -->
        <div class="absolute top-3 left-3 desk-brass-screw"></div>
        <div class="absolute top-3 right-3 desk-brass-screw"></div>
        <div class="absolute bottom-3 left-3 desk-brass-screw"></div>
        <div class="absolute bottom-3 right-3 desk-brass-screw"></div>

        <!-- Header -->
        <div class="text-center space-y-2 pt-1">
          <div class="w-13 h-13 rounded-xl desk-brass-plate mx-auto flex items-center justify-center shadow-md text-amber-950">
             <mat-icon class="text-2xl font-bold">shield</mat-icon>
          </div>
          <div class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full desk-brass-plate text-[9px] font-mono tracking-wider uppercase font-bold text-amber-950">
            <span>CENTRAL HQ CONTROL PLANE</span>
          </div>
          <h2 class="text-xl font-bold text-stone-900 tracking-tight font-serif">Gabinete de Governo Central</h2>
          <p class="text-stone-600 text-xs font-sans">
            Acesso restrito para administradores e auditores da plataforma HQ.
          </p>
        </div>

        @if (errorMessage()) {
          <div class="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center gap-2.5 font-medium shadow-sm">
            <mat-icon class="text-rose-600 text-base">gpp_bad</mat-icon>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <!-- Diagnostic HQ Booting Overlay -->
        @if (isBooting()) {
          <div class="p-6 bg-[#f7f2e7] border border-amber-600/30 rounded-2xl text-xs space-y-3 shadow-inner">
            <div class="flex items-center justify-between text-amber-900 font-bold">
              <span class="flex items-center gap-2">
                <mat-icon class="animate-spin text-sm text-amber-700">sync</mat-icon>
                Inicializando HQ Control Engine...
              </span>
              <span class="font-mono text-amber-800">{{ bootProgress() }}%</span>
            </div>
            <div class="w-full h-2 bg-stone-300 rounded-full overflow-hidden border border-stone-400/50">
              <div class="h-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-300" [style.width.%]="bootProgress()"></div>
            </div>
            <p class="text-[11px] font-mono text-stone-700">{{ bootStage() }}</p>
          </div>
        } @else {
          <!-- Form -->
          <form (submit)="onHqSubmit($event)" class="space-y-4 text-xs font-sans">
            <div>
              <label for="hq-email" class="block font-bold text-stone-700 mb-1.5 font-serif">E-mail do Administrador HQ</label>
              <div class="relative">
                <mat-icon class="absolute left-3.5 top-3 text-stone-400 text-sm">admin_panel_settings</mat-icon>
                <input 
                  id="hq-email" 
                  type="email" 
                  [value]="email()" 
                  (input)="email.set($any($event.target).value)"
                  required
                  placeholder="admin@3eatcru.com.br" 
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono text-xs shadow-inner">
              </div>
            </div>

            <div>
              <label for="hq-password" class="block font-bold text-stone-700 mb-1.5 font-serif">Chave Mestra de Acesso</label>
              <div class="relative">
                <mat-icon class="absolute left-3.5 top-3 text-stone-400 text-sm">key</mat-icon>
                <input 
                  id="hq-password" 
                  type="password" 
                  [value]="password()" 
                  (input)="password.set($any($event.target).value)"
                  required
                  placeholder="••••••••••••" 
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-xs shadow-inner">
              </div>
            </div>

            <div>
              <label for="hq-mfa" class="block font-bold text-stone-700 mb-1.5 flex items-center justify-between font-serif">
                <span>Código MFA (Multifator)</span>
                <span class="text-[10px] text-amber-800 font-mono font-normal">Token 6 dígitos</span>
              </label>
              <div class="relative">
                <mat-icon class="absolute left-3.5 top-3 text-stone-400 text-sm">phonelink_lock</mat-icon>
                <input 
                  id="hq-mfa" 
                  type="text" 
                  maxlength="6"
                  required
                  [value]="mfaCode()" 
                  (input)="mfaCode.set($any($event.target).value)"
                  placeholder="000000" 
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-amber-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono text-center tracking-widest text-xs font-bold shadow-inner">
              </div>
            </div>

            <button 
              type="submit" 
              [disabled]="isLoading() || mfaCode().length !== 6 || !password()"
              class="w-full desk-brass-button text-xs font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mt-4 disabled:opacity-50">
              @if (isLoading()) {
                <mat-icon class="animate-spin text-sm">sync</mat-icon>
                Validando Assinatura Admin...
              } @else {
                <mat-icon class="text-sm">verified_user</mat-icon>
                Autenticar Gabinete Central
              }
            </button>
          </form>
        }

        <div class="pt-4 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 font-sans">
          <a routerLink="/access" class="hover:text-stone-900 transition-colors flex items-center gap-1 font-semibold">
            <mat-icon class="text-[14px]">storefront</mat-icon>
            Bancada Client OS
          </a>
          <span class="text-[10px] text-stone-500 font-mono">3eatcru Security Protocol</span>
        </div>
      </div>
    </div>
  `
})
export class HqLoginComponent {
  private identityService = inject(IdentityService);
  private router = inject(Router);

  email = signal('admin@3eatcru.com.br');
  password = signal('');
  mfaCode = signal('');
  isLoading = signal(false);
  isBooting = signal(false);
  bootProgress = signal(0);
  bootStage = signal('Conectando ao Central Control Plane...');
  errorMessage = signal<string | null>(null);

  async onHqSubmit(event: Event) {
    event.preventDefault();
    if (!this.email() || !this.password() || this.mfaCode().length !== 6) {
      this.errorMessage.set('Preencha e-mail, senha e o código MFA de 6 dígitos.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      await this.identityService.hqLogin({
        email: this.email(),
        password: this.password(),
        mfaCode: this.mfaCode()
      });
      
      this.isBooting.set(true);
      this.isLoading.set(false);

      const stages = [
        { progress: 25, label: 'Auditando chave mestra criptografada...' },
        { progress: 55, label: 'Carregando isolamento de Tenants e Contratos SaaS...' },
        { progress: 85, label: 'Sincronizando Developer Hub e versões OTA do OS...' },
        { progress: 100, label: 'Acesso concedido. Abrindo HQ Central...' }
      ];

      for (const st of stages) {
        this.bootProgress.set(st.progress);
        this.bootStage.set(st.label);
        await new Promise(r => setTimeout(r, 140));
      }

      this.router.navigate(['/hq']);
    } catch (e: unknown) {
      this.isBooting.set(false);
      this.isLoading.set(false);
      const err = e as { error?: { error?: string }; message?: string };
      this.errorMessage.set(err?.error?.error || err?.message || 'Falha na autenticação do HQ Central.');
    }
  }
}
