import { Component, ChangeDetectionStrategy, input, output, effect, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { animate } from 'motion';

export interface ListingCapabilities {
  delivery: boolean;
  pickup: boolean;
  booking: boolean;
}

export interface MarketplaceListingItem {
  companyId: string;
  companySlug: string;
  title: string;
  description: string;
  logo: string;
  templateId: string;
  status: string;
  category: 'Restaurantes' | 'Varejo' | 'Serviços' | 'Outros';
  subCategory: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  coordinates: { lat: number; lng: number };
  capabilities: ListingCapabilities;
  rating: number;
  deliveryTimeMin: string;
  deliveryFee: number;
  productsCount: number;
  calculatedDistance: number;
  isOpen?: boolean;
}

@Component({
  selector: 'app-marketplace-listing-card',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="desk-paper-sheet p-6 shadow-md hover:shadow-2xl hover:-translate-y-1 hover:rotate-[0.25deg] transition-all duration-200 flex flex-col justify-between border border-amber-900/25 relative group text-stone-900 select-none">
      
      <!-- Top Paperclip & Slotted Brass Screw Accents -->
      <div class="absolute -top-3.5 left-8 flex items-center gap-1.5 z-10 pointer-events-none">
        <div class="desk-paperclip"></div>
      </div>
      
      <!-- Save to Bureau Bookmark Pin Button -->
      <button 
        type="button"
        (click)="toggleSave.emit(); $event.stopPropagation()"
        class="absolute top-2.5 right-8 text-amber-800 hover:text-amber-950 transition-transform active:scale-90 p-1 cursor-pointer"
        [title]="isSaved() ? 'Remover dos favoritos da gaveta' : 'Salvar no fichário da gaveta'">
        <mat-icon class="text-base" [class.text-amber-600]="isSaved()">{{ isSaved() ? 'bookmark' : 'bookmark_border' }}</mat-icon>
      </button>

      <div class="absolute top-2.5 right-2.5 desk-brass-screw"></div>

      <!-- Card Top: Logo, Category Stamp, Title & Rating -->
      <div class="space-y-3.5 pt-1">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="relative">
              <img 
                [src]="item().logo" 
                [alt]="item().title"
                referrerpolicy="no-referrer"
                (error)="$any($event.target).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150'"
                class="w-13 h-13 rounded-xl object-cover border border-amber-300/60 shadow-sm shrink-0 bg-stone-100">
              @if (item().rating >= 4.7) {
                <span class="absolute -bottom-1 -right-1 desk-wax-seal text-[9px]" title="Selo Oficial de Qualidade 3eatcru">★</span>
              }
            </div>

            <div>
              <div class="flex items-center gap-1.5">
                <span class="desk-stamp-badge desk-stamp-official text-[8px] py-0.5 px-1.5 font-mono">
                  {{ item().category }}
                </span>
                <span class="text-[9px] font-mono text-stone-400 tabular-nums">FICHA #{{ item().companyId.slice(-4).toUpperCase() }}</span>
              </div>
              <h4 class="font-black text-stone-900 font-serif tracking-tight leading-snug mt-1 text-base group-hover:text-amber-800 transition-colors">
                {{ item().title }}
              </h4>
              <p class="text-[11px] text-stone-500 font-mono">{{ item().subCategory }}</p>
            </div>
          </div>
          
          <!-- Rating Brass Plaque -->
          <div class="flex items-center gap-1 bg-[#f5ecd7] border border-amber-600/30 text-amber-950 px-2 py-1 rounded-lg text-xs font-bold shrink-0 shadow-xs font-mono tabular-nums">
            <mat-icon class="text-xs text-amber-600">star</mat-icon>
            <span>{{ item().rating.toFixed(1) }}</span>
          </div>
        </div>

        <!-- Description -->
        <p class="text-xs text-stone-600 line-clamp-2 leading-relaxed font-sans">
          {{ item().description }}
        </p>

        <!-- Location & Distance Stamp (Parchment Docket Box) -->
        <div class="bg-[#f6efe1] rounded-xl p-3 space-y-1.5 text-xs border border-amber-600/25 font-sans shadow-inner">
          <div class="flex items-center gap-1.5 text-stone-800 font-medium">
            <mat-icon class="text-xs text-amber-800">location_on</mat-icon>
            <span class="truncate">{{ item().address }}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-stone-500 font-mono font-bold uppercase tracking-wider pl-4 pt-0.5 border-t border-amber-900/10">
            <span>Distância: <strong class="text-amber-950 font-black tabular-nums">{{ item().calculatedDistance.toFixed(1) }} km</strong></span>
            <span class="flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full" [class]="item().isOpen ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'"></span>
              <strong [class]="item().isOpen ? 'text-emerald-800' : 'text-rose-800'">
                {{ item().isOpen ? 'Aberto Agora' : 'Fechado' }}
              </strong>
            </span>
          </div>
        </div>

        <!-- Capabilities Indicators as Manila Shipping Tags -->
        <div class="flex flex-wrap gap-2 pt-1">
          @if (item().capabilities.delivery) {
            <span class="desk-shipping-tag inline-flex items-center gap-1 pl-4 pr-2 py-0.5 text-[9px] font-bold text-emerald-900 font-mono">
              <mat-icon class="text-xs text-emerald-700">delivery_dining</mat-icon> Entrega
            </span>
          }
          @if (item().capabilities.pickup) {
            <span class="desk-shipping-tag inline-flex items-center gap-1 pl-4 pr-2 py-0.5 text-[9px] font-bold text-amber-950 font-mono">
              <mat-icon class="text-xs text-amber-800">storefront</mat-icon> Balcão
            </span>
          }
          @if (item().capabilities.booking) {
            <span class="desk-shipping-tag inline-flex items-center gap-1 pl-4 pr-2 py-0.5 text-[9px] font-bold text-stone-800 font-mono">
              <mat-icon class="text-xs text-stone-700">calendar_today</mat-icon> Reserva
            </span>
          }
        </div>
      </div>

      <!-- Action Buttons (DEsk Dual Brass Tactile Controls) -->
      <div class="pt-4 mt-4 border-t border-stone-200/80 grid grid-cols-2 gap-2">
        <button 
          type="button"
          (click)="inspect.emit(item())"
          class="flex items-center justify-center gap-1 bg-[#efe4cc] hover:bg-[#e6d8ba] border border-amber-700/30 text-amber-950 text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer font-serif shadow-xs">
          <mat-icon class="text-xs">description</mat-icon>
          <span>Examinar</span>
        </button>

        <a 
          [routerLink]="['/public', item().companySlug]" 
          class="flex items-center justify-center gap-1 desk-brass-button text-xs py-2 rounded-lg shadow font-serif group-hover:scale-[1.01] active:scale-[0.99] transition-all">
          <span>Abrir Vitrine</span>
          <mat-icon class="text-xs">arrow_forward</mat-icon>
        </a>
      </div>

    </div>
  `
})
export class MarketplaceListingCardComponent {
  item = input.required<MarketplaceListingItem>();
  isSaved = input<boolean>(false);
  toggleSave = output<void>();
  inspect = output<MarketplaceListingItem>();
  el = inject(ElementRef);

  constructor() {
    effect(() => {
      animate(this.el.nativeElement, {
        opacity: [0, 1],
        y: [20, 0],
        scale: [0.95, 1]
      }, {
        duration: 0.4,
        ease: "easeOut"
      });
    });
  }
}
