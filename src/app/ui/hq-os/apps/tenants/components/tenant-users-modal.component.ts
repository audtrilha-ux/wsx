import { Component, ChangeDetectionStrategy, input, output, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HqApiClient } from '../../../../../core/api/api-client';
import { firstValueFrom } from 'rxjs';
import { Company, CompanyBranch } from '../../../../../core/domain/company/company.entity';
import { HqStateService } from '../../../hq-state.service';

export interface TenantUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'operator';
  status: 'active' | 'suspended';
  branchIds?: string[];
  createdAt: string;
}

@Component({
  selector: 'app-tenant-users-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <mat-icon class="text-sm">people</mat-icon>
            </div>
            <div>
              <h4 class="text-sm font-bold text-white uppercase tracking-wider">Gestão de Contas & Usuários</h4>
              <p class="text-[11px] text-slate-400 font-mono">{{ company().name }} ({{ users().length }} usuários)</p>
            </div>
          </div>
          <button (click)="dismiss.emit()" class="text-slate-500 hover:text-white transition-colors">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          <!-- Architecture Note -->
          <div class="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300 flex items-start gap-2.5">
            <mat-icon class="text-base text-blue-400 shrink-0">verified_user</mat-icon>
            <div>
              <span class="font-bold">Regra Canônica de Identidade:</span> Os usuários gerenciados aqui autenticam no <strong>Client OS</strong> deste tenant (operadores de caixa, garçons, gerentes da loja). O escopo de filiais restringe o operador apenas às unidades selecionadas.
            </div>
          </div>

          <!-- Add / Edit User Form -->
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
            <div class="flex items-center justify-between">
              <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <mat-icon class="text-indigo-400 text-sm">{{ editingUserId() ? 'edit' : 'person_add' }}</mat-icon>
                {{ editingUserId() ? 'Editar Usuário / Operador' : 'Cadastrar Novo Operador / Usuário' }}
              </h5>
              @if (editingUserId()) {
                <button (click)="cancelEdit()" class="text-xs text-slate-400 hover:text-slate-200 underline">
                  Cancelar Edição
                </button>
              }
            </div>

            <div class="grid sm:grid-cols-3 gap-3">
              <div>
                <label for="tenant-user-name" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome Completo *</label>
                <input id="tenant-user-name" type="text" [value]="formName()" (input)="onNameInput($event)" placeholder="Ex: João da Silva"
                       class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
              </div>

              <div>
                <label for="tenant-user-email" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">E-mail *</label>
                <input id="tenant-user-email" type="email" [value]="formEmail()" (input)="onEmailInput($event)" placeholder="joao@empresa.com"
                       class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
              </div>

              <div>
                <label for="tenant-user-role" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Papel (Função)</label>
                <select id="tenant-user-role" [value]="formRole()" (change)="onRoleChange($event)"
                        class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
                  <option value="operator">Operador de Caixa</option>
                  <option value="manager">Gerente da Loja</option>
                  <option value="admin">Administrador do Tenant</option>
                </select>
              </div>

              <div>
                <label for="tenant-user-pin" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {{ editingUserId() ? 'Novo PIN (Opcional)' : 'PIN Numérico (4-6 dígitos)' }}
                </label>
                <input id="tenant-user-pin" type="password" [value]="formPin()" (input)="onPinInput($event)" placeholder="••••" maxlength="6"
                       class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none font-mono">
              </div>

              <div>
                <label for="tenant-user-pass" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {{ editingUserId() ? 'Nova Senha (Opcional)' : 'Senha de Acesso (Opcional)' }}
                </label>
                <input id="tenant-user-pass" type="password" [value]="formPassword()" (input)="onPasswordInput($event)" placeholder="Senha alfanumérica"
                       class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
              </div>

              <div>
                <label for="tenant-user-branch" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filial Permitida</label>
                <select id="tenant-user-branch" [value]="selectedBranchScope()" (change)="onBranchScopeChange($event)"
                        class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none">
                  <option value="ALL">Todas as Filiais (Acesso Global)</option>
                  @for (b of branches(); track b.id) {
                    <option [value]="b.id">{{ b.name }} ({{ b.id }})</option>
                  }
                </select>
              </div>
            </div>

            <div class="flex justify-end pt-1">
              <button (click)="saveUser()" [disabled]="!formName().trim() || !formEmail().trim()"
                      class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm">
                <mat-icon class="text-xs">{{ editingUserId() ? 'check' : 'add' }}</mat-icon>
                {{ editingUserId() ? 'Salvar Alterações' : 'Adicionar Usuário' }}
              </button>
            </div>
          </div>

          <!-- Users List -->
          <div>
            <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Usuários Cadastrados ({{ users().length }})
            </h5>
            <div class="space-y-2.5">
              @for (user of users(); track user.id) {
                <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
                      <mat-icon class="text-sm">person</mat-icon>
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-white">{{ user.name }}</span>
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono border"
                              [ngClass]="{
                                'bg-purple-500/10 text-purple-400 border-purple-500/20': user.role === 'admin',
                                'bg-blue-500/10 text-blue-400 border-blue-500/20': user.role === 'manager',
                                'bg-slate-800 text-slate-300 border-slate-700': user.role === 'operator'
                              }">
                          {{ user.role }}
                        </span>
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono border"
                              [ngClass]="user.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'">
                          {{ user.status === 'active' ? 'Ativo' : 'Suspenso' }}
                        </span>
                      </div>
                      <div class="text-[10px] text-slate-400 font-mono mt-0.5">
                        {{ user.email }} • Escopo: {{ getBranchScopeLabel(user.branchIds) }}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button (click)="startEdit(user)" title="Editar Usuário"
                            class="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors">
                      <mat-icon class="text-xs">edit</mat-icon>
                      Editar
                    </button>

                    <button (click)="toggleUserStatus(user)"
                            [title]="user.status === 'active' ? 'Suspender Usuário' : 'Ativar Usuário'"
                            class="p-1.5 rounded text-xs font-bold transition-colors"
                            [ngClass]="user.status === 'active' ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'">
                      <mat-icon class="text-sm">{{ user.status === 'active' ? 'pause_circle' : 'play_circle' }}</mat-icon>
                    </button>

                    <button (click)="removeUser(user.id)" title="Remover Usuário"
                            class="text-rose-400 hover:text-rose-300 p-1.5 hover:bg-rose-500/10 rounded transition-colors">
                      <mat-icon class="text-sm">delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
              @if (users().length === 0) {
                <div class="text-center py-6 text-slate-500 text-xs font-mono">Nenhum usuário cadastrado para este tenant.</div>
              }
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button (click)="dismiss.emit()" class="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `
})
export class TenantUsersModalComponent implements OnInit {
  company = input.required<Company>();
  dismiss = output<void>();

