import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InventoryItem, StockUnit } from '../../domain/inventory.entity';

@Component({
  selector: 'app-inventory-create-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, ReactiveFormsModule],
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-in">
          <!-- Header -->
          <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h3 class="text-sm font-bold text-slate-900">Cadastrar Novo Produto (Product Master)</h3>
              <p class="text-[11px] text-slate-500 font-medium mt-0.5">Defina os atributos canônicos e níveis de estoque iniciais.</p>
            </div>
            <button
              type="button"
              (click)="closed.emit()"
              class="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer">
              <mat-icon class="text-[18px]">close</mat-icon>
            </button>
          </div>

          <!-- Form Body -->
          <form [formGroup]="productForm" (ngSubmit)="onSubmit()" class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div class="grid grid-cols-2 gap-4">
              <!-- Name -->
              <div class="col-span-2">
                <label for="p-name" class="block text-xs font-bold text-slate-700 mb-1">Nome do Produto *</label>
                <input
                  id="p-name"
                  type="text"
                  formControlName="name"
                  placeholder="Ex: Hambúrguer de Costela Bovino 150g"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                @if (productForm.get('name')?.touched && productForm.get('name')?.invalid) {
                  <span class="text-[10px] text-rose-500 mt-0.5 block font-semibold">Nome é obrigatório</span>
                }
              </div>

              <!-- SKU (Canônico) -->
              <div>
                <label for="p-sku" class="block text-xs font-bold text-slate-700 mb-1">SKU Canônico *</label>
                <input
                  id="p-sku"
                  type="text"
                  formControlName="sku"
                  placeholder="Ex: HAM-001"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 uppercase font-mono"
                />
                @if (productForm.get('sku')?.touched && productForm.get('sku')?.invalid) {
                  <span class="text-[10px] text-rose-500 mt-0.5 block font-semibold">SKU válido é obrigatório</span>
                }
              </div>

              <!-- Barcode -->
              <div>
                <label for="p-barcode" class="block text-xs font-bold text-slate-700 mb-1">Código de Barras (EAN)</label>
                <input
                  id="p-barcode"
                  type="text"
                  formControlName="barcode"
                  placeholder="Ex: 7891234567890"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                />
              </div>

              <!-- Category -->
              <div>
                <label for="p-category" class="block text-xs font-bold text-slate-700 mb-1">Categoria *</label>
                <input
                  id="p-category"
                  type="text"
                  formControlName="category"
                  placeholder="Ex: Alimentos, Bebidas, Insumos"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <!-- Unit -->
              <div>
                <label for="p-unit" class="block text-xs font-bold text-slate-700 mb-1">Unidade de Medida *</label>
                <select
                  id="p-unit"
                  formControlName="unit"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="UN">UN (Unidade)</option>
                  <option value="KG">KG (Quilograma)</option>
                  <option value="L">L (Litro)</option>
                  <option value="CX">CX (Caixa)</option>
                </select>
              </div>

              <!-- Cost Price -->
              <div>
                <label for="p-cost" class="block text-xs font-bold text-slate-700 mb-1">Preço de Custo (R$) *</label>
                <input
                  id="p-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  formControlName="costPrice"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold"
                />
              </div>

              <!-- Sale Price -->
              <div>
                <label for="p-sale" class="block text-xs font-bold text-slate-700 mb-1">Preço de Venda (R$) *</label>
                <input
                  id="p-sale"
                  type="number"
                  step="0.01"
                  min="0"
                  formControlName="salePrice"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold text-teal-600"
                />
              </div>

              <!-- Initial Stock -->
              <div>
                <label for="p-stock" class="block text-xs font-bold text-slate-700 mb-1">Estoque Inicial *</label>
                <input
                  id="p-stock"
                  type="number"
                  min="0"
                  formControlName="stockQuantity"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold"
                />
              </div>

              <!-- Min Stock -->
              <div>
                <label for="p-min" class="block text-xs font-bold text-slate-700 mb-1">Estoque Mínimo *</label>
                <input
                  id="p-min"
                  type="number"
                  min="0"
                  formControlName="minStock"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold"
                />
              </div>
            </div>

            <!-- Footer Buttons -->
            <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                (click)="closed.emit()"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="productForm.invalid"
                class="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                <mat-icon class="text-[16px]">save</mat-icon>
                Salvar Produto
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class InventoryCreateModalComponent {
  isOpen = input<boolean>(false);
  closed = output<void>();
  saved = output<Partial<InventoryItem>>();

  private fb = inject(FormBuilder);

  productForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    sku: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]+$/)]],
    barcode: [''],
    category: ['Geral', Validators.required],
    unit: ['UN', Validators.required],
    costPrice: [0, [Validators.required, Validators.min(0)]],
    salePrice: [0, [Validators.required, Validators.min(0)]],
    stockQuantity: [0, [Validators.required, Validators.min(0)]],
    minStock: [5, [Validators.required, Validators.min(0)]]
  });

  onSubmit() {
    if (this.productForm.invalid) return;

    const values = this.productForm.value;
    const partialItem: Partial<InventoryItem> = {
      sku: values.sku.toUpperCase(),
      name: values.name,
      category: values.category,
      costPrice: Number(values.costPrice),
      salePrice: Number(values.salePrice),
      stockQuantity: Number(values.stockQuantity),
      minStock: Number(values.minStock),
      unit: values.unit as StockUnit,
      barcode: values.barcode || undefined,
      status: 'active'
    };

    this.saved.emit(partialItem);
    this.productForm.reset({
      name: '',
      sku: '',
      barcode: '',
      category: 'Geral',
      unit: 'UN',
      costPrice: 0,
      salePrice: 0,
      stockQuantity: 0,
      minStock: 5
    });
  }
}
