import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HqApiClient } from '../../../../core/api/api-client';
import { firstValueFrom } from 'rxjs';
import { HqStateService } from '../../hq-state.service';
import { AppCatalogItem } from '../../../../core/domain/store/app-catalog.entity';

@Component({
  selector: 'app-hq-catalog',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h3 class="text-lg font-bold text-white uppercase tracking-wider">Catálogo Central de Módulos</h3>
          <p class="text-xs text-slate-400 mt-1">Gestão global de aplicativos disponíveis para instalação pelos tenants.</p>
        </div>
        <button (click)="loadApps()" class="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold px-3 py-2 rounded-lg border border-indigo-500/20 flex items-center gap-1.5 transition-colors">
          <mat-icon class="text-sm">refresh</mat-icon>
          Atualizar Catálogo
        </button>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <!-- New Module -->
        <div class="lg:col-span-1 space-y-6">
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h4 class="text-sm font-bold text-white mb-4 uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
              <mat-icon class="text-indigo-400 text-sm">extension</mat-icon>
              Adicionar Módulo Oficial
            </h4>
            <div class="space-y-4">
              <div>
                <label for="catalog-module-name" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome do App</label>
                <input id="catalog-module-name" type="text" [value]="newModuleName()" (input)="onNameInput($event)" placeholder="Ex: Motor de Promoções" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none">
              </div>
              <div>
                <label for="catalog-module-price" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Preço (Licença Mensal R$)</label>
                <input id="catalog-module-price" type="number" [value]="newModulePrice()" (input)="onPriceInput($event)" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none">
              </div>
              <div>
                <label for="catalog-module-icon" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ícone (Material Icon)</label>
                <input id="catalog-module-icon" type="text" [value]="newModuleIcon()" (input)="onIconInput($event)" placeholder="Ex: local_offer" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none">
              </div>
              <div>
                <label for="catalog-module-desc" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Descrição</label>
                <textarea id="catalog-module-desc" [value]="newModuleDesc()" (input)="onDescInput($event)" rows="3" placeholder="O que este módulo faz..." class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none resize-none"></textarea>
              </div>
              
              <button (click)="createModule()" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm">
                <mat-icon class="text-sm">publish</mat-icon>
                Publicar no Catálogo
              </button>
            </div>
          </div>
        </div>

        <!-- Catalog List -->
        <div class="lg:col-span-2">
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h4 class="text-sm font-bold text-white mb-4 uppercase tracking-wider border-b border-slate-800 pb-3 flex justify-between items-center">
              Módulos no Catálogo Global
              <span class="text-xs text-slate-500 font-mono">{{ availableApps().length }} módulos ativos</span>
            </h4>
            <div class="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              @for (app of availableApps(); track app.id) {
                <div class="bg-slate-950 border border-slate-800 rounded-lg p-4 flex gap-4 hover:border-slate-700 transition-colors">
                  <div class="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                    <mat-icon class="text-indigo-400">{{ app.icon }}</mat-icon>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-1">
                      <h5 class="font-bold text-white text-sm truncate pr-2">{{ app.name }}</h5>
                      <div class="text-xs font-bold text-emerald-400 whitespace-nowrap bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {{ (app.pricing.amount || 0) === 0 ? 'GRÁTIS' : ((app.pricing.amount || 0) | currency:'BRL') + '/mês' }}
                      </div>
                    </div>
                    <p class="text-[11px] text-slate-400 mb-2 line-clamp-2 leading-relaxed">{{ app.description }}</p>
                    <div class="flex justify-between items-center">
                      <span class="text-[9px] text-slate-500 font-mono uppercase tracking-wider">DEV: {{ app.developer }} | ID: {{ app.id }}</span>
                      <button (click)="deleteModule(app.id)" class="text-rose-400 hover:text-rose-300 text-[10px] font-bold uppercase flex items-center gap-1 transition-colors">
                        <mat-icon class="text-[12px] w-3 h-3">delete</mat-icon> Remover
                      </button>
                    </div>
                  </div>
                </div>
              }
              @if (availableApps().length === 0) {
                <div class="text-center py-8 text-slate-500">Nenhum módulo no catálogo.</div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class HqCatalogComponent implements OnInit {
  private http = inject(HqApiClient);
  private hqState = inject(HqStateService);

  availableApps = signal<AppCatalogItem[]>([]);
  
  newModuleName = signal('');
  newModuleDesc = signal('');
  newModulePrice = signal(0);
  newModuleIcon = signal('extension');

  ngOnInit() {
    this.loadApps();
  }

  onNameInput(event: Event) {
    this.newModuleName.set((event.target as HTMLInputElement).value);
  }

  onPriceInput(event: Event) {
    this.newModulePrice.set(Number((event.target as HTMLInputElement).value) || 0);
  }

  onIconInput(event: Event) {
    this.newModuleIcon.set((event.target as HTMLInputElement).value);
  }

  onDescInput(event: Event) {
    this.newModuleDesc.set((event.target as HTMLTextAreaElement).value);
  }

  async loadApps() {
    try {
      const list = await firstValueFrom(this.http.get<AppCatalogItem[]>('/api/v1/hq/apps'));
      this.availableApps.set(list || []);
    } catch (err: unknown) {
      console.error('Failed to load apps catalog in HQ', err);
    }
  }

  async createModule() {
    const name = this.newModuleName().trim();
    if (!name) {
      alert('Insira um nome válido para o módulo!');
      return;
    }
    const price = this.newModulePrice() || 0;
    const cleanSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
    const id = `app_${cleanSlug || 'module'}_${Date.now().toString(36)}`;

    const newApp = {
      id,
      name,
      description: this.newModuleDesc() || 'Sem descrição fornecida.',
      developer: 'HQ Platform',
      category: 'UTILITIES',
      icon: this.newModuleIcon() || 'extension',
      pricing: {
        model: price === 0 ? 'FREE' : 'SUBSCRIPTION_MONTHLY',
        amount: price,
        currency: 'BRL'
      },
      lifecycle: {
        status: 'DRAFT'
      },
      permissions: ['storage.read', 'storage.write'],
      capabilities: [],
      dependencies: [],
      isSystemApp: false
    };
    
    try {
      await firstValueFrom(this.http.post<unknown>('/api/v1/hq/apps', newApp));
      this.hqState.addLog(`Novo rascunho de módulo criado no catálogo: ${name} (ID: ${id})`, 'success');
      
      // Reset form & reload
      this.newModuleName.set('');
      this.newModuleDesc.set('');
      this.newModulePrice.set(0);
      this.newModuleIcon.set('extension');
      await this.loadApps();
    } catch (err: unknown) {
      console.error('Erro ao cadastrar módulo no catálogo:', err);
      alert('Falha ao cadastrar rascunho do módulo no servidor HQ.');
    }
  }

  async deleteModule(id: string) {
    if (!confirm(`Confirma a remoção do módulo ${id} do catálogo global?`)) return;
    try {
      await firstValueFrom(this.http.delete<unknown>(`/api/v1/hq/apps/${id}`));
      this.hqState.addLog(`Módulo removido do catálogo global: ${id}`, 'warn');
      await this.loadApps();
    } catch (err: unknown) {
      console.error('Erro ao deletar módulo:', err);
      alert('Falha ao remover módulo do servidor HQ.');
    }
  }
}