  private http = inject(HqApiClient);
  private hqState = inject(HqStateService);

  users = signal<TenantUser[]>([]);
  branches = signal<CompanyBranch[]>([]);

  editingUserId = signal<string | null>(null);
  formName = signal('');
  formEmail = signal('');
  formRole = signal<'admin' | 'manager' | 'operator'>('operator');
  formPin = signal('');
  formPassword = signal('');
  selectedBranchScope = signal<string>('ALL');

  ngOnInit() {
    this.loadBranches();
    this.loadUsers();
  }

  onNameInput(e: Event) { this.formName.set((e.target as HTMLInputElement).value); }
  onEmailInput(e: Event) { this.formEmail.set((e.target as HTMLInputElement).value); }
  onRoleChange(e: Event) { this.formRole.set((e.target as HTMLSelectElement).value as 'admin' | 'manager' | 'operator'); }
  onPinInput(e: Event) { this.formPin.set((e.target as HTMLInputElement).value); }
  onPasswordInput(e: Event) { this.formPassword.set((e.target as HTMLInputElement).value); }
  onBranchScopeChange(e: Event) { this.selectedBranchScope.set((e.target as HTMLSelectElement).value); }

  getBranchScopeLabel(branchIds?: string[]): string {
    if (!branchIds || branchIds.length === 0) return 'Todas as Filiais';
    const names = branchIds.map(id => {
      const found = this.branches().find(b => b.id === id);
      return found ? found.name : id;
    });
    return names.join(', ');
  }

