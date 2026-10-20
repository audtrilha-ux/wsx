import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface PublicProduct {
  name: string;
  price: number;
  desc: string;
}

export interface PublicSpaceData {
  companyId: string;
  companySlug: string;
  title: string;
  description: string;
  logo: string;
  templateId: 'restaurant' | 'retail' | 'business';
  themeColor: string;
  status: 'draft' | 'preview' | 'published';
  phone: string;
  email: string;
  address: string;
  hours: string;
  products: PublicProduct[];
}

@Component({
  selector: 'app-restaurant-template',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="animate-fade-in">
      <!-- Restaurant Hero -->
      <section class="relative desk-wood-panel text-white py-24 px-6 overflow-hidden">
        <div class="absolute inset-0 opacity-40 bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200')"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40"></div>
        
        <div class="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <span class="text-xs font-bold tracking-widest text-amber-400 uppercase">Experiência Gastronômica Única</span>
          <h2 class="text-4xl sm:text-6xl font-black tracking-tight leading-none text-white">{{ space().title }}</h2>
          <p class="text-base text-stone-200 max-w-2xl mx-auto leading-relaxed">{{ space().description }}</p>
          <div class="pt-4">
            <a href="#cardapio" [style.background-color]="space().themeColor" class="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-white rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">
              Ver Nosso Cardápio
              <mat-icon>restaurant_menu</mat-icon>
            </a>
          </div>
        </div>
      </section>

      <!-- About Segment -->
      <section class="py-16 px-6 max-w-4xl mx-auto">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div class="space-y-4">
            <span class="text-xs font-bold uppercase tracking-widest" [style.color]="space().themeColor">Nossa Cozinha</span>
            <h3 class="text-2xl font-black text-stone-900 tracking-tight">Ingredientes Selecionados & Amor no Preparo</h3>
            <p class="text-sm text-stone-600 leading-relaxed">
              Acreditamos que comer bem é um ato de celebração. Cada prato do nosso cardápio é preparado na hora por chefs experientes, utilizando vegetais orgânicos e carnes de fornecedores locais certificados.
            </p>
          </div>
          <div class="desk-paper-sheet rounded-2xl overflow-hidden aspect-video shadow-md">
            <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=600" alt="Cozinha" class="w-full h-full object-cover">
          </div>
        </div>
      </section>

      <!-- Menu Section -->
      <section id="cardapio" class="py-20 px-6 desk-wood-bg border-t border-stone-800">
        <div class="max-w-5xl mx-auto space-y-12">
          <div class="text-center space-y-2 desk-paper-sheet p-6 shadow-none">
            <span class="text-xs font-bold uppercase tracking-widest" [style.color]="space().themeColor">Cardápio do Dia</span>
            <h3 class="text-3xl font-black text-stone-900 tracking-tight">Pratos & Delícias</h3>
            <p class="text-sm text-stone-600 max-w-md mx-auto">Consulte os preços e detalhes das nossas especialidades da casa.</p>
          </div>

          <!-- Menu Items Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            @for (item of space().products; track item.name) {
              <div class="p-6 desk-paper-sheet flex justify-between items-center gap-4 hover:shadow-lg transition-colors">
                <div class="space-y-1 flex-1">
                  <h4 class="font-bold text-stone-900 text-base">{{ item.name }}</h4>
                  <p class="text-xs text-stone-600 leading-relaxed">{{ item.desc }}</p>
                  <div class="pt-2">
                    <span class="text-base font-black text-stone-900 whitespace-nowrap font-mono">
                      R$ {{ item.price | number:'1.2-2' }}
                    </span>
                  </div>
                </div>
                <button 
                  (click)="onAdd(item)"
                  [style.background-color]="space().themeColor || '#4f46e5'"
                  class="desk-brass-button px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer">
                  <mat-icon class="text-[16px]">add_shopping_cart</mat-icon>
                  Pedir
                </button>
              </div>
            }
            @if (space().products.length === 0) {
              <div class="desk-paper-sheet p-8 text-center col-span-2">
                <p class="text-sm text-stone-500">Nenhum item adicionado ao cardápio público ainda.</p>
              </div>
            }
          </div>
        </div>
      </section>
    </div>
  `
})
export class RestaurantTemplateComponent {
  space = input.required<PublicSpaceData>();
  addToCart = output<PublicProduct>();

  onAdd(prod: PublicProduct) {
    this.addToCart.emit(prod);
  }
}

