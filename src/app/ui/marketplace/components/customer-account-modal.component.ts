import { Component, signal, output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CustomerIdentityService, CustomerActivity } from '../../../core/identity/customer-identity.service';

@Component({
  selector: 'app-customer-account-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
      <div class="relative w-full max-w-3xl max-h-[90vh] bg-[#fbf9f4] border-2 border-amber-900/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-stone-900">
        
        <!-- Header with Walnut & Brass Aesthetic -->
        <div class="px-6 py-4 border-b border-amber-900/40 flex items-center justify-between bg-gradient-to-r from-[#2c1d13] via-[#3a2719] to-[#2c1d13] text-amber-100 shadow-md">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl desk-brass-plate flex items-center justify-center text-amber-950 font-black text-lg border border-amber-300/40 shadow-xs">
              3ID
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base sm:text-lg font-bold font-serif text-amber-100 flex items-center gap-2">
                  3eatcru ID · Ficha do Consumidor
                </h2>
                <span class="desk-stamp-badge desk-stamp-official text-[8px] py-0.5 px-1.5 font-mono">
                  GLOBAL 3ID
                </span>
              </div>
              <p class="text-xs text-amber-300/70 font-mono">Credencial Unificada de Comandas, Pontos & Fidelidade</p>
            </div>
          </div>
          <button (click)="closeModal.emit()" class="p-2 text-amber-300/70 hover:text-white rounded-lg hover:bg-amber-950/60 transition-colors cursor-pointer">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Body Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6 font-sans">
          
          <!-- AUTH MODE (Login / Register) -->
          @if (!customerService.isAuthenticated()) {
            <div class="max-w-md mx-auto space-y-6">
              <!-- Mode Tabs -->
              <div class="flex p-1 bg-[#ede4d1] border border-amber-800/30 rounded-xl">
                <button 
                  type="button"
                  (click)="authMode.set('login')" 
                  class="flex-1 py-2 text-xs font-semibold rounded-lg transition-all font-serif cursor-pointer"
                  [class]="authMode() === 'login' ? 'desk-brass-button text-amber-950 font-bold shadow-xs' : 'text-stone-700 hover:text-amber-950'">
                  Entrar
                </button>
                <button 
                  type="button"
                  (click)="authMode.set('register')" 
                  class="flex-1 py-2 text-xs font-semibold rounded-lg transition-all font-serif cursor-pointer"
                  [class]="authMode() === 'register' ? 'desk-brass-button text-amber-950 font-bold shadow-xs' : 'text-stone-700 hover:text-amber-950'">
                  Criar Conta 3ID
                </button>
              </div>

              @if (errorMessage()) {
                <div class="p-3 text-xs bg-rose-50 border border-rose-300 rounded-xl text-rose-800 flex items-center gap-2 font-mono">
                  <mat-icon class="text-sm">error</mat-icon>
                  {{ errorMessage() }}
                </div>
              }

              <!-- Login Form -->
              @if (authMode() === 'login') {
                <form [formGroup]="loginForm" (ngSubmit)="handleLogin()" class="space-y-4">
                  <div>
                    <label for="login-email" class="block text-xs font-bold text-stone-700 mb-1 font-serif">E-mail</label>
                    <input 
                      id="login-email"
                      type="email" 
                      formControlName="email" 
                      placeholder="seu@email.com"
                      class="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors shadow-inner" />
                  </div>
                  <div>
                    <label for="login-password" class="block text-xs font-bold text-stone-700 mb-1 font-serif">Senha de Acesso</label>
                    <input 
                      id="login-password"
                      type="password" 
                      formControlName="password" 
                      placeholder="••••••••"
                      class="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors shadow-inner" />
                  </div>
                  <button 
                    type="submit" 
                    [disabled]="loginForm.invalid || loading()"
                    class="w-full py-3 desk-brass-button text-amber-950 font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm font-serif cursor-pointer disabled:opacity-50">
                    @if (loading()) {
                      <mat-icon class="animate-spin text-sm">sync</mat-icon> Autenticando...
                    } @else {
                      <mat-icon class="text-sm">login</mat-icon> Entrar na Conta 3eatcru ID
                    }
                  </button>
                </form>
              }

              <!-- Register Form -->
              @if (authMode() === 'register') {
                <form [formGroup]="registerForm" (ngSubmit)="handleRegister()" class="space-y-4">
                  <div>
                    <label for="reg-name" class="block text-xs font-bold text-stone-700 mb-1 font-serif">Nome Completo</label>
                    <input 
                      id="reg-name"
                      type="text" 
                      formControlName="name" 
                      placeholder="Ex: Maria Silva"
                      class="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors shadow-inner" />
                  </div>
                  <div>
                    <label for="reg-email" class="block text-xs font-bold text-stone-700 mb-1 font-serif">E-mail</label>
                    <input 
                      id="reg-email"
                      type="email" 
                      formControlName="email" 
                      placeholder="maria@email.com"
                      class="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors shadow-inner" />
                  </div>
                  <div>
                    <label for="reg-phone" class="block text-xs font-bold text-stone-700 mb-1 font-serif">Telefone / WhatsApp</label>
                    <input 
                      id="reg-phone"
                      type="text" 
                      formControlName="phone" 
                      placeholder="(11) 99999-9999"
                      class="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors shadow-inner" />
                  </div>
                  <div>
                    <label for="reg-password" class="block text-xs font-bold text-stone-700 mb-1 font-serif">Senha de Acesso</label>
                    <input 
                      id="reg-password"
                      type="password" 
                      formControlName="password" 
                      placeholder="Mínimo 6 caracteres"
                      class="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors shadow-inner" />
                  </div>
                  <button 
                    type="submit" 
                    [disabled]="registerForm.invalid || loading()"
                    class="w-full py-3 desk-brass-button text-amber-950 font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm font-serif cursor-pointer disabled:opacity-50">
                    @if (loading()) {
                      <mat-icon class="animate-spin text-sm">sync</mat-icon> Criando credencial...
                    } @else {
                      <mat-icon class="text-sm">person_add</mat-icon> Criar Conta 3eatcru ID
                    }
                  </button>
                </form>
              }
            </div>
          }

          <!-- AUTHENTICATED CONSUMER DASHBOARD -->
          @if (customerService.isAuthenticated()) {
            <div class="space-y-6">
              
              <!-- Profile Bar -->
              <div class="p-4 bg-[#f4ece0] border border-amber-800/25 rounded-2xl flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-full desk-brass-plate text-amber-950 border border-amber-400 flex items-center justify-center font-bold text-lg font-serif">
                    {{ customerService.currentCustomer()?.name?.substring(0, 2)?.toUpperCase() }}
                  </div>
                  <div>
                    <h3 class="font-bold font-serif text-stone-900 text-base">{{ customerService.currentCustomer()?.name }}</h3>
                    <p class="text-xs text-stone-600 font-mono">{{ customerService.currentCustomer()?.email }} • {{ customerService.currentCustomer()?.phone }}</p>
                  </div>
                </div>
                <button (click)="customerService.logout()" class="px-3 py-1.5 text-xs text-rose-800 hover:bg-rose-100 border border-rose-300 rounded-xl transition-colors flex items-center gap-1 font-serif cursor-pointer font-bold">
                  <mat-icon class="text-sm">logout</mat-icon> Sair
                </button>
              </div>

              <!-- Navigation Tabs -->
              <div class="flex gap-2 border-b border-stone-300 pb-2">
                <button 
                  (click)="activeTab.set('activity')" 
                  class="px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 font-serif cursor-pointer"
                  [class]="activeTab() === 'activity' ? 'desk-brass-button text-amber-950 font-bold' : 'text-stone-700 hover:text-amber-950'">
                  <mat-icon class="text-sm">receipt_long</mat-icon> Meus Pedidos & Fidelidade
                </button>
                <button 
                  (click)="activeTab.set('addresses')" 
                  class="px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 font-serif cursor-pointer"
                  [class]="activeTab() === 'addresses' ? 'desk-brass-button text-amber-950 font-bold' : 'text-stone-700 hover:text-amber-950'">
                  <mat-icon class="text-sm">location_on</mat-icon> Endereços de Entrega
                </button>
              </div>

              <!-- TAB 1: ACTIVITY & ORDERS -->
              @if (activeTab() === 'activity') {
                <div class="space-y-6">
                  
                  <!-- Loyalty Cards Across Companies -->
                  <div>
                    <h4 class="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <mat-icon class="text-emerald-400 text-sm">stars</mat-icon>
                      Programa de Fidelidade por Empresa
                    </h4>

                    @if (!activityData() || activityData()?.companyRelationships?.length === 0) {
                      <div class="p-4 bg-[#f6efe1] border border-amber-800/20 rounded-xl text-center text-xs text-stone-600 font-mono">
                        Você ainda não possui histórico de fidelidade registrado. Faça seu primeiro pedido em um dos estabelecimentos parceiros!
                      </div>
                    } @else {
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        @for (rel of activityData()?.companyRelationships; track rel.companyId) {
                          <div class="p-3.5 bg-[#fcfaf5] border border-amber-800/25 rounded-xl flex items-center justify-between shadow-xs">
                            <div>
                              <h5 class="font-bold text-sm font-serif text-stone-900">{{ rel.companyName }}</h5>
                              <p class="text-xs text-stone-600 font-mono">Total consumido: R$ {{ rel.totalSpent.toFixed(2) }}</p>
                            </div>
                            <div class="text-right">
                              <span class="desk-stamp-badge desk-stamp-official text-[9px] py-0.5 px-1.5 font-mono">
                                {{ rel.tier }}
                              </span>
                              <p class="text-xs font-bold text-amber-900 mt-1 font-mono">{{ rel.points }} pts acumulados</p>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <!-- Cross-company Unified Orders -->
                  <div>
                    <h4 class="text-xs font-bold font-serif text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <mat-icon class="text-amber-800 text-sm">shopping_bag</mat-icon>
                      Histórico Unificado de Pedidos & Comandas
                    </h4>

                    @if (!activityData() || activityData()?.orders?.length === 0) {
                      <div class="p-6 bg-[#f6efe1] border border-amber-800/20 rounded-xl text-center text-xs text-stone-600 font-mono">
                        Nenhum pedido realizado até o momento.
                      </div>
                    } @else {
                      <div class="space-y-3">
                        @for (ord of activityData()?.orders; track ord.id) {
                          <div class="p-4 bg-[#fcfaf5] border border-amber-800/25 rounded-xl space-y-2 shadow-xs">
                            <div class="flex items-center justify-between text-xs">
                              <span class="font-bold font-serif text-stone-900 text-sm">{{ ord.companyName }}</span>
                              <span class="desk-stamp-badge desk-stamp-official text-[8px] py-0.5 px-1 font-mono">
                                {{ ord.status }}
                              </span>
                            </div>
                            <p class="text-xs text-stone-600 font-mono">
                              Data: {{ ord.createdAt | date:'dd/MM/yyyy HH:mm' }} • Total: <strong class="text-amber-950 font-black">R$ {{ ord.total.toFixed(2) }}</strong>
                            </p>
                            @if (ord.items && ord.items.length > 0) {
                              <div class="text-xs text-stone-600 border-t border-amber-900/10 pt-2 flex flex-wrap gap-2">
                                @for (it of ord.items; track $index) {
                                  <span class="px-2 py-0.5 bg-[#f1e7d4] border border-amber-800/20 rounded text-[11px] text-stone-800 font-mono">
                                    {{ it.quantity }}x {{ it.name }}
                                  </span>
                                }
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>

                </div>
              }

              <!-- TAB 2: ADDRESSES -->
              @if (activeTab() === 'addresses') {
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <h4 class="text-xs font-bold font-serif text-stone-700 uppercase tracking-wider">Seus Endereços Cadastrados</h4>
                    <button 
                      (click)="showAddressForm.set(!showAddressForm())" 
                      class="px-3 py-1.5 desk-brass-button text-amber-950 font-bold text-xs rounded-xl transition-all flex items-center gap-1 font-serif cursor-pointer shadow-xs">
                      <mat-icon class="text-sm">{{ showAddressForm() ? 'remove' : 'add' }}</mat-icon> Novo Endereço
                    </button>
                  </div>

                  @if (showAddressForm()) {
                    <form [formGroup]="addressForm" (ngSubmit)="handleAddAddress()" class="p-4 bg-[#fbf9f4] border border-amber-800/30 rounded-2xl space-y-3 shadow-sm">
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label for="addr-street" class="block text-xs font-bold text-stone-700 mb-1 font-serif">Rua / Avenida</label>
                          <input id="addr-street" type="text" formControlName="street" placeholder="Rua das Flores" class="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-600 shadow-inner" />
                        </div>
                        <div>
                          <label for="addr-number" class="block text-xs font-bold text-stone-700 mb-1 font-serif">Número</label>
                          <input id="addr-number" type="text" formControlName="number" placeholder="123" class="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-600 shadow-inner" />
                        </div>
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label for="addr-neighborhood" class="block text-xs font-bold text-stone-700 mb-1 font-serif">Bairro</label>
                          <input id="addr-neighborhood" type="text" formControlName="neighborhood" placeholder="Centro" class="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-600 shadow-inner" />
                        </div>
                        <div>
                          <label for="addr-city" class="block text-xs font-bold text-stone-700 mb-1 font-serif">Cidade</label>
                          <input id="addr-city" type="text" formControlName="city" placeholder="São Paulo" class="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-600 shadow-inner" />
                        </div>
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label for="addr-state" class="block text-xs font-bold text-stone-700 mb-1 font-serif">Estado (UF)</label>
                          <input id="addr-state" type="text" formControlName="state" placeholder="SP" class="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-600 shadow-inner" />
                        </div>
                        <div>
                          <label for="addr-zipCode" class="block text-xs font-bold text-stone-700 mb-1 font-serif">CEP</label>
                          <input id="addr-zipCode" type="text" formControlName="zipCode" placeholder="01000-000" class="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-600 shadow-inner" />
                        </div>
                      </div>
                      <button 
                        type="submit" 
                        [disabled]="addressForm.invalid"
                        class="w-full py-2.5 desk-brass-button text-amber-950 font-bold text-xs rounded-xl transition-all shadow-sm font-serif cursor-pointer disabled:opacity-50">
                        Salvar Endereço
                      </button>
                    </form>
                  }

                  <div class="space-y-2">
                    @for (addr of customerService.currentCustomer()?.addresses; track addr.id) {
                      <div class="p-3 bg-[#fcfaf5] border border-amber-800/25 rounded-xl flex items-center justify-between text-xs shadow-2xs">
                        <div>
                          <p class="font-bold font-serif text-stone-900">{{ addr.street }}, {{ addr.number }} - {{ addr.neighborhood }}</p>
                          <p class="text-stone-600 font-mono">{{ addr.city }}/{{ addr.state }} • CEP {{ addr.zipCode }}</p>
                        </div>
                        <button (click)="handleDeleteAddress(addr.id)" class="text-rose-700 hover:text-rose-900 p-1 cursor-pointer" title="Excluir endereço">
                          <mat-icon class="text-sm">delete</mat-icon>
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }

            </div>
          }

        </div>
      </div>
    </div>
  `
})
export class CustomerAccountModalComponent implements OnInit {
  customerService = inject(CustomerIdentityService);
  private fb = inject(FormBuilder);

  closeModal = output<void>();

  authMode = signal<'login' | 'register'>('login');
  activeTab = signal<'activity' | 'addresses'>('activity');
  showAddressForm = signal<boolean>(false);
  loading = signal<boolean>(false);
  errorMessage = signal<string>('');
  activityData = signal<CustomerActivity | null>(null);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  registerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.minLength(10)]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  addressForm: FormGroup = this.fb.group({
    street: ['', [Validators.required]],
    number: ['', [Validators.required]],
    neighborhood: ['', [Validators.required]],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    zipCode: ['', [Validators.required]]
  });

  ngOnInit(): void {
    if (this.customerService.isAuthenticated()) {
      void this.loadActivity();
    }
  }

  async handleLogin(): Promise<void> {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.customerService.login(this.loginForm.value);
      await this.loadActivity();
    } catch (err: unknown) {
      const msg = (err as { error?: { error?: string } })?.error?.error || 'Erro ao realizar login.';
      this.errorMessage.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  async handleRegister(): Promise<void> {
    if (this.registerForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.customerService.register(this.registerForm.value);
      await this.loadActivity();
    } catch (err: unknown) {
      const msg = (err as { error?: { error?: string } })?.error?.error || 'Erro ao criar conta.';
      this.errorMessage.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  async loadActivity(): Promise<void> {
    try {
      const act = await this.customerService.fetchActivity();
      this.activityData.set(act);
    } catch {
      // ignore
    }
  }

  async handleAddAddress(): Promise<void> {
    if (this.addressForm.invalid) return;
    try {
      await this.customerService.addAddress(this.addressForm.value);
      this.addressForm.reset();
      this.showAddressForm.set(false);
    } catch {
      // ignore
    }
  }

  async handleDeleteAddress(id: string): Promise<void> {
    try {
      await this.customerService.deleteAddress(id);
    } catch {
      // ignore
    }
  }
}
