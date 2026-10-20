import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { IdentityService } from '../../core/identity/identity.service';

interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  logoUrl?: string;
  branches: { id: string; name: string; address: string; isMain?: boolean }[];
}

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [RouterLink, MatIconModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen desk-wood-bg flex items-center justify-center p-4 font-sans text-stone-900 relative overflow-hidden select-none">
      
      <!-- Ambient Banker's Lamp Warm Raytraced Glow -->
      <div class="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_75%_55%_at_75%_15%,rgba(245,158,11,0.24),transparent_75%)] mix-blend-screen desk-lamp-raytrace"></div>
      <div class="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(circle_at_75%_15%,rgba(254,243,199,0.18),transparent_42%)]"></div>

      <!-- Physical Card Dossier Resting on Desk Blotter -->
      <div class="w-full max-w-lg desk-paper-sheet p-8 sm:p-10 space-y-6 relative z-10 shadow-2xl">
        
        <!-- Brass Paperclip Accent at Top -->
        <div class="absolute -top-4 left-10 flex items-center gap-2">
          <div class="desk-paperclip"></div>
          <span class="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded shadow-sm">
            FICHA DE ACESSO #01
          </span>
        </div>

        <!-- Brass Screws in Corners -->
        <div class="absolute top-3 right-3 desk-brass-screw"></div>
        <div class="absolute bottom-3 left-3 desk-brass-screw"></div>
        <div class="absolute bottom-3 right-3 desk-brass-screw"></div>

        <!-- Header -->
        <div class="text-center space-y-2 pt-1">
          <div class="w-13 h-13 rounded-xl desk-brass-plate mx-auto flex items-center justify-center shadow-md border border-amber-300/40 text-amber-950">
             <mat-icon class="text-2xl font-bold">point_of_sale</mat-icon>
          </div>
          <h2 class="text-2xl font-black text-stone-900 tracking-tight font-serif">Bancada do Operador OS</h2>
          <p class="text-stone-600 text-xs font-sans">
            Autenticação do terminal corporativo com isolamento de tenant, permissões físicas e controle de filial.
          </p>
        </div>

        @if (errorMessage()) {
          <div class="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-200 shadow-sm font-medium">
            <mat-icon class="text-rose-600 text-base">error</mat-icon>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <!-- Diagnostic OS Boot Overlay (DEsk Stamped Dispatch) -->
        @if (isBooting()) {
          <div class="p-6 bg-[#f7f2e7] border border-amber-600/30 rounded-2xl text-xs space-y-3 shadow-inner">
            <div class="flex items-center justify-between text-amber-900 font-bold">
              <span class="flex items-center gap-2">
                <mat-icon class="animate-spin text-sm text-amber-700">sync</mat-icon>
                Inicializando Runtime do Client OS...
              </span>
              <span class="font-mono text-amber-800">{{ bootProgress() }}%</span>
            </div>
            <div class="w-full h-2 bg-stone-300 rounded-full overflow-hidden border border-stone-400/50">
              <div class="h-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-300" [style.width.%]="bootProgress()"></div>
            </div>
            <p class="text-[11px] font-mono text-stone-700">{{ bootStage() }}</p>
          </div>
        } @else {
          <!-- Step 1: Enterprise Identification / Resolution -->
          @if (step() === 'company') {
            <div class="space-y-4 text-xs font-sans">
              <div>
                <label for="company-identifier" class="block font-bold text-stone-800 mb-1.5 font-serif">Código ou Identificador da Empresa</label>
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <mat-icon class="absolute left-3.5 top-3 text-stone-400 text-sm">business</mat-icon>
                    <input 
                      id="company-identifier" 
                      type="text" 
                      [value]="companyQuery()" 
                      (input)="companyQuery.set($any($event.target).value)"
                      (keyup.enter)="resolveCompany()"
                      placeholder="Ex: comp_1 ou restaurante-central" 
                      class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono text-xs shadow-inner">
                  </div>
                  <button 
                    type="button" 
                    (click)="resolveCompany()"
                    [disabled]="isResolving()"
                    class="px-4 py-2.5 desk-brass-button rounded-xl flex items-center gap-1.5 shadow text-xs font-bold disabled:opacity-50">
                    @if (isResolving()) {
                      <mat-icon class="animate-spin text-sm">sync</mat-icon>
                    } @else {
                      <mat-icon class="text-sm">search</mat-icon>
                      Localizar
                    }
                  </button>
                </div>
              </div>

              <!-- Available Enterprise Selector List -->
              @if (availableCompanies().length > 0) {
                <div class="space-y-2 pt-2 border-t border-stone-200">
                  <span class="block text-[10px] font-bold text-stone-600 uppercase tracking-wider font-mono">
                    Empresas Licenciadas na Bancada
                  </span>
                  <div class="space-y-1.5">
                    @for (comp of availableCompanies(); track comp.id) {
                      <button 
                        type="button"
                        (click)="selectResolvedCompany(comp)"
                        class="w-full p-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-left flex items-center justify-between transition-all group shadow-sm">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-lg desk-brass-plate text-amber-950 flex items-center justify-center font-bold shadow-sm">
                            <mat-icon class="text-base">store</mat-icon>
                          </div>
                          <div>
                            <div class="font-bold text-stone-900 group-hover:text-amber-800 transition-colors font-serif">{{ comp.name }}</div>
                            <div class="text-[10px] text-stone-500 font-mono">{{ comp.id }} • {{ comp.branches.length }} unidade(s)</div>
                          </div>
                        </div>
                        <mat-icon class="text-stone-400 group-hover:text-amber-800 transition-colors text-sm">chevron_right</mat-icon>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Step 2: Operator Credentials & Branch Selector -->
          @if (step() === 'credentials' && selectedCompany()) {
            <div class="space-y-4 text-xs font-sans">
              
              <!-- Company Header Badge -->
              <div class="p-3 bg-[#f5ecd7] border border-amber-600/30 rounded-2xl flex items-center justify-between shadow-sm">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl desk-brass-plate text-amber-950 flex items-center justify-center font-bold">
                    <mat-icon class="text-base">domain</mat-icon>
                  </div>
                  <div>
                    <span class="text-[10px] text-amber-800 font-mono uppercase font-bold tracking-wider">Empresa Selecionada</span>
                    <h3 class="text-xs font-bold text-stone-900 font-serif leading-tight">{{ selectedCompany()?.name }}</h3>
                  </div>
                </div>
                <button 
                  type="button" 
                  (click)="step.set('company')" 
                  class="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline font-mono">
                  Alterar
                </button>
              </div>

              <form (submit)="onFormSubmit($event)" class="space-y-4">
                <div>
                  <label for="corporate-email" class="block font-bold text-stone-700 mb-1.5 font-serif">E-mail do Operador</label>
                  <div class="relative">
                    <mat-icon class="absolute left-3.5 top-3 text-stone-400 text-sm">person</mat-icon>
                    <input 
                      id="corporate-email" 
                      type="email" 
                      [value]="email()" 
                      (input)="email.set($any($event.target).value)"
                      required
                      placeholder="operador@empresa.com" 
                      class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono text-xs shadow-inner">
                  </div>
                </div>

                <div>
                  <div class="flex justify-between items-center mb-1.5">
                    <label for="corporate-password" class="block font-bold text-stone-700 font-serif">Senha Corporativa</label>
                    <a routerLink="/account/recovery" class="text-[11px] text-amber-800 hover:underline font-mono">Esqueci minha senha</a>
                  </div>
                  <div class="relative">
                    <mat-icon class="absolute left-3.5 top-3 text-stone-400 text-sm">lock</mat-icon>
                    <input 
                      id="corporate-password" 
                      type="password" 
                      [value]="password()" 
                      (input)="password.set($any($event.target).value)"
                      required
                      placeholder="••••••••••••" 
                      class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-xs shadow-inner">
                  </div>
                </div>

                <!-- Branch Selector if company has multiple active branches -->
                @if (selectedCompany()?.branches && selectedCompany()!.branches.length > 0) {
                  <div>
                    <label for="branch-selector" class="block font-bold text-stone-700 mb-1.5 font-serif">Unidade / Filial</label>
                    <div class="relative">
                      <mat-icon class="absolute left-3.5 top-3.5 text-stone-400 text-sm">store</mat-icon>
                      <select 
                        id="branch-selector"
                        [value]="selectedBranchId()"
                        (change)="selectedBranchId.set($any($event.target).value)"
                        class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-sans text-xs appearance-none cursor-pointer shadow-inner">
                        @for (br of selectedCompany()!.branches; track br.id) {
                          <option [value]="br.id">{{ br.name }} ({{ br.address }})</option>
                        }
                      </select>
                      <mat-icon class="absolute right-3.5 top-3 text-stone-400 text-sm pointer-events-none">expand_more</mat-icon>
                    </div>
                  </div>
                }

                <button 
                  type="submit" 
                  [disabled]="isLoading()"
                  class="w-full desk-brass-button text-xs font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mt-4 disabled:opacity-50">
                  @if (isLoading()) {
                    <mat-icon class="animate-spin text-sm">sync</mat-icon>
                    Autenticando na Bancada...
                  } @else {
                    <mat-icon class="text-sm">login</mat-icon>
                    Autenticar & Abrir 3EATCRU OS
                  }
                </button>
              </form>
            </div>
          }
        }

        <div class="pt-4 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 font-sans">
          <a routerLink="/" class="hover:text-stone-900 transition-colors flex items-center gap-1 font-semibold">
            <mat-icon class="text-[14px]">arrow_back</mat-icon>
            Página Inicial
          </a>
          <a routerLink="/hq/login" class="text-amber-800 hover:text-amber-950 transition-colors flex items-center gap-1 font-bold font-mono">
            <mat-icon class="text-xs">shield</mat-icon>
            Gabinete HQ
          </a>
        </div>
      </div>
    </div>
  `
})
export class AccessComponent {
  private router = inject(Router);
  private identityService = inject(IdentityService);

  step = signal<'company' | 'credentials'>('company');
  companyQuery = signal('');
  selectedCompany = signal<CompanyInfo | null>(null);
  availableCompanies = signal<CompanyInfo[]>([]);

  selectedBranchId = signal<string | null>(null);
  email = signal('gerente@3eatcru.com');
  password = signal('');
  
  isResolving = signal(false);
  isLoading = signal(false);
  isBooting = signal(false);
  bootProgress = signal(0);
  bootStage = signal('Validando sessão com o servidor...');
  errorMessage = signal<string | null>(null);

  async resolveCompany() {
    const query = this.companyQuery().trim();
    if (!query) {
      this.errorMessage.set('Informe o código ou identificador da empresa.');
      return;
    }

    this.isResolving.set(true);
    this.errorMessage.set(null);
    try {
      const company = await this.identityService.resolveCompany(query);
      this.selectResolvedCompany(company);
    } catch (e: unknown) {
      const err = e as { error?: { error?: string }; message?: string };
      this.errorMessage.set(err?.error?.error || err?.message || 'Empresa não encontrada.');
    } finally {
      this.isResolving.set(false);
    }
  }

  selectResolvedCompany(company: CompanyInfo) {
    this.selectedCompany.set(company);
    this.errorMessage.set(null);
    if (company.branches && company.branches.length > 0) {
      this.selectedBranchId.set(company.branches[0].id);
    } else {
      this.selectedBranchId.set(null);
    }
    this.step.set('credentials');
  }

  onFormSubmit(event: Event) {
    event.preventDefault();
    this.login();
  }

  async login() {
    const comp = this.selectedCompany();
    if (!comp) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.identityService.login({
        companyId: comp.id,
        email: this.email(),
        password: this.password(),
        branchId: this.selectedBranchId() || undefined
      });

      // Run Client OS Diagnostic Boot Sequence
      this.isBooting.set(true);
      this.isLoading.set(false);

      const stages = [
        { progress: 20, label: 'Autenticando sessão com Central Auth Server...' },
        { progress: 45, label: 'Carregando mapa de permissões (RBAC) e contexto de filial...' },
        { progress: 75, label: 'Verificando licença e inicializando motores do OS...' },
        { progress: 100, label: 'Sessão autorizada. Abrindo 3EATCRU OS...' }
      ];

      for (const st of stages) {
        this.bootProgress.set(st.progress);
        this.bootStage.set(st.label);
        await new Promise(r => setTimeout(r, 150));
      }

      this.router.navigate(['/os']);
    } catch (e: unknown) {
      this.isBooting.set(false);
      this.isLoading.set(false);
      const err = e as { error?: { error?: string }; message?: string };
      this.errorMessage.set(err?.error?.error || err?.message || 'Erro ao realizar login no Client OS.');
    }
  }
}