  async loadBranches() {
    try {
      const list = await firstValueFrom(this.http.get<CompanyBranch[]>(`/api/v1/companies/${this.company().id}/branches`));
      this.branches.set(list);
    } catch (err) {
      console.error('Falha ao carregar filiais', err);
    }
  }

  async loadUsers() {
    try {
      const data = await firstValueFrom(this.http.get<TenantUser[]>(`/api/v1/companies/${this.company().id}/users`));
      this.users.set(data);
    } catch (err: unknown) {
      console.error('Failed to load tenant users', err);
    }
  }

  startEdit(u: TenantUser) {
    this.editingUserId.set(u.id);
    this.formName.set(u.name);
    this.formEmail.set(u.email);
    this.formRole.set(u.role);
    this.formPin.set('');
    this.formPassword.set('');
    if (u.branchIds && u.branchIds.length > 0) {
      this.selectedBranchScope.set(u.branchIds[0]);
    } else {
      this.selectedBranchScope.set('ALL');
    }
  }

  cancelEdit() {
    this.editingUserId.set(null);
    this.formName.set('');
    this.formEmail.set('');
    this.formRole.set('operator');
    this.formPin.set('');
    this.formPassword.set('');
    this.selectedBranchScope.set('ALL');
  }

  async saveUser() {
    const name = this.formName().trim();
    const email = this.formEmail().trim();
    if (!name || !email) return;

    const branchIds = this.selectedBranchScope() === 'ALL' ? undefined : [this.selectedBranchScope()];

    const payload: {
      name: string;
      email: string;
      role: 'admin' | 'manager' | 'operator';
      pin?: string;
      password?: string;
      branchIds?: string[];
    } = {
      name,
      email,
      role: this.formRole(),
      branchIds
    };

    if (this.formPin().trim()) payload.pin = this.formPin().trim();
    if (this.formPassword().trim()) payload.password = this.formPassword().trim();

    try {
      const editId = this.editingUserId();
      if (editId) {
        await firstValueFrom(this.http.put(`/api/v1/companies/${this.company().id}/users/${editId}`, payload));
        this.hqState.addLog(`Usuário '${name}' atualizado com sucesso.`, 'success');
      } else {
        await firstValueFrom(this.http.post<TenantUser>(`/api/v1/companies/${this.company().id}/users`, {
          ...payload,
          pin: payload.pin || undefined
        }));
        this.hqState.addLog(`Usuário '${name}' cadastrado para ${this.company().name}.`, 'success');
      }

      this.cancelEdit();
      await this.loadUsers();
    } catch (err: unknown) {
      console.error('Falha ao salvar usuário', err);
    }
  }

  async toggleUserStatus(user: TenantUser) {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await firstValueFrom(this.http.put(`/api/v1/companies/${this.company().id}/users/${user.id}`, {
        status: nextStatus
      }));
      this.hqState.addLog(`Status do usuário '${user.name}' alterado para ${nextStatus.toUpperCase()}.`, 'info');
      await this.loadUsers();
    } catch (err) {
      console.error('Falha ao alterar status do usuário', err);
    }
  }

  async removeUser(userId: string) {
    try {
      await firstValueFrom(this.http.delete(`/api/v1/companies/${this.company().id}/users/${userId}`));
      this.hqState.addLog(`Usuário removido com sucesso.`, 'warn');
      await this.loadUsers();
    } catch (err: unknown) {
      console.error('Failed to remove user', err);
    }
  }
}
