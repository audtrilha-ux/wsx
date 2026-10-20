import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DiningTable } from '../../domain/table.entity';

@Component({
  selector: 'app-table-order-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        
        <!-- Modal Header -->
        <div class="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <mat-icon class="text-indigo-400">receipt_long</mat-icon>
            <div>
              <h3 class="text-sm font-bold">Comanda: {{ table().name }}</h3>
              <span class="text-[10px] text-slate-400">
                Atendente: {{ table().currentOrder?.waiterName }} | {{ table().currentOrder?.customerCount }} clientes
              </span>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <button 
              (click)="printPreBill.emit(table())"
              class="bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
              title="Imprimir conferência térmica para o cliente">
              <mat-icon class="text-xs">receipt</mat-icon> Imprimir Pré-Conta
            </button>
            <button (click)="closeModal.emit()" class="text-slate-400 hover:text-white">
              <mat-icon class="text-sm">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Modal Body -->
        <div class="flex-1 overflow-y-auto p-5 space-y-5">
          
          <!-- Quick Add Item Form -->
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <mat-icon class="text-xs text-indigo-600">add_shopping_cart</mat-icon> Lançar Novo Item na Comanda
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div class="sm:col-span-5">
                <input 
                  [value]="name()"
                  (input)="onNameInput($event)"
                  type="text" 
                  placeholder="Nome do Produto / Prato / Bebida"
                  class="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              </div>
              <div class="sm:col-span-2">
                <input 
                  [value]="quantity()"
                  (input)="onQuantityInput($event)"
                  type="number" 
                  min="1"
                  placeholder="Qtd"
                  class="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500">
              </div>
              <div class="sm:col-span-2">
                <input 
                  [value]="price()"
                  (input)="onPriceInput($event)"
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  placeholder="R$ Unit"
                  class="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500">
              </div>
              <div class="sm:col-span-3">
                <button 
                  (click)="onAddItem()"
                  class="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm">
                  <mat-icon class="text-xs">add</mat-icon> Enviar Cozinha
                </button>
              </div>
            </div>

            <div>
              <input 
                [value]="notes()"
                (input)="onNotesInput($event)"
                type="text" 
                placeholder="Observações da cozinha (Ex: Sem cebola, ao ponto, gelo e limão...)"
                class="w-full text-[11px] p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
          </div>

          <!-- Ordered Items Table -->
          <div>
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Itens da Comanda</h4>
            <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-100 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                    <th class="py-2.5 px-3">Item / Observação</th>
                    <th class="py-2.5 px-3 text-center">Qtd</th>
                    <th class="py-2.5 px-3 text-right">Unitário</th>
                    <th class="py-2.5 px-3 text-right">Total</th>
                    <th class="py-2.5 px-3 text-center">Status</th>
                    <th class="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-700">
                  @for (item of table().currentOrder?.items; track item.id) {
                    <tr class="hover:bg-slate-50/75" [class.opacity-50]="item.status === 'CANCELLED'">
                      <td class="py-2.5 px-3">
                        <div class="font-bold" [class.line-through]="item.status === 'CANCELLED'" [class.text-slate-900]="item.status !== 'CANCELLED'">{{ item.name }}</div>
                        @if (item.notes) {
                          <div class="text-[10px] text-amber-700 font-semibold">Obs: {{ item.notes }}</div>
                        }
                      </td>
                      <td class="py-2.5 px-3 text-center font-mono font-bold">{{ item.quantity }}</td>
                      <td class="py-2.5 px-3 text-right font-mono">R$ {{ item.unitPrice | number:'1.2-2' }}</td>
                      <td class="py-2.5 px-3 text-right font-mono font-bold">R$ {{ (item.quantity * item.unitPrice) | number:'1.2-2' }}</td>
                      <td class="py-2.5 px-3 text-center">
                        @if (item.status === 'PENDING_KITCHEN') {
                          <span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Pendente</span>
                        } @else if (item.status === 'IN_PREPARATION') {
                          <span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Preparando</span>
                        } @else if (item.status === 'READY') {
                          <span class="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Pronto</span>
                        } @else if (item.status === 'CANCELLED') {
                          <span class="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Cancelado</span>
                        } @else {
                          <span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Servido</span>
                        }
                      </td>
                      <td class="py-2.5 px-3 text-center">
                        @if (item.status !== 'CANCELLED') {
                          <button 
                            (click)="cancelItem.emit(item.id)"
                            type="button"
                            class="p-1 hover:bg-rose-50 text-rose-600 rounded transition-colors" 
                            title="Cancelar item">
                            <mat-icon class="text-sm">delete_forever</mat-icon>
                          </button>
                        } @else {
                          <span class="text-slate-400 text-[11px]">-</span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="6" class="py-6 text-center text-slate-400 font-medium">Nenhum item lançado nesta comanda ainda.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- Additional Actions Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Discount Form -->
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <h5 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <mat-icon class="text-xs text-indigo-600">sell</mat-icon> Desconto na Comanda
              </h5>
              
              <div class="flex items-center gap-2">
                <input 
                  [value]="discountValue() || ''"
                  (input)="onDiscountValueInput($event)"
                  type="number" 
                  min="0"
                  placeholder="Valor"
                  class="w-24 text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono">
                
                <select 
                  [value]="discountType()"
                  (change)="onDiscountTypeChange($event)"
                  class="text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="PERCENT">% Porcentagem</option>
                  <option value="FIXED">R$ Fixo</option>
                </select>

                <button 
                  (click)="onApplyDiscount()"
                  type="button"
                  class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors shadow-xs">
                  Aplicar
                </button>
              </div>
              @if (table().currentOrder?.discount) {
                <div class="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <mat-icon class="text-xs">check_circle</mat-icon> Desconto ativo: 
                  {{ table().currentOrder?.discount }} {{ table().currentOrder?.discountType === 'PERCENT' ? '%' : 'R$' }}
                  <button (click)="onRemoveDiscount()" class="text-[10px] text-rose-600 font-bold hover:underline ml-2 cursor-pointer">Remover</button>
                </div>
              }
            </div>

            <!-- Transfer Table Form -->
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <h5 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <mat-icon class="text-xs text-indigo-600">move_up</mat-icon> Transferir Comanda de Mesa
              </h5>
              
              <div class="flex items-center gap-2">
                <select 
                  #targetSelect
                  class="flex-1 text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Selecione Mesa de Destino...</option>
                  @for (t of availableTables(); track t.id) {
                    @if (t.id !== table().id) {
                      <option [value]="t.id">{{ t.name }} (Capacidade: {{ t.capacity }})</option>
                    }
                  }
                </select>

                <button 
                  (click)="onTransferTable(targetSelect.value); targetSelect.value = ''"
                  type="button"
                  [disabled]="!targetSelect.value"
                  class="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors shadow-xs flex items-center gap-1">
                  Transferir
                </button>
              </div>
            </div>

            <!-- Join Tables Form -->
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <h5 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <mat-icon class="text-xs text-indigo-600">merge</mat-icon> Juntar com outra Mesa
              </h5>
              
              <div class="flex items-center gap-2">
                <select 
                  #joinSelect
                  class="flex-1 text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans">
                  <option value="">Selecione Mesa Alvo...</option>
                  @for (t of availableTables(); track t.id) {
                    @if (t.id !== table().id && (t.status === 'OCCUPIED' || t.status === 'BILLING')) {
                      <option [value]="t.id">{{ t.name }} (Comanda ativa)</option>
                    }
                  }
                </select>

                <button 
                  (click)="onJoinTables(joinSelect.value); joinSelect.value = ''"
                  type="button"
                  [disabled]="!joinSelect.value"
                  class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors shadow-xs flex items-center gap-1">
                  Juntar
                </button>
              </div>
            </div>

            <!-- Split Table Form -->
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <h5 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <mat-icon class="text-xs text-indigo-600">call_split</mat-icon> Separar / Particionar Comanda
              </h5>
              <p class="text-[10px] text-slate-500">Mover parte dos itens desta comanda para uma nova mesa.</p>
              <button 
                (click)="onStartSplit()"
                type="button"
                class="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1">
                <mat-icon class="text-xs">call_split</mat-icon> Iniciar Divisão de Itens
              </button>
            </div>
          </div>

        </div>

        <!-- Modal Footer Total & Actions -->
        <div class="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div class="space-y-0.5">
            <div class="text-xs text-slate-500 flex items-center gap-2">
              <span>Subtotal: R$ {{ (table().currentOrder?.subtotal || 0) | number:'1.2-2' }}</span>
              @if (table().currentOrder?.discount) {
                <span class="text-emerald-700 font-bold">
                  (Desconto: - R$ {{ ((table().currentOrder?.subtotal || 0) - (table().currentOrder?.total || 0)) | number:'1.2-2' }})
                </span>
              }
            </div>
            <div class="text-xl font-bold font-mono text-slate-900">
              R$ {{ (table().currentOrder?.total || 0) | number:'1.2-2' }}
            </div>
            @if ((table().currentOrder?.customerCount || 1) > 1) {
              <div class="text-[10px] text-slate-500 font-mono">
                Dividido por {{ table().currentOrder?.customerCount }} pessoas: <strong>R$ {{ (table().currentOrder?.perPersonTotal || 0) | number:'1.2-2' }}</strong> por pessoa
              </div>
            }
          </div>

          <div class="flex items-center gap-2">
            <button 
              (click)="closeModal.emit()"
              class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
              Fechar Janela
            </button>
            <button 
              (click)="checkout.emit(table())"
              class="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm flex items-center gap-1.5">
              <mat-icon class="text-xs">point_of_sale</mat-icon> Encerrar Conta
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableOrderModalComponent {
  table = input.required<DiningTable>();
  availableTables = input<DiningTable[]>([]);

  closeModal = output<void>();
  addItem = output<{ name: string; quantity: number; price: number; notes?: string }>();
  checkout = output<DiningTable>();
  printPreBill = output<DiningTable>();
  
  cancelItem = output<string>();
  applyDiscount = output<{ discountValue: number; discountType: 'PERCENT' | 'FIXED' }>();
  transferTable = output<{ sourceTableId: string; targetTableId: string }>();
  joinTables = output<{ sourceTableId: string; targetTableId: string }>();
  startSplit = output<DiningTable>();

  name = signal<string>('');
  quantity = signal<number>(1);
  price = signal<number>(0);
  notes = signal<string>('');

  discountValue = signal<number>(0);
  discountType = signal<'PERCENT' | 'FIXED'>('PERCENT');

  onNameInput(event: Event) {
    this.name.set((event.target as HTMLInputElement).value);
  }

  onQuantityInput(event: Event) {
    this.quantity.set(Number((event.target as HTMLInputElement).value));
  }

  onPriceInput(event: Event) {
    this.price.set(Number((event.target as HTMLInputElement).value));
  }

  onNotesInput(event: Event) {
    this.notes.set((event.target as HTMLInputElement).value);
  }

  onDiscountValueInput(event: Event) {
    this.discountValue.set(Number((event.target as HTMLInputElement).value));
  }

  onDiscountTypeChange(event: Event) {
    this.discountType.set((event.target as HTMLSelectElement).value as 'PERCENT' | 'FIXED');
  }

  onAddItem() {
    if (!this.name().trim() || this.quantity() <= 0 || this.price() <= 0) return;
    this.addItem.emit({
      name: this.name().trim(),
      quantity: this.quantity(),
      price: this.price(),
      notes: this.notes().trim() || undefined
    });
    this.name.set('');
    this.quantity.set(1);
    this.price.set(0);
    this.notes.set('');
  }

  onApplyDiscount() {
    if (this.discountValue() < 0) return;
    this.applyDiscount.emit({
      discountValue: this.discountValue(),
      discountType: this.discountType()
    });
  }

  onRemoveDiscount() {
    this.discountValue.set(0);
    this.applyDiscount.emit({
      discountValue: 0,
      discountType: 'PERCENT'
    });
  }

  onTransferTable(targetTableId: string) {
    if (!targetTableId) return;
    this.transferTable.emit({
      sourceTableId: this.table().id,
      targetTableId
    });
  }

  onJoinTables(targetTableId: string) {
    if (!targetTableId) return;
    this.joinTables.emit({
      sourceTableId: this.table().id,
      targetTableId
    });
  }

  onStartSplit() {
    this.startSplit.emit(this.table());
  }
}
