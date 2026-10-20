import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { PublicProduct, PublicSpaceData } from './restaurant-template.component';

@Component({
  selector: 'app-retail-template',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="animate-fade-in">
      <!-- Retail Hero Banner -->
      <section class="desk-wood-panel py-20 px-6 rounded-2xl shadow-xl">
        <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div class="space-y-6 text-left">
            <span class="text-xs font-bold uppercase tracking-widest text-amber-500">Novidades da Estação</span>
            <h2 class="text-4xl sm:text-5xl font-black tracking-tight text-stone-50 leading-none">{{ space().title }}</h2>
            <p class="text-sm sm:text-base text-stone-300 leading-relaxed">{{ space().description }}</p>
            <div class="pt-2">
              <a href="#produtos" [style.background-color]="space().themeColor" class="inline-flex items-center gap-2 px-6 py-3.5 text-xs font-bold text-white rounded-xl shadow-md">
                Ver Vitrine de Produtos
                <mat-icon>shopping_bag</mat-icon>
              </a>
            </div>
          </div>
          <div class="relative">
            <div class="rounded-2xl overflow-hidden aspect-[4/3] shadow-lg">
              <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=600" alt="Loja" class="w-full h-full object-cover">
            </div>
          </div>
        </div>
      </section>

      <!-- Featured Products Vitrine -->
      <section id="produtos" class="py-20 px-6 desk-wood-bg">
        <div class="max-w-6xl mx-auto space-y-12">
          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div class="space-y-1 desk-paper-sheet p-6 shadow-none">
              <span class="text-xs font-bold uppercase tracking-widest" [style.color]="space().themeColor">Nossos Destaques</span>
              <h3 class="text-2xl sm:text-3xl font-black text-stone-950 tracking-tight">Vitrine Comercial</h3>
            </div>
            <span class="text-xs text-stone-500 font-medium">Confira nossos lançamentos exclusivos e promoções</span>
          </div>

          <!-- Vitrine Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            @for (prod of space().products; track prod.name) {
              <div class="desk-paper-sheet p-0 flex flex-col hover:scale-[1.01] transition-transform">
                <div class="aspect-square bg-stone-100/50 relative flex items-center justify-center p-8">
                  <mat-icon class="text-stone-300 text-6xl w-auto h-auto">shopping_bag</mat-icon>
                </div>
                <div class="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div class="space-y-1">
                    <h4 class="font-bold text-stone-950 text-sm">{{ prod.name }}</h4>
                    <p class="text-xs text-stone-600 line-clamp-2 leading-relaxed">{{ prod.desc }}</p>
                  </div>
                  <div class="flex items-center justify-between pt-4 border-t border-stone-200">
                    <span class="text-sm font-bold text-stone-950">R$ {{ prod.price | number:'1.2-2' }}</span>
                    <button 
                      (click)="onAdd(prod)"
                      [style.background-color]="space().themeColor || '#4f46e5'"
                      class="px-3 py-1.5 rounded-lg text-white font-bold text-xs flex items-center gap-1 shadow-inner hover:opacity-90 active:scale-95 transition-all cursor-pointer">
                      <mat-icon class="text-[14px]">add_shopping_cart</mat-icon>
                      Comprar
                    </button>
                  </div>
                </div>
              </div>
            }
            @if (space().products.length === 0) {
              <p class="text-sm text-stone-400 text-center col-span-3 py-12">Nenhum produto publicado na vitrine ainda.</p>
            }
          </div>
        </div>
      </section>
    </div>
  `
})
export class RetailTemplateComponent {
  space = input.required<PublicSpaceData>();
  addToCart = output<PublicProduct>();

  onAdd(prod: PublicProduct) {
    this.addToCart.emit(prod);
  }
}

