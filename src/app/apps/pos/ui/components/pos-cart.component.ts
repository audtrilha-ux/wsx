import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../domain/pos.entity';

export interface PosCustomerOption {
  id: string;
  name: string;
  points: number;
  tier: string;
}

export interface DiscountDetails {
  discountType?: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount: number;
}

@Component({
  selector: 'app-pos-cart',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <aside class="w-80 md:w-96 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-xs">
      <!-- Header -->
      <div class="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <mat-icon class="text-indigo-600 text-[20px]">shopping_cart</mat-icon>
          <h3 class="font-bold text-xs text-slate-800 uppercase tracking-wider">Itens do Pedido</h3>
        </div>
        <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
          {{ cart().length }} {{ cart().length === 1 ? 'item' : 'itens' }}
        </span>
      </div>

      <!-- Items List -->
      <div class="flex-1 overflow-y-auto p-4 space-y-2.5">
        @for (item of cart(); track item.product.id) {
          <div class="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-2 hover:border-slate-300 transition-colors">
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-slate-800 truncate">{{ item.product.name }}</div>
              <div class="text-[11px] text-slate-500 mt-0.5">
                {{ item.product.price | currency:'BRL' }} un.
              </div>
            </div>

            <!-- Quantity Controls -->
            <div class="flex items-center gap-1">
              <button
                (click)="updateQuantity(item.product.id, -1)"
                class="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer">
                <mat-icon class="text-[14px]">remove</mat-icon>
              </button>
              <span class="w-6 text-center text-xs font-bold text-slate-800">{{ item.quantity }}</span>
              <button
                (click)="updateQuantity(item.product.id, 1)"
                class="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer">
                <mat-icon class="text-[14px]">add</mat-icon>
              </button>
            </div>

            <div class="text-right min-w-[70px]">
              <div class="text-xs font-bold text-slate-900">
                {{ (item.quantity * item.product.price) | currency:'BRL' }}
              </div>
            </div>
          </div>
        }
        @if (cart().length === 0) {
          <div class="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
            <mat-icon class="text-3xl text-slate-300 mb-1">remove_shopping_cart</mat-icon>
            Nenhum produto adicionado
          </div>
        }
      </div>

      <!-- Quick Hardware Actions Bar -->
      <div class="px-4 py-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px]">
        <button
          (click)="openDrawer.emit()"
          class="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium cursor-pointer">
          <mat-icon class="text-[16px]">point_of_sale</mat-icon>
          Abrir Gaveta
        </button>
        <button
          (click)="readScale.emit()"
          class="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium cursor-pointer">
          <mat-icon class="text-[16px]">scale</mat-icon>
          Ler Balança
        </button>
      </div>

      <!-- Customer Loyalty Selector -->
      <div class="p-4 border-t border-slate-200 bg-slate-50/50 space-y-1.5">
        <label for="pos-customer-selector" class="text-[11px] font-bold text-slate-700 flex items-center gap-1">
          <mat-icon class="text-violet-600 text-[16px]">loyalty</mat-icon>
          Cliente / Fidelidade
        </label>
        <select
          id="pos-customer-selector"
          [value]="selectedCustomerId()"
          (change)="onCustomerChange($event)"
          class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-sans">
          <option value="">Consumidor Não Identificado</option>
          @for (cust of customers(); track cust.id) {
            <option [value]="cust.id">
              {{ cust.name }} ({{ cust.points }} pts - {{ cust.tier }})
            </option>
          }
        </select>

        @if (selectedCustomer(); as activeCust) {
          @if (activeCust.points >= 20) {
            <div class="mt-2 p-2 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-between text-[11px]">
              <div>
                <span class="font-bold text-violet-900 block">Saldo: {{ activeCust.points }} pts</span>
                <span class="text-[10px] text-violet-600">Disponível p/ resgate</span>
              </div>
              <button
                type="button"
                (click)="applyLoyaltyDiscount(activeCust.points)"
                class="bg-violet-600 hover:bg-violet-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-xs">
                <mat-icon class="text-[14px]">redeem</mat-icon>
                Resgatar
              </button>
            </div>
          }
        }
      </div>

      <!-- Discount Section -->
      <div class="p-4 border-t border-slate-200 bg-white space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <mat-icon class="text-emerald-600 text-[16px]">sell</mat-icon>
            Desconto Operacional
          </span>
          @if (discountType !== 'NONE') {
            <button (click)="clearDiscount()" class="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer">Remover</button>
          }
        </div>
        
        <div class="flex items-center gap-2">
          <button 
            (click)="setDiscountType('PERCENT')"
            [class]="discountType === 'PERCENT' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'"
            class="flex-1 border rounded-lg py-1.5 text-[11px] font-medium text-center transition-all cursor-pointer">
            % Porcentagem
          </button>
          <button 
            (click)="setDiscountType('FIXED')"
            [class]="discountType === 'FIXED' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'"
            class="flex-1 border rounded-lg py-1.5 text-[11px] font-medium text-center transition-all cursor-pointer">
            R$ Valor Fixo
          </button>
        </div>

        @if (discountType !== 'NONE') {
          <div class="flex items-center gap-2 mt-1.5 animate-fade-in">
            <div class="relative flex-1">
              <span class="absolute left-2.5 top-2 text-slate-400 text-[11px] font-bold">
                {{ discountType === 'PERCENT' ? '%' : 'R$' }}
              </span>
              <input
                id="pos-discount-value"
                type="number"
                [value]="discountValue"
                (input)="onDiscountValueChange($event)"
                min="0"
                [max]="discountType === 'PERCENT' ? 100 : total()"
                placeholder="0"
                class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
              />
            </div>
            <div class="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 shrink-0">
              - {{ calculatedDiscountAmount() | currency:'BRL' }}
            </div>
          </div>
        }
      </div>

      <!-- Payment Method Selector -->
      <div class="p-4 border-t border-slate-200 bg-slate-50/40 space-y-1.5">
        <label for="pos-payment-method" class="text-[11px] font-bold text-slate-700 flex items-center gap-1">
          <mat-icon class="text-indigo-600 text-[16px]">payments</mat-icon>
          Forma de Pagamento
        </label>
        <div class="grid grid-cols-2 gap-1.5">
          @for (method of paymentMethods; track method.id) {
            <button
              (click)="selectedPaymentMethod = method.id; paymentMethodChange.emit(method.id)"
              [class]="selectedPaymentMethod === method.id
                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'"
              class="border rounded-lg p-2 text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-left">
              <mat-icon class="text-[16px]">{{ method.icon }}</mat-icon>
              <span>{{ method.name }}</span>
            </button>
          }
        </div>
      </div>

      <!-- Checkout Footer -->
      <div class="p-4 border-t border-slate-200 bg-slate-50">
        <!-- Subtotal / Discount Summary if any -->
        @if (discountType !== 'NONE' && calculatedDiscountAmount() > 0) {
          <div class="space-y-1.5 mb-2.5 border-b border-slate-200/60 pb-2.5 text-xs">
            <div class="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{{ total() | currency:'BRL' }}</span>
            </div>
            <div class="flex justify-between text-emerald-600 font-medium">
              <span>Desconto</span>
              <span>-{{ calculatedDiscountAmount() | currency:'BRL' }}</span>
            </div>
          </div>
        }

        <div class="flex justify-between items-baseline mb-3">
          <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total a Pagar</span>
          <span class="text-2xl font-bold text-slate-900">{{ finalTotal() | currency:'BRL' }}</span>
        </div>

        <button
          [disabled]="cart().length === 0 || isProcessing()"
          (click)="onCheckout()"
          class="w-full bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]">
          @if (isProcessing()) {
            <mat-icon class="animate-spin text-[20px]">autorenew</mat-icon>
            Processando Venda...
          } @else {
            <mat-icon class="text-[20px]">check_circle</mat-icon>
            Finalizar & Imprimir Cupom
          }
        </button>
      </div>
    </aside>
  `
})
export class PosCartComponent {
  cart = input<{ product: Product; quantity: number }[]>([]);
  total = input<number>(0);
  customers = input<PosCustomerOption[]>([]);
  selectedCustomerId = input<string>('');
  isProcessing = input<boolean>(false);

  selectedCustomer = computed(() => this.customers().find(c => c.id === this.selectedCustomerId()));

  customerIdChange = output<string>();
  paymentMethodChange = output<string>();
  quantityChange = output<{ productId: string; delta: number }>();
  checkout = output<DiscountDetails>();
  openDrawer = output<void>();
  readScale = output<void>();

  selectedPaymentMethod = 'PIX';
  discountType: 'PERCENT' | 'FIXED' | 'NONE' = 'NONE';
  discountValue = 0;

  readonly paymentMethods = [
    { id: 'PIX', name: 'PIX Instantâneo', icon: 'qr_code' },
    { id: 'DINHEIRO', name: 'Dinheiro', icon: 'attach_money' },
    { id: 'CARTAO_DEBITO', name: 'Cartão Débito', icon: 'credit_card' },
    { id: 'CARTAO_CREDITO', name: 'Cartão Crédito', icon: 'credit_score' }
  ];

  updateQuantity(productId: string, delta: number) {
    this.quantityChange.emit({ productId, delta });
  }

  onCustomerChange(event: Event) {
    this.customerIdChange.emit((event.target as HTMLSelectElement).value);
  }

  setDiscountType(type: 'PERCENT' | 'FIXED') {
    this.discountType = type;
    this.discountValue = 0;
  }

  clearDiscount() {
    this.discountType = 'NONE';
    this.discountValue = 0;
  }

  onDiscountValueChange(event: Event) {
    const val = parseFloat((event.target as HTMLInputElement).value) || 0;
    if (this.discountType === 'PERCENT') {
      this.discountValue = Math.min(100, Math.max(0, val));
    } else {
      this.discountValue = Math.min(this.total(), Math.max(0, val));
    }
  }

  calculatedDiscountAmount(): number {
    if (this.discountType === 'PERCENT') {
      return Number(((this.total() * this.discountValue) / 100).toFixed(2));
    } else if (this.discountType === 'FIXED') {
      return Number(Math.min(this.total(), this.discountValue).toFixed(2));
    }
    return 0;
  }

  finalTotal(): number {
    return Math.max(0, this.total() - this.calculatedDiscountAmount());
  }

  onCheckout() {
    this.checkout.emit({
      discountType: this.discountType === 'NONE' ? undefined : this.discountType,
      discountValue: this.discountValue,
      discountAmount: this.calculatedDiscountAmount()
    });
  }

  applyLoyaltyDiscount(points: number) {
    const discount = Math.floor(points / 20) * 10;
    this.discountType = 'FIXED';
    this.discountValue = Math.min(this.total(), discount);
  }
}
