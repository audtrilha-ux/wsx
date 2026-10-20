import { Component, ChangeDetectionStrategy, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PublicProduct } from './restaurant-template.component';
import { OsEventBusService } from '../../../core/events/event-bus.service';
import { CartService } from '../../../core/application/cart.service';
import { LinuxThemeService } from '../../../core/theme/linux-theme.service';
import { PrinterService } from '../../../core/printing/printer.service';
import { OsStateService } from '../../../os-state.service';
import { CustomerIdentityService } from '../../../core/identity/customer-identity.service';
import { Subscription, interval } from 'rxjs';

export interface CartItem {
  product: PublicProduct;
  quantity: number;
}

interface NominatimResponse {
  display_name?: string;
}

@Component({
  selector: 'app-public-space-cart-drawer',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isWindowMode()) {
      <!-- ============================================================= -->
      <!-- OS WINDOW MODE: Integrated Draggable, Resizable Comanda Ledger -->
      <!-- ============================================================= -->
      <div [class]="themeService.isDeskTheme() ? 'h-full flex flex-col bg-[#faf8f2] text-stone-900 select-none' : 'h-full flex flex-col bg-slate-900 text-slate-100 select-none'">
        
        <!-- Ledger Header Strip with Brass Accents -->
        <div [class]="themeService.isDeskTheme() ? 'px-4 py-3 border-b border-amber-600/30 bg-[#241a12] text-amber-100 flex items-center justify-between shadow-xs' : 'px-4 py-3 border-b border-white/10 bg-slate-950 text-white flex items-center justify-between'">
          <div class="flex items-center gap-2.5">
            <div [class]="themeService.isDeskTheme() ? 'w-7 h-7 rounded desk-brass-plate flex items-center justify-center text-amber-950 shadow-xs' : 'w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center'">
              <mat-icon class="text-sm">receipt_long</mat-icon>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-xs font-black tracking-wide uppercase" [class.text-amber-100]="themeService.isDeskTheme()">Comanda & Sacola de Pedidos</h3>
                <span class="desk-stamp-badge desk-stamp-official text-[8px] py-0 px-1 font-mono">BALCÃO</span>
              </div>
              <p class="text-[10px] text-amber-200/60 font-mono">{{ space()?.title || osState.company().name || '3eatcru Terminal' }}</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button 
              type="button" 
              (click)="printReceipt()" 
              [disabled]="items().length === 0"
              class="px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
              [class]="themeService.isDeskTheme() ? 'desk-brass-button text-amber-950' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'">
              <mat-icon class="text-xs">print</mat-icon>
              <span>Imprimir 2ª Via</span>
            </button>
            @if (items().length > 0) {
              <button 
                type="button" 
                (click)="resetOrder()" 
                class="px-2 py-1 text-[10px] text-rose-500 hover:bg-rose-500/10 rounded transition-colors font-bold cursor-pointer">
                Limpar
              </button>
            }
          </div>
        </div>

        <!-- Two-Column Workspace Container -->
        <div class="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          <!-- LEFT COLUMN: Itemized Comanda Ledger Sheet -->
          <div [class]="themeService.isDeskTheme() ? 'flex-1 overflow-y-auto p-4 desk-ledger-sheet border-r border-amber-800/20 space-y-3' : 'flex-1 overflow-y-auto p-4 bg-slate-900 border-r border-white/5 space-y-3'">
            <div class="flex items-center justify-between border-b pb-2" [class]="themeService.isDeskTheme() ? 'border-amber-700/20' : 'border-white/10'">
              <span class="text-[11px] font-bold uppercase tracking-wider font-mono text-stone-600">Itens Lançados ({{ totalItems() }})</span>
              <span class="text-[11px] font-mono text-stone-500">Valor Unitário · Total</span>
            </div>

            <!-- Empty State with Quick Sample Suggestions -->
            @if (items().length === 0) {
              <div class="py-10 text-center space-y-4">
                <div class="w-12 h-12 rounded-full mx-auto flex items-center justify-center" [class]="themeService.isDeskTheme() ? 'bg-amber-100 text-amber-800' : 'bg-slate-800 text-slate-400'">
                  <mat-icon class="text-2xl">shopping_cart</mat-icon>
                </div>
                <div class="space-y-1">
                  <h4 class="text-xs font-bold" [class]="themeService.isDeskTheme() ? 'text-stone-800' : 'text-slate-200'">A comanda de balcão está vazia</h4>
                  <p class="text-[11px] max-w-xs mx-auto leading-relaxed" [class]="themeService.isDeskTheme() ? 'text-stone-500' : 'text-slate-400'">
                    Adicione itens do cardápio público ou clique em um dos exemplos rápidos abaixo:
                  </p>
                </div>

                <!-- Quick Artisanal Demonstration Items -->
                <div class="flex flex-wrap gap-2 justify-center max-w-md mx-auto pt-2">
                  <button type="button" (click)="addSampleItem('Café Espresso Especial', 8.50, 'Grãos arábica selecionados')" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-xs" [class]="themeService.isDeskTheme() ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'">
                    <mat-icon class="text-xs">coffee</mat-icon> + Café Espresso (R$ 8,50)
                  </button>
                  <button type="button" (click)="addSampleItem('Pão de Queijo da Canastra', 12.00, 'Queijo curado tradicional')" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-xs" [class]="themeService.isDeskTheme() ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'">
                    <mat-icon class="text-xs">bakery_dining</mat-icon> + Pão de Queijo (R$ 12,00)
                  </button>
                  <button type="button" (click)="addSampleItem('Burger Artesanal Defumado', 38.00, 'Blend 180g com queijo prato')" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-xs" [class]="themeService.isDeskTheme() ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'">
                    <mat-icon class="text-xs">lunch_dining</mat-icon> + Burger Artesanal (R$ 38,00)
                  </button>
                  <button type="button" (click)="addSampleItem('Suco Natural de Laranja', 9.00, '500ml extraído na hora')" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-xs" [class]="themeService.isDeskTheme() ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'">
                    <mat-icon class="text-xs">local_drink</mat-icon> + Suco Natural (R$ 9,00)
                  </button>
                </div>
              </div>
            } @else {
              <!-- Filled Item List -->
              <div class="space-y-2">
                @for (item of items(); track item.product.name) {
                  <div class="flex items-center justify-between p-2.5 rounded-xl border transition-all"
                       [class]="themeService.isDeskTheme() ? 'bg-white/80 border-stone-200 hover:border-amber-400 text-stone-900 shadow-xs' : 'bg-slate-800/60 border-white/5 hover:border-white/10 text-white'">
                    <div class="space-y-0.5 flex-1 min-w-0 pr-3">
                      <h5 class="text-xs font-bold truncate leading-tight">{{ item.product.name }}</h5>
                      <span class="text-[10px] font-mono text-stone-500 block">R$ {{ item.product.price | number:'1.2-2' }} cada</span>
                    </div>

                    <div class="flex items-center gap-3 shrink-0">
                      <!-- Quantity Stepper -->
                      <div class="flex items-center rounded-lg border overflow-hidden" [class]="themeService.isDeskTheme() ? 'border-amber-300 bg-amber-50' : 'border-slate-700 bg-slate-900'">
                        <button type="button" (click)="decreaseQty(item)" class="w-6 h-6 flex items-center justify-center hover:bg-black/10 text-xs font-bold cursor-pointer">-</button>
                        <span class="w-7 text-center text-xs font-bold font-mono">{{ item.quantity }}</span>
                        <button type="button" (click)="increaseQty(item)" class="w-6 h-6 flex items-center justify-center hover:bg-black/10 text-xs font-bold cursor-pointer">+</button>
                      </div>

                      <span class="text-xs font-black font-mono w-20 text-right">
                        R$ {{ (item.product.price * item.quantity) | number:'1.2-2' }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- RIGHT COLUMN: Customer Details, Payment, Summary & Submission -->
          <div [class]="themeService.isDeskTheme() ? 'w-full md:w-[340px] p-4 bg-[#fdfbf7] flex flex-col justify-between shrink-0 overflow-y-auto space-y-4' : 'w-full md:w-[340px] p-4 bg-slate-950 flex flex-col justify-between shrink-0 overflow-y-auto space-y-4'">
            
            @if (orderSuccess()) {
              <!-- Live Order Tracking Confirmation -->
              <div class="p-4 rounded-xl border space-y-4 animate-fade-in"
                   [class]="themeService.isDeskTheme() ? 'bg-amber-50/60 border-amber-300 text-stone-900' : 'bg-slate-900 border-emerald-500/30 text-white'">
                <div class="text-center space-y-1">
                  <mat-icon class="text-emerald-500 text-3xl">check_circle</mat-icon>
                  <h4 class="text-xs font-bold uppercase tracking-wider">Pedido Transmitido ao Kernel</h4>
                  <div class="text-[10px] font-mono bg-black/10 py-0.5 px-2 rounded inline-block font-bold">
                    ID: {{ orderSuccessId().slice(-8).toUpperCase() }}
                  </div>
                </div>

                <!-- Stepper Progress Bar -->
                <div class="space-y-2 pt-2">
                  <div class="flex justify-between text-[10px] font-mono">
                    <span>Status:</span>
                    <span class="font-bold text-emerald-600">{{ orderStatus() }}</span>
                  </div>
                  <div class="w-full h-2 rounded-full bg-black/10 overflow-hidden">
                    <div class="h-full bg-emerald-500 transition-all duration-500" [style.width.%]="getStepperProgressPercent()"></div>
                  </div>
                </div>

                <div class="pt-2 flex flex-col gap-2">
                  <button type="button" (click)="printReceipt()" class="w-full py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer" [class]="themeService.isDeskTheme() ? 'desk-brass-button text-amber-950' : 'bg-emerald-600 text-white'">
                    <mat-icon class="text-sm">print</mat-icon>
                    Imprimir Comanda da Cozinha
                  </button>
                  <button type="button" (click)="resetOrder()" class="text-[11px] font-bold text-center underline opacity-75 hover:opacity-100 cursor-pointer">
                    Abrir Nova Comanda
                  </button>
                </div>
              </div>
            } @else {
              <!-- Order Entry Form -->
              <div class="space-y-3">
                <div class="text-[10px] font-bold uppercase tracking-wider opacity-60 font-mono">Dados do Cliente</div>
                
                <div>
                  <label for="win-cust-name" class="block text-[10px] font-bold mb-1">Nome do Cliente *</label>
                  <input 
                    id="win-cust-name" 
                    type="text" 
                    [value]="customerName()" 
                    (input)="customerName.set($any($event.target).value)" 
                    placeholder="Ex: Carlos Oliveira" 
                    class="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none font-sans"
                    [class]="themeService.isDeskTheme() ? 'bg-white border-stone-300 focus:border-amber-600' : 'bg-slate-900 border-white/10 focus:border-indigo-500 text-white'">
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label for="win-cust-phone" class="block text-[10px] font-bold mb-1">WhatsApp / Contato</label>
                    <input 
                      id="win-cust-phone" 
                      type="text" 
                      [value]="customerPhone()" 
                      (input)="customerPhone.set($any($event.target).value)" 
                      placeholder="(11) 98765-4321" 
                      class="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none font-sans"
                      [class]="themeService.isDeskTheme() ? 'bg-white border-stone-300 focus:border-amber-600' : 'bg-slate-900 border-white/10 focus:border-indigo-500 text-white'">
                  </div>

                  <div>
                    <label for="win-payment-method" class="block text-[10px] font-bold mb-1">Forma de Pagamento</label>
                    <select 
                      id="win-payment-method" 
                      [value]="paymentMethod()" 
                      (change)="paymentMethod.set($any($event.target).value)" 
                      class="w-full px-2 py-1.5 text-xs rounded-lg border outline-none"
                      [class]="themeService.isDeskTheme() ? 'bg-white border-stone-300 text-stone-900' : 'bg-slate-900 border-white/10 text-white'">
                      <option value="PIX">PIX Online</option>
                      <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                      <option value="CARTAO_DEBITO">Cartão de Débito</option>
                      <option value="DINHEIRO">Dinheiro / À Vista</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label for="win-cust-addr" class="block text-[10px] font-bold mb-1">Entrega ou Balcão</label>
                  <div class="flex gap-1.5">
                    <input 
                      id="win-cust-addr" 
                      type="text" 
                      [value]="customerAddress()" 
                      (input)="customerAddress.set($any($event.target).value)" 
                      placeholder="Ex: Retirar no balcão" 
                      class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border outline-none"
                      [class]="themeService.isDeskTheme() ? 'bg-white border-stone-300 focus:border-amber-600' : 'bg-slate-900 border-white/10 focus:border-indigo-500 text-white'">
                    <button 
                      type="button" 
                      (click)="fillAddressWithGPS()" 
                      [disabled]="gpsLoading()" 
                      title="Preencher com GPS do dispositivo"
                      class="px-2 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                      [class]="themeService.isDeskTheme() ? 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'">
                      <mat-icon class="text-xs">my_location</mat-icon>
                      GPS
                    </button>
                  </div>
                </div>
              </div>

              <!-- Order Totals & Dispatch -->
              <div class="pt-3 border-t space-y-3" [class]="themeService.isDeskTheme() ? 'border-stone-200' : 'border-white/10'">
                <div class="space-y-1 font-mono text-xs">
                  <div class="flex justify-between text-stone-500">
                    <span>Subtotal:</span>
                    <span>R$ {{ totalAmount() | number:'1.2-2' }}</span>
                  </div>
                  <div class="flex justify-between font-black text-sm pt-1 border-t" [class]="themeService.isDeskTheme() ? 'border-stone-200 text-stone-900' : 'border-white/10 text-white'">
                    <span>Total Geral:</span>
                    <span class="text-base text-amber-600">R$ {{ totalAmount() | number:'1.2-2' }}</span>
                  </div>
                </div>

                @if (errorMessage()) {
                  <div class="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                    {{ errorMessage() }}
                  </div>
                }

                <div class="space-y-2 pt-1">
                  <button 
                    type="button" 
                    (click)="submitOrder()" 
                    [disabled]="isSubmitting() || items().length === 0" 
                    class="w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    [class]="themeService.isDeskTheme() ? 'desk-brass-button text-amber-950' : 'bg-indigo-600 hover:bg-indigo-500 text-white'">
                    @if (isSubmitting()) {
                      <div class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span>Transmitindo Pedido...</span>
                    } @else {
                      <mat-icon class="text-sm">send</mat-icon>
                      <span>Lançar Pedido & Transmitir ao KDS</span>
                    }
                  </button>
                </div>
              </div>
            }

          </div>
        </div>
      </div>
    } @else {
      <!-- ============================================================= -->
      <!-- STANDALONE WEB MODE: Floating Button & Slide-over Drawer       -->
      <!-- ============================================================= -->
      <button 
        (click)="isOpen.set(true)"
        [style.background-color]="space()?.themeColor || '#4f46e5'"
        class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 text-white font-bold rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer">
        <div class="relative flex items-center justify-center">
          <mat-icon>shopping_bag</mat-icon>
          @if (totalItems() > 0) {
            <span class="absolute -top-2 -right-2 bg-amber-400 text-slate-900 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow">
              {{ totalItems() }}
            </span>
          }
        </div>
        <div class="text-left leading-tight hidden sm:block">
          <div class="text-[10px] uppercase font-bold opacity-80">Sacola de Pedidos</div>
          <div class="text-xs font-black">R$ {{ totalAmount() | number:'1.2-2' }}</div>
        </div>
      </button>

      @if (isOpen()) {
        <div class="fixed inset-0 z-50 overflow-hidden animate-fade-in">
          <button 
            type="button" 
            aria-label="Fechar sacola" 
            class="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity w-full h-full border-none cursor-pointer" 
            (click)="isOpen.set(false)" 
            (keydown.escape)="isOpen.set(false)">
          </button>

          <div class="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
            <div class="w-screen max-w-md desk-paper-sheet flex flex-col justify-between pointer-events-auto shadow-2xl">
              
              <!-- Drawer Header -->
              <div class="px-6 py-5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <mat-icon class="text-[20px]">shopping_bag</mat-icon>
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-900 leading-tight">Sacola do Cliente</h3>
                    <p class="text-[11px] text-slate-500">{{ space()?.title }}</p>
                  </div>
                </div>
                <button (click)="isOpen.set(false)" class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <!-- Drawer Body -->
              <div class="flex-1 overflow-y-auto p-6 space-y-6">
                @if (orderSuccess()) {
                  <div class="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-5 animate-fade-in">
                    <div class="text-center space-y-2">
                      <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                        <mat-icon class="text-2xl">check_circle</mat-icon>
                      </div>
                      <h4 class="font-bold text-slate-900 text-base">Pedido Acompanhado em Tempo Real</h4>
                      <p class="text-xs text-slate-500 leading-relaxed">
                        Seu pedido online do <strong>{{ space()?.title }}</strong> está integrado ao barramento de eventos do 3eatcru OS.
                      </p>
                      <div class="text-[11px] font-mono bg-slate-200/70 py-1 px-2.5 rounded text-slate-700 inline-block">
                        Código: {{ orderSuccessId().slice(-8).toUpperCase() }}
                      </div>
                    </div>

                    <div class="relative py-2 px-1">
                      <div class="absolute left-6 top-3 bottom-3 w-0.5 bg-slate-200"></div>
                      <div class="absolute left-6 top-3 w-0.5 bg-indigo-600 transition-all duration-500"
                           [style.height.%]="getStepperProgressPercent()"></div>

                      <div class="space-y-5 relative">
                        <div class="flex items-start gap-4">
                          <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white z-10 transition-colors"
                               [class.border-indigo-600]="isStepActive('PENDING') || isStepDone('PENDING')"
                               [class.bg-indigo-600]="isStepDone('PENDING')">
                            @if (isStepDone('PENDING')) { <div class="w-1.5 h-1.5 rounded-full bg-white"></div> }
                          </div>
                          <div class="space-y-0.5">
                            <h5 class="text-xs font-bold" [class.text-indigo-600]="isStepActive('PENDING')" [class.text-slate-800]="!isStepActive('PENDING')">Pedido Recebido</h5>
                            <p class="text-[10px] text-slate-400">Aguardando confirmação na cozinha</p>
                          </div>
                        </div>

                        <div class="flex items-start gap-4">
                          <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white z-10 transition-colors"
                               [class.border-indigo-600]="isStepActive('PREPARING') || isStepDone('PREPARING')"
                               [class.bg-indigo-600]="isStepDone('PREPARING')">
                            @if (isStepDone('PREPARING')) { <div class="w-1.5 h-1.5 rounded-full bg-white"></div> }
                          </div>
                          <div class="space-y-0.5">
                            <h5 class="text-xs font-bold" [class.text-indigo-600]="isStepActive('PREPARING')" [class.text-slate-800]="!isStepActive('PREPARING')">Em Preparação</h5>
                            <p class="text-[10px] text-slate-400">Nossos chefs estão preparando seu pedido</p>
                          </div>
                        </div>

                        <div class="flex items-start gap-4">
                          <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white z-10 transition-colors"
                               [class.border-indigo-600]="isStepActive('READY') || isStepActive('DELIVERING') || isStepDone('READY')"
                               [class.bg-indigo-600]="isStepDone('READY')">
                            @if (isStepDone('READY')) { <div class="w-1.5 h-1.5 rounded-full bg-white"></div> }
                          </div>
                          <div class="space-y-0.5">
                            <h5 class="text-xs font-bold" [class.text-indigo-600]="isStepActive('READY') || isStepActive('DELIVERING')" [class.text-slate-800]="!(isStepActive('READY') || isStepActive('DELIVERING'))">Pronto para Retirada / Saiu para Entrega</h5>
                            <p class="text-[10px] text-slate-400">Pedido embalado e pronto para o consumo</p>
                          </div>
                        </div>

                        <div class="flex items-start gap-4">
                          <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white z-10 transition-colors"
                               [class.border-indigo-600]="isStepActive('COMPLETED')"
                               [class.bg-indigo-600]="isStepActive('COMPLETED')">
                            @if (isStepActive('COMPLETED')) { <div class="w-1.5 h-1.5 rounded-full bg-white"></div> }
                          </div>
                          <div class="space-y-0.5">
                            <h5 class="text-xs font-bold" [class.text-indigo-600]="isStepActive('COMPLETED')" [class.text-slate-800]="!isStepActive('COMPLETED')">Finalizado</h5>
                            <p class="text-[10px] text-slate-400">Entregue e concluído</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="pt-2 text-center">
                      <button (click)="resetOrder()" class="text-xs font-bold text-slate-600 hover:text-indigo-600 underline cursor-pointer transition-colors">
                        Fazer nova compra
                      </button>
                    </div>
                  </div>
                } @else {
                  @if (items().length === 0) {
                    <div class="py-12 text-center space-y-3">
                      <mat-icon class="text-slate-300 text-5xl w-auto h-auto">remove_shopping_cart</mat-icon>
                      <p class="text-sm text-slate-500 font-medium">Sua sacola está vazia.</p>
                      <p class="text-xs text-slate-400 max-w-xs mx-auto">Selecione produtos no cardápio ou vitrine ao lado para montar seu pedido online.</p>
                    </div>
                  } @else {
                    <div class="space-y-3">
                      <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Itens Selecionados</div>
                      @for (item of items(); track item.product.name) {
                        <div class="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                          <div class="space-y-0.5 max-w-[180px]">
                            <h5 class="text-xs font-bold text-slate-900 truncate">{{ item.product.name }}</h5>
                            <span class="text-[11px] text-slate-500 font-mono">R$ {{ item.product.price | number:'1.2-2' }} un</span>
                          </div>
                          <div class="flex items-center gap-3">
                            <div class="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
                              <button (click)="decreaseQty(item)" class="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded text-xs font-bold cursor-pointer">-</button>
                              <span class="w-6 text-center text-xs font-bold text-slate-900 font-mono">{{ item.quantity }}</span>
                              <button (click)="increaseQty(item)" class="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded text-xs font-bold cursor-pointer">+</button>
                            </div>
                            <span class="text-xs font-black text-slate-900 font-mono w-16 text-right">
                              R$ {{ (item.product.price * item.quantity) | number:'1.2-2' }}
                            </span>
                          </div>
                        </div>
                      }
                    </div>

                    <div class="pt-4 border-t border-slate-100 space-y-3">
                      <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Dados de Entrega / Retirada</div>
                      <div>
                        <label for="cart-customer-name" class="block text-[11px] font-bold text-slate-700 mb-1">Seu Nome Completo *</label>
                        <input 
                          id="cart-customer-name"
                          type="text" 
                          [value]="customerName()" 
                          (input)="customerName.set($any($event.target).value)" 
                          placeholder="Ex: Maria da Silva" 
                          class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none bg-white">
                      </div>
                      <div class="grid grid-cols-2 gap-2">
                        <div>
                          <label for="cart-customer-phone" class="block text-[11px] font-bold text-slate-700 mb-1">WhatsApp / Telefone *</label>
                          <input 
                            id="cart-customer-phone"
                            type="text" 
                            [value]="customerPhone()" 
                            (input)="customerPhone.set($any($event.target).value)" 
                            placeholder="(11) 98765-4321" 
                            class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none bg-white">
                        </div>
                        <div>
                          <label for="cart-payment-method" class="block text-[11px] font-bold text-slate-700 mb-1">Forma de Pagamento</label>
                          <select 
                            id="cart-payment-method"
                            [value]="paymentMethod()" 
                            (change)="paymentMethod.set($any($event.target).value)" 
                            class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none bg-white">
                            <option value="PIX">PIX Online</option>
                            <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                            <option value="CARTAO_DEBITO">Cartão de Débito</option>
                            <option value="DINHEIRO">Dinheiro na Entrega</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label for="cart-customer-address" class="block text-[11px] font-bold text-slate-700 mb-1">Endereço de Entrega (ou Retirada no Balcão)</label>
                        <div class="flex gap-1.5">
                          <input 
                            id="cart-customer-address"
                            type="text" 
                            [value]="customerAddress()" 
                            (input)="customerAddress.set($any($event.target).value)" 
                            placeholder="Rua, Número, Bairro ou 'Retirar no local'" 
                            class="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none bg-white">
                          <button
                            type="button"
                            (click)="fillAddressWithGPS()"
                            [disabled]="gpsLoading()"
                            class="px-2.5 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 text-[10px] font-black rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                            title="Preencher usando GPS real">
                            <mat-icon class="text-xs">my_location</mat-icon>
                            <span>{{ gpsLoading() ? 'Lendo...' : 'GPS' }}</span>
                          </button>
                        </div>
                        @if (gpsError()) {
                          <p class="text-[10px] text-rose-600 mt-1 font-semibold leading-tight">{{ gpsError() }}</p>
                        }
                      </div>
                    </div>
                  }
                }
              </div>

              <!-- Drawer Footer -->
              @if (!orderSuccess() && items().length > 0) {
                <div class="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
                  <div class="flex items-center justify-between text-sm">
                    <span class="font-bold text-slate-600">Total do Pedido:</span>
                    <span class="font-black text-slate-900 text-lg font-mono">
                      R$ {{ totalAmount() | number:'1.2-2' }}
                    </span>
                  </div>

                  @if (errorMessage()) {
                    <div class="text-[11px] text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg">
                      {{ errorMessage() }}
                    </div>
                  }

                  <button 
                    (click)="submitOrder()"
                    [disabled]="isSubmitting() || items().length === 0"
                    [style.background-color]="space()?.themeColor || '#4f46e5'"
                    class="w-full py-3.5 px-4 text-white text-xs font-bold rounded-xl shadow-md hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all">
                    @if (isSubmitting()) {
                      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Transmitindo Pedido...</span>
                    } @else {
                      <mat-icon class="text-[18px]">send</mat-icon>
                      <span>Confirmar & Transmitir Pedido</span>
                    }
                  </button>
                </div>
              }

            </div>
          </div>
        </div>
      }
    }
  `
})
export class PublicSpaceCartDrawerComponent implements OnDestroy {
  private http = inject(HttpClient);
  private eventBus = inject(OsEventBusService);
  private cartService = inject(CartService);
  themeService = inject(LinuxThemeService);
  private printerService = inject(PrinterService);
  osState = inject(OsStateService);
  customerIdentity = inject(CustomerIdentityService);
  private router = inject(Router, { optional: true });

  isWindowMode = computed(() => {
    if (typeof window !== 'undefined' && window.location) {
      return !window.location.pathname.startsWith('/p/');
    }
    return true;
  });

  space = this.cartService.space;
  items = this.cartService.items;
  isOpen = signal<boolean>(false);
  customerName = signal<string>(this.customerIdentity.currentCustomer()?.name || '');
  customerPhone = signal<string>(this.customerIdentity.currentCustomer()?.phone || '');
  customerAddress = signal<string>('');
  paymentMethod = signal<string>('PIX');
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  orderSuccess = signal<boolean>(false);
  orderSuccessId = signal<string>('');
  orderStatus = signal<string>('PENDING');

  gpsLoading = signal<boolean>(false);
  gpsError = signal<string | null>(null);

  fillAddressWithGPS() {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      this.gpsLoading.set(true);
      this.gpsError.set(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          
          this.http.get<NominatimResponse>(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`).subscribe({
            next: (data) => {
              this.gpsLoading.set(false);
              if (data && data.display_name) {
                this.customerAddress.set(data.display_name);
              } else {
                this.customerAddress.set(`Coordenadas GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
              }
            },
            error: () => {
              this.gpsLoading.set(false);
              this.customerAddress.set(`Coordenadas GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            }
          });
        },
        (err) => {
          this.gpsLoading.set(false);
          console.error(err);
          this.gpsError.set('Acesso ao GPS negado ou sinal indisponível.');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      this.gpsError.set('Navegador sem suporte a GPS.');
    }
  }

  private pollSubscription?: Subscription;

  ngOnDestroy() {
    this.stopPolling();
  }

  getStepperProgressPercent(): number {
    const s = this.orderStatus();
    switch (s) {
      case 'PENDING': return 0;
      case 'PREPARING': return 33;
      case 'READY':
      case 'DELIVERING': return 66;
      case 'COMPLETED': return 100;
      default: return 0;
    }
  }

  isStepActive(step: string): boolean {
    const current = this.orderStatus();
    if (step === 'PENDING' && current === 'PENDING') return true;
    if (step === 'PREPARING' && current === 'PREPARING') return true;
    if (step === 'READY' && (current === 'READY' || current === 'DELIVERING')) return true;
    if (step === 'COMPLETED' && current === 'COMPLETED') return true;
    return false;
  }

  isStepDone(step: string): boolean {
    const current = this.orderStatus();
    const sequence = ['PENDING', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED'];
    const currentIndex = sequence.indexOf(current === 'DELIVERING' ? 'READY' : current);
    const stepIndex = sequence.indexOf(step);
    return currentIndex > stepIndex;
  }

  private startPolling(orderId: string) {
    this.stopPolling();
    this.orderStatus.set('PENDING');
    
    this.pollSubscription = interval(4000).subscribe(() => {
      this.http.get<{ success: boolean; order?: { status: string } }>(`/api/v1/public-space/orders/${orderId}`).subscribe({
        next: (res) => {
          if (res?.order?.status) {
            this.orderStatus.set(res.order.status);
            if (res.order.status === 'COMPLETED') {
              this.stopPolling();
            }
          }
        },
        error: (err) => {
          console.warn('Erro ao consultar status do pedido online:', err);
        }
      });
    });
  }

  private stopPolling() {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
      this.pollSubscription = undefined;
    }
  }

  totalItems = computed(() => {
    return this.items().reduce((acc, curr) => acc + curr.quantity, 0);
  });

  totalAmount = computed(() => {
    return this.items().reduce((acc, curr) => acc + (curr.product.price * curr.quantity), 0);
  });

  addToCart(product: PublicProduct) {
    this.cartService.addToCart(product);
    this.isOpen.set(true);
  }

  addSampleItem(name: string, price: number, desc: string) {
    this.cartService.addToCart({ name, price, desc });
  }

  increaseQty(item: CartItem) {
    this.items.update(curr => curr.map(i => i.product.name === item.product.name ? { ...i, quantity: i.quantity + 1 } : i));
  }

  decreaseQty(item: CartItem) {
    this.items.update(curr => {
      const found = curr.find(i => i.product.name === item.product.name);
      if (found && found.quantity > 1) {
        return curr.map(i => i.product.name === item.product.name ? { ...i, quantity: i.quantity - 1 } : i);
      } else {
        return curr.filter(i => i.product.name !== item.product.name);
      }
    });
  }

  printReceipt() {
    const itemsList = this.items();
    if (itemsList.length === 0) return;

    const itemsFormatted = itemsList
      .map(i => `${i.quantity}x ${i.product.name.slice(0, 20).padEnd(20, ' ')} R$ ${(i.product.price * i.quantity).toFixed(2)}`)
      .join('\n');

    const companyName = this.space()?.title || this.osState.company().name || '3EATCRU OS';
    const content = `
========================================
       ${companyName.toUpperCase()}
       COMANDA & CUPOM DE BALCAO
========================================
Data: ${new Date().toLocaleString('pt-BR')}
Cliente: ${this.customerName() || 'Consumidor Balcão'}
Telefone: ${this.customerPhone() || '(Balcão)'}
Local: ${this.customerAddress() || 'Retirada no Balcão'}
Forma Pgto: ${this.paymentMethod()}
----------------------------------------
ITENS LANÇADOS:
${itemsFormatted}
----------------------------------------
TOTAL GERAL: R$ ${this.totalAmount().toFixed(2)}
========================================
  TRANSMITIDO AO KDS & COZINHA DO OS
========================================
    `;

    this.printerService.print(`Comanda Balcão - ${this.customerName() || 'Mesa/Balcão'}`, content)
      .then(() => {
        // print dispatched
      })
      .catch(err => {
        console.warn('Falha na impressão da comanda:', err);
      });
  }

  async submitOrder() {
    if (!this.customerName().trim()) {
      this.errorMessage.set('Por favor, informe o seu nome para identificação.');
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const companyId = this.space()?.companyId || this.osState.company().id || 'company_1';
    const customerAccountId = this.customerIdentity.currentCustomer()?.id;

    const payload = {
      companyId,
      customerAccountId,
      customerName: this.customerName(),
      customerPhone: this.customerPhone(),
      customerAddress: this.customerAddress() || 'Retirada no Balcão',
      paymentMethod: this.paymentMethod(),
      items: this.items().map(i => ({
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity
      }))
    };

    this.http.post<{ success: boolean; orderId: string; order: unknown }>('/api/v1/public-space/orders', payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.orderSuccess.set(true);
        this.orderSuccessId.set(res.orderId);

        this.startPolling(res.orderId);

        // Auto-print receipt on order dispatch
        this.printReceipt();

        // Disparar evento no barramento de eventos do Kernel
        this.eventBus.publish('marketplace.order_created', {
          orderId: res.orderId,
          companyId,
          customerAccountId,
          customerName: this.customerName(),
          customerPhone: this.customerPhone(),
          total: this.totalAmount(),
          items: this.items(),
          channel: 'PUBLIC_SPACE'
        }, 'app_public_space');

        // Se autenticado no 3ID, atualiza saldo de pontos e histórico imediatamente
        if (customerAccountId) {
          void this.customerIdentity.fetchMe();
          void this.customerIdentity.fetchActivity();
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.error || 'Erro de comunicação ao enviar pedido. Tente novamente.');
      }
    });
  }

  resetOrder() {
    this.stopPolling();
    this.items.set([]);
    this.orderSuccess.set(false);
    this.orderSuccessId.set('');
    this.orderStatus.set('PENDING');
    this.errorMessage.set(null);
  }
}
