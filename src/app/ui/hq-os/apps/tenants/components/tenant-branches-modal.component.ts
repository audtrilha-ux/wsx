import { Component, ChangeDetectionStrategy, input, output, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HqApiClient } from '../../../../../core/api/api-client';
import { firstValueFrom } from 'rxjs';
import { Company, CompanyBranch } from '../../../../../core/domain/company/company.entity';
import { HqStateService } from '../../../hq-state.service';

@Component({
  selector: 'app-tenant-branches-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <mat-icon class="text-sm">storefront</mat-icon>
            </div>
            <div>
              <h4 class="text-sm font-bold text-white uppercase tracking-wider">Gestão de Filiais & Unidades</h4>
              <p class="text-[11px] text-slate-400 font-mono">{{ company().name }} ({{ branches().length }} filiais)</p>
            </div>
          </div>
          <button (click)="dismiss.emit()" class="text-slate-500 hover:text-white transition-colors">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          <!-- Architecture Note -->
          <div class="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2.5">
            <mat-icon class="text-base text-emerald-400 shrink-0">account_tree</mat-icon>
            <div>
              <span class="font-bold">Hierarquia de Autoridade:</span> Cada filial possui configurações fiscais, dados de impressão e identificação geográfica independentes. Terminais de hardware e operadores podem ser vinculados a filiais específicas.
            </div>
          </div>

          <!-- Add / Edit Branch Form -->
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
            <div class="flex items-center justify-between">
              <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <mat-icon class="text-emerald-400 text-sm">{{ editingBranchId() ? 'edit' : 'add_business' }}</mat-icon>
                {{ editingBranchId() ? 'Editar Filial' : 'Adicionar Nova Filial' }}
              </h5>
              @if (editingBranchId()) {
                <button (click)="cancelEdit()" class="text-xs text-slate-400 hover:text-slate-200 underline">
                  Cancelar Edição
                </button>
              }
            </div>

            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label for="branch-name" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome da Filial *</label>
                <input id="branch-name" type="text" [value]="formName()" (input)="onNameInput($event)" placeholder="Ex: Matriz - Centro"
                       class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none">
              </div>

              <div>
                <label for="branch-code" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Código / Sigla</label>
                <input id="branch-code" type="text" [value]="formCode()" (input)="onCodeInput($event)" placeholder="Ex: FIL-01"
                       class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none font-mono">
              </div>

              <div>
                <label for="branch-phone" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Telefone / WhatsApp</label>
                <input id="branch-phone" type="text" [value]="formPhone()" (input)="onPhoneInput($event)" placeholder="(11) 99999-9999"
                       class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none">
              </div>

              <div>
                <label for="branch-address" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Endereço Completo</label>
                <input id="branch-address" type="text" [value]="formAddress()" (input)="onAddressInput($event)" placeholder="Rua das Flores, 123 - Centro"
                       class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none">
              </div>

              <div>
                <label for="branch-receipt-header" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cabeçalho do Recibo (Cupom)</label>
                <input id="branch-receipt-header" type="text" [value]="formReceiptHeader()" (input)="onReceiptHeaderInput($event)" placeholder="Texto topo do cupom"
                       class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none">
              </div>

              <div>
                <label for="branch-receipt-footer" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rodapé do Recibo</label>
                <input id="branch-receipt-footer" type="text" [value]="formReceiptFooter()" (input)="onReceiptFooterInput($event)" placeholder="Volte Sempre!"
                       class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none">
              </div>
            </div>

            <div class="flex items-center justify-between pt-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" [checked]="formIsMain()" (change)="onIsMainChange($event)" class="rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-0">
                <span class="text-xs text-slate-300 font-bold">Definir como Filial Principal (Matriz)</span>
              </label>

              <button (click)="saveBranch()" [disabled]="!formName().trim()"
                      class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm">
                <mat-icon class="text-xs">{{ editingBranchId() ? 'check' : 'add' }}</mat-icon>
                {{ editingBranchId() ? 'Salvar Alterações' : 'Cadastrar Filial' }}
              </button>
            </div>
          </div>

          <!-- Branches List -->
          <div class="space-y-3">
            <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Filiais Cadastradas ({{ branches().length }})
            </h5>

            <div class="space-y-2.5">
              @for (branch of branches(); track branch.id) {
                <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <h6 class="text-sm font-bold text-white">{{ branch.name }}</h6>
                      @if (branch.isMain) {
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Matriz
                        </span>
                      }
                      <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono border"
                            [ngClass]="branch.isActive !== false ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'">
                        {{ branch.isActive !== false ? 'Ativa' : 'Inativa' }}
                      </span>
                    </div>

                    <div class="text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span>ID: <strong class="text-slate-300 font-mono">{{ branch.id }}</strong></span>
                      @if (branch.code) {
                        <span>Código: <strong class="text-slate-300 font-mono">{{ branch.code }}</strong></span>
                      }
                      @if (branch.phone) {
                        <span>Tel: <strong class="text-slate-300">{{ branch.phone }}</strong></span>
                      }
                      @if (branch.address) {
                        <span>Endereço: <strong class="text-slate-300">{{ branch.address }}</strong></span>
                      }
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button (click)="startEdit(branch)" title="Editar dados da filial"
                            class="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors">
                      <mat-icon class="text-xs">edit</mat-icon>
                      Editar
                    </button>

                    <button (click)="toggleBranchStatus(branch)" [title]="branch.isActive !== false ? 'Desativar filial' : 'Ativar filial'"
                            class="p-1.5 rounded text-xs font-bold transition-colors"
                            [ngClass]="branch.isActive !== false ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'">
                      <mat-icon class="text-sm">{{ branch.isActive !== false ? 'pause_circle' : 'play_circle' }}</mat-icon>
                    </button>

                    <button (click)="deleteBranch(branch.id)" [disabled]="branches().length <= 1" title="Excluir filial"
                            class="p-1.5 rounded text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                      <mat-icon class="text-sm">delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
              @if (branches().length === 0) {
                <div class="text-center py-6 text-slate-500 text-xs font-mono">Nenhuma filial cadastrada para este tenant.</div>
              }
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button (click)="dismiss.emit()" class="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider transition-colors">
            Concluir
          </button>
        </div>
      </div>
    </div>
  `
})
export class TenantBranchesModalComponent implements OnInit {
  company = input.required<Company>();
  dismiss = output<void>();

  private http = inject(HqApiClient);
  private hqState = inject(HqStateService);

  branches = signal<CompanyBranch[]>([]);
  editingBranchId = signal<string | null>(null);

  formName = signal('');
  formCode = signal('');
  formAddress = signal('');
  formPhone = signal('');
  formReceiptHeader = signal('');
  formReceiptFooter = signal('');
  formIsMain = signal(false);

  ngOnInit() {
    this.loadBranches();
  }

  onNameInput(e: Event) { this.formName.set((e.target as HTMLInputElement).value); }
  onCodeInput(e: Event) { this.formCode.set((e.target as HTMLInputElement).value); }
  onAddressInput(e: Event) { this.formAddress.set((e.target as HTMLInputElement).value); }
  onPhoneInput(e: Event) { this.formPhone.set((e.target as HTMLInputElement).value); }
  onReceiptHeaderInput(e: Event) { this.formReceiptHeader.set((e.target as HTMLInputElement).value); }
  onReceiptFooterInput(e: Event) { this.formReceiptFooter.set((e.target as HTMLInputElement).value); }
  onIsMainChange(e: Event) { this.formIsMain.set((e.target as HTMLInputElement).checked); }

  async loadBranches() {
    try {
      const list = await firstValueFrom(this.http.get<CompanyBranch[]>(`/api/v1/companies/${this.company().id}/branches`));
      this.branches.set(list);
    } catch (err) {
      console.error('Falha ao carregar filiais', err);
    }
  }

  startEdit(b: CompanyBranch) {
    this.editingBranchId.set(b.id);
    this.formName.set(b.name);
    this.formCode.set(b.code || '');
    this.formAddress.set(b.address || '');
    this.formPhone.set(b.phone || '');
    this.formReceiptHeader.set(b.receiptHeader || '');
    this.formReceiptFooter.set(b.receiptFooter || '');
    this.formIsMain.set(!!b.isMain);
  }

  cancelEdit() {
    this.editingBranchId.set(null);
    this.clearForm();
  }

  clearForm() {
    this.formName.set('');
    this.formCode.set('');
    this.formAddress.set('');
    this.formPhone.set('');
    this.formReceiptHeader.set('');
    this.formReceiptFooter.set('');
    this.formIsMain.set(false);
  }

  async saveBranch() {
    const name = this.formName().trim();
    if (!name) return;

    const payload = {
      name,
      code: this.formCode().trim() || undefined,
      address: this.formAddress().trim() || undefined,
      phone: this.formPhone().trim() || undefined,
      receiptHeader: this.formReceiptHeader().trim() || undefined,
      receiptFooter: this.formReceiptFooter().trim() || undefined,
      isMain: this.formIsMain()
    };

    try {
      const editId = this.editingBranchId();
      if (editId) {
        await firstValueFrom(this.http.put(`/api/v1/companies/${this.company().id}/branches/${editId}`, payload));
        this.hqState.addLog(`Filial '${name}' atualizada com sucesso para ${this.company().name}.`, 'success');
      } else {
        await firstValueFrom(this.http.post(`/api/v1/companies/${this.company().id}/branches`, payload));
        this.hqState.addLog(`Nova filial '${name}' cadastrada para ${this.company().name}.`, 'success');
      }

      this.cancelEdit();
      await this.loadBranches();
    } catch (err: unknown) {
      console.error('Erro ao salvar filial', err);
    }
  }

  async toggleBranchStatus(branch: CompanyBranch) {
    const newStatus = branch.isActive === false;
    try {
      await firstValueFrom(this.http.put(`/api/v1/companies/${this.company().id}/branches/${branch.id}`, {
        ...branch,
        isActive: newStatus
      }));
      this.hqState.addLog(`Filial '${branch.name}' foi ${newStatus ? 'ATIVADA' : 'DESATIVADA'}.`, 'info');
      await this.loadBranches();
    } catch (err) {
      console.error('Erro ao alterar status da filial', err);
    }
  }

  async deleteBranch(branchId: string) {
    if (this.branches().length <= 1) return;
    try {
      await firstValueFrom(this.http.delete(`/api/v1/companies/${this.company().id}/branches/${branchId}`));
      this.hqState.addLog(`Filial removida com sucesso.`, 'warn');
      await this.loadBranches();
    } catch (err) {
      console.error('Erro ao excluir filial', err);
    }
  }
}
