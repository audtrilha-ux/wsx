import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [RouterLink, MatIconModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen desk-wood-bg flex flex-col font-sans text-stone-900 relative overflow-hidden select-none">
      
      <!-- Ambient Banker's Lamp Warm Raytraced Glow -->
      <div class="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_75%_55%_at_75%_15%,rgba(245,158,11,0.24),transparent_75%)] mix-blend-screen desk-lamp-raytrace"></div>

      <!-- Top Desk Header -->
      <header class="h-16 flex items-center justify-between px-6 lg:px-12 shrink-0 border-b border-amber-900/50 backdrop-blur-md bg-[#19110a]/80 shadow-md relative z-10">
        <a routerLink="/" class="text-amber-200 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold">
          <mat-icon class="text-sm">arrow_back</mat-icon>
          Página Inicial
        </a>
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg desk-brass-plate text-amber-950 flex items-center justify-center font-bold text-xs shadow-sm">
            <mat-icon class="text-sm">desk</mat-icon>
          </div>
          <span class="text-xs font-bold text-amber-100 font-serif">Livro de Registro Comercial</span>
        </div>
      </header>
      
      <main class="flex-1 flex items-center justify-center p-4 py-8 relative z-10">
        <div class="w-full max-w-xl desk-paper-sheet p-8 sm:p-10 space-y-6 shadow-2xl relative">
          
          <!-- Brass Paperclip Accent at Top -->
          <div class="absolute -top-4 left-10 flex items-center gap-2">
            <div class="desk-paperclip"></div>
            <span class="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-900 bg-amber-100/90 border border-amber-300 px-2.5 py-0.5 rounded shadow-sm">
              REGISTRO DE EMPRESA #NOVO
            </span>
          </div>

          <!-- Brass Corner Screws -->
          <div class="absolute top-3 right-3 desk-brass-screw"></div>
          <div class="absolute bottom-3 left-3 desk-brass-screw"></div>
          <div class="absolute bottom-3 right-3 desk-brass-screw"></div>

          <div class="text-center space-y-2 pt-2">
            <div class="w-13 h-13 rounded-xl desk-brass-plate mx-auto flex items-center justify-center shadow-md text-amber-950">
              <mat-icon class="text-2xl font-bold">business_center</mat-icon>
            </div>
            <div class="flex items-center justify-center gap-2">
              <h2 class="text-2xl font-black text-stone-900 tracking-tight font-serif">Abertura de Livro de Registro</h2>
              <span class="desk-stamp-badge desk-stamp-official text-[9px]">TRIAL 7 DIAS</span>
            </div>
            <p class="text-stone-600 text-xs font-sans">
              Configure sua empresa no ecossistema e habilite os terminais físicos de venda e comandas sem custo inicial.
            </p>
          </div>

          <!-- Physical Stamped Certificate Notice -->
          <div class="p-3.5 bg-[#f6efe1] border border-amber-600/30 rounded-2xl text-xs flex items-center gap-3 text-stone-800 shadow-sm">
            <mat-icon class="text-amber-800 text-lg shrink-0">verified</mat-icon>
            <div class="font-sans">
              <span class="font-bold text-amber-950 font-serif">Licença Pro Habilitada: </span>
              Acesso total ao PDV, Mesas & KDS, Estoque Físico, Fidelidade e Livro Razão Financeiro.
            </div>
          </div>

          @if (errorMessage()) {
            <div class="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center gap-2.5 font-medium shadow-sm">
              <mat-icon class="text-rose-600 text-base">error</mat-icon>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <form (submit)="onFormSubmit($event)" class="space-y-4 text-xs font-sans">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="company-name" class="block font-bold text-stone-700 mb-1.5 font-serif">Razão Social / Nome Fantasia</label>
                <input 
                  id="company-name" 
                  type="text" 
                  [value]="companyName()" 
                  (input)="onCompanyNameInput($event)"
                  name="companyName"
                  required
                  placeholder="Ex: Armazém & Bistrô Central" 
                  class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium shadow-inner">
              </div>

              <div>
                <label for="segment" class="block font-bold text-stone-700 mb-1.5 font-serif">Segmento Operacional</label>
                <select 
                  id="segment" 
                  [value]="segment()" 
                  (change)="onSegmentChange($event)"
                  name="segment"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium shadow-inner cursor-pointer">
                  <option value="restaurante">Restaurante / Bar / Gastronomia</option>
                  <option value="varejo">Varejo / Loja / Moda / Comércio</option>
                  <option value="servicos">Serviços / Clínica / Barbearia</option>
                  <option value="geral">Geral / Multi-Setor</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="admin-email" class="block font-bold text-stone-700 mb-1.5 font-serif">E-mail do Administrador</label>
                <input 
                  id="admin-email" 
                  type="email" 
                  [value]="adminEmail()" 
                  (input)="onAdminEmailInput($event)"
                  name="adminEmail"
                  required
                  placeholder="gerente@empresa.com" 
                  class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium shadow-inner">
              </div>

              <div>
                <label for="whatsapp" class="block font-bold text-stone-700 mb-1.5 font-serif">Telefone / WhatsApp</label>
                <input 
                  id="whatsapp" 
                  type="tel" 
                  [value]="whatsapp()" 
                  (input)="onWhatsappInput($event)"
                  name="whatsapp"
                  required
                  placeholder="(11) 99999-8888" 
                  class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium shadow-inner">
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="password" class="block font-bold text-stone-700 mb-1.5 font-serif">Senha de Administrador</label>
                <input 
                  id="password" 
                  type="password" 
                  [value]="password()" 
                  (input)="onPasswordInput($event)"
                  name="password"
                  required
                  placeholder="Crie sua senha segura" 
                  class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium shadow-inner">
              </div>

              <div>
                <label for="pin" class="block font-bold text-stone-700 mb-1.5 font-serif">PIN do Terminal (4 a 6 Dígitos)</label>
                <input 
                  id="pin" 
                  type="password" 
                  maxlength="6"
                  [value]="pin()" 
                  (input)="onPinInput($event)"
                  name="pin"
                  required
                  placeholder="••••" 
                  class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono font-bold tracking-widest text-center shadow-inner">
              </div>
            </div>

            <div class="pt-3">
              <button 
                type="submit" 
                [disabled]="isSubmitting() || !companyName().trim() || !adminEmail().trim() || !password().trim() || pin().trim().length < 4"
                class="w-full desk-brass-button text-xs font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
                @if (isSubmitting()) {
                  <mat-icon class="animate-spin text-sm">sync</mat-icon>
                  Lavrando Registro de Empresa...
                } @else {
                  <mat-icon class="text-sm">verified</mat-icon>
                  Registrar Empresa & Abrir Bancada OS
                }
              </button>
            </div>
          </form>

          <div class="text-center pt-2 border-t border-stone-200">
            <span class="text-stone-500 text-[11px]">Já possui registro mercantil aberto? </span>
            <a routerLink="/access" class="text-amber-800 hover:text-amber-950 font-bold text-[11px] underline">Abrir Terminal</a>
          </div>

        </div>
      </main>
    </div>
  `
})
export class OnboardingComponent {
  private http = inject(HttpClient);
  private router = inject(Router);

  companyName = signal('');
  segment = signal('restaurante');
  adminEmail = signal('');
  whatsapp = signal('');
  password = signal('');
  pin = signal('');
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);

  onCompanyNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.companyName.set(input.value);
  }

  onSegmentChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.segment.set(select.value);
  }

  onAdminEmailInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.adminEmail.set(input.value);
  }

  onWhatsappInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.whatsapp.set(input.value);
  }

  onPasswordInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.password.set(input.value);
  }

  onPinInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.pin.set(input.value);
  }

  onFormSubmit(event: Event): void {
    event.preventDefault();
    this.submitRegistration();
  }

  submitRegistration(): void {
    if (!this.companyName().trim() || !this.adminEmail().trim() || !this.password().trim() || this.pin().trim().length < 4) {
      this.errorMessage.set('Por favor, preencha todos os campos do formulário (PIN mínimo de 4 dígitos).');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload = {
      name: this.companyName(),
      segment: this.segment(),
      adminEmail: this.adminEmail(),
      whatsapp: this.whatsapp(),
      password: this.password(),
      pin: this.pin()
    };

    this.http.post<{ success: boolean; companyId: string; slug: string }>('/api/onboarding/register', payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.router.navigate(['/access'], { queryParams: { registered: res.slug } });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.error || 'Erro ao realizar cadastro da empresa.');
      }
    });
  }
}
