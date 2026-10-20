import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { PublicSpaceData, PublicProduct } from './restaurant-template.component';

@Component({
  selector: 'app-business-template',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="animate-fade-in">
      <!-- Corporate Hero -->
      <section class="desk-wood-panel text-white py-24 px-6 relative overflow-hidden">
        <div class="absolute inset-0 opacity-10 bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200')"></div>
        <div class="relative z-10 max-w-5xl mx-auto text-left space-y-6">
          <span class="text-xs font-bold uppercase tracking-widest text-orange-200">Soluções Corporativas</span>
          <h2 class="text-4xl sm:text-6xl font-black tracking-tight leading-none text-white max-w-3xl">{{ space().title }}</h2>
          <p class="text-sm sm:text-base text-orange-100 max-w-2xl leading-relaxed">{{ space().description }}</p>
          <div class="pt-4 flex flex-wrap gap-4">
            <a href="#servicos" [style.background-color]="space().themeColor" class="px-6 py-3.5 text-xs font-bold text-white rounded-xl shadow-md">
              Nossos Serviços
            </a>
            <a href="#contato" class="px-6 py-3.5 text-xs font-bold text-slate-300 border border-slate-700 hover:bg-slate-800 rounded-xl transition-colors">
              Fale com um Especialista
            </a>
          </div>
        </div>
      </section>

      <!-- Core Services Listing -->
      <section id="servicos" class="py-20 px-6 desk-wood-bg">
        <div class="max-w-6xl mx-auto space-y-12">
          <div class="text-center space-y-2 desk-paper-sheet p-6 shadow-none">
            <span class="text-xs font-bold uppercase tracking-widest text-orange-600">Portfólio de Serviços</span>
            <h3 class="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">Nossas Especialidades</h3>
            <p class="text-sm text-stone-600 max-w-md mx-auto">Descubra como podemos ajudar a sua empresa a alcançar resultados extraordinários.</p>
          </div>

          <!-- Services Cards Grid -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            @for (serv of space().products; track serv.name) {
              <div class="desk-paper-sheet p-6 hover:shadow-lg transition-all space-y-4 flex flex-col justify-between">
                <div class="space-y-3">
                  <div class="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-700">
                    <mat-icon>task_alt</mat-icon>
                  </div>
                  <h4 class="font-bold text-stone-900 text-sm">{{ serv.name }}</h4>
                  <p class="text-xs text-stone-600 leading-relaxed">{{ serv.desc }}</p>
                </div>
                <div class="pt-4 border-t border-stone-200/80 flex justify-between items-center text-xs">
                  <div>
                    <span class="text-stone-500 font-semibold block text-[10px]">A partir de</span>
                    <span class="font-mono font-black text-sm text-stone-900">R$ {{ (serv.price || 0) | number:'1.2-2' }}</span>
                  </div>
                  <button 
                    type="button"
                    (click)="onAdd(serv)"
                    [style.background-color]="space().themeColor || '#4f46e5'"
                    class="desk-brass-button px-3.5 py-1.5 rounded-lg text-white font-bold text-xs flex items-center gap-1 shadow-xs hover:opacity-95 active:scale-95 transition-all cursor-pointer">
                    <mat-icon class="text-xs">add_shopping_cart</mat-icon>
                    Contratar
                  </button>
                </div>
              </div>
            }
            @if (space().products.length === 0) {
              <div class="desk-paper-sheet p-8 text-center col-span-3">
                <p class="text-sm text-stone-500">Nenhum serviço corporativo publicado ainda.</p>
              </div>
            }
          </div>
        </div>
      </section>
    </div>
  `
})
export class BusinessTemplateComponent {
  space = input.required<PublicSpaceData>();
  addToCart = output<PublicProduct>();

  onAdd(prod: PublicProduct) {
    this.addToCart.emit(prod);
  }
}
