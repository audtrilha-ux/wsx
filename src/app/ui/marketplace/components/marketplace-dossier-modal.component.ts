import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MarketplaceListingItem } from './marketplace-listing-card.component';

@Component({
  selector: 'app-marketplace-dossier-modal',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
      
      <!-- Backdrop Click to Close -->
      <button 
        (click)="closeDossier.emit()" 
        class="fixed inset-0 w-full h-full bg-transparent border-none cursor-default" 
        aria-label="Fechar Prancheta de Inspeção" 
        type="button"></button>

      <!-- Tactile Manila Dossier Folder -->
      <div class="relative w-full max-w-2xl bg-[#f7f1e5] border-2 border-amber-900/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-stone-900 z-10 animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Folder Tab Header with Brass Hardware -->
        <div class="bg-gradient-to-r from-[#2c1d13] via-[#3a2719] to-[#2c1d13] text-amber-100 px-6 py-4 flex items-center justify-between border-b border-amber-900/50 shadow-md">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl desk-brass-plate flex items-center justify-center text-amber-950 font-bold border border-amber-300/40 shadow-xs">
              <mat-icon class="text-xl">folder_shared</mat-icon>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-mono uppercase font-bold text-amber-300/80">PRANCHETA DE INSPEÇÃO PÚBLICA</span>
                <span class="desk-stamp-badge desk-stamp-official text-[8px] py-0.5 px-1.5 font-mono">
                  #{{ item().companyId.slice(-6).toUpperCase() }}
                </span>
              </div>
              <h3 class="font-serif font-black text-lg text-amber-50 leading-tight">
                {{ item().title }}
              </h3>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Bookmark Button -->
            <button 
              type="button"
              (click)="toggleSave.emit()"
              class="p-2 text-amber-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              [title]="isSaved() ? 'Salvo na gaveta' : 'Salvar no fichário da gaveta'">
              <mat-icon class="text-lg">{{ isSaved() ? 'bookmark' : 'bookmark_border' }}</mat-icon>
            </button>

            <!-- Close Button -->
            <button 
              type="button"
              (click)="closeDossier.emit()"
              class="p-2 text-amber-300/80 hover:text-amber-100 rounded-lg hover:bg-amber-950/60 transition-colors cursor-pointer"
              aria-label="Fechar">
              <mat-icon class="text-xl">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Dossier Content Body -->
        <div class="p-6 overflow-y-auto max-h-[75vh] space-y-5 font-sans">
          
          <!-- Top Profile Sheet -->
          <div class="flex flex-col sm:flex-row gap-5 items-start bg-[#fcfaf5] p-4 rounded-xl border border-amber-800/20 shadow-xs">
            <div class="relative shrink-0">
              <img 
                [src]="item().logo" 
                [alt]="item().title"
                referrerpolicy="no-referrer"
                (error)="$any($event.target).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150'"
                class="w-20 h-20 rounded-xl object-cover border border-amber-400/50 shadow-md bg-stone-200">
              @if (item().rating >= 4.7) {
                <span class="absolute -bottom-1 -right-1 desk-wax-seal text-xs" title="Selo Oficial de Qualidade 3eatcru">★</span>
              }
            </div>

            <div class="space-y-1.5 flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="desk-stamp-badge desk-stamp-official text-[9px] py-0.5 px-2 font-mono">
                  {{ item().category }} · {{ item().subCategory }}
                </span>
                <div class="flex items-center gap-1 bg-[#f5ecd7] border border-amber-600/30 text-amber-950 px-2 py-0.5 rounded text-xs font-bold font-mono tabular-nums">
                  <mat-icon class="text-xs text-amber-600">star</mat-icon>
                  <span>{{ item().rating.toFixed(1) }}</span>
                </div>
              </div>
              
              <p class="text-xs text-stone-700 leading-relaxed font-sans pt-1">
                {{ item().description }}
              </p>
            </div>
          </div>

          <!-- Geolocation, Address & Working Hours -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="bg-[#fcfaf5] p-3.5 rounded-xl border border-amber-800/15 space-y-1">
              <span class="text-[10px] font-mono uppercase font-bold text-amber-900 flex items-center gap-1">
                <mat-icon class="text-xs text-amber-800">location_on</mat-icon> Endereço & Distância
              </span>
              <p class="text-xs font-medium text-stone-800">{{ item().address }}</p>
              <p class="text-[11px] text-stone-500 font-mono">
                Distância real: <strong class="text-amber-950 font-black tabular-nums">{{ item().calculatedDistance.toFixed(1) }} km</strong>
              </p>
            </div>

            <div class="bg-[#fcfaf5] p-3.5 rounded-xl border border-amber-800/15 space-y-1">
              <span class="text-[10px] font-mono uppercase font-bold text-amber-900 flex items-center gap-1">
                <mat-icon class="text-xs text-amber-800">schedule</mat-icon> Expediente & Status
              </span>
              <p class="text-xs font-medium text-stone-800">{{ item().hours }}</p>
              <div class="flex items-center gap-1.5 pt-0.5">
                <span class="w-2 h-2 rounded-full" [class]="item().isOpen ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'"></span>
                <span class="text-xs font-bold font-mono" [class]="item().isOpen ? 'text-emerald-800' : 'text-rose-800'">
                  {{ item().isOpen ? 'Aberto Agora para Atendimento' : 'Fechado no Momento' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Capabilities Tags -->
          <div class="flex flex-wrap gap-2 pt-1 border-t border-amber-900/10">
            @if (item().capabilities.delivery) {
              <span class="desk-shipping-tag inline-flex items-center gap-1 pl-4 pr-3 py-1 text-xs font-bold text-emerald-900 font-mono">
                <mat-icon class="text-sm text-emerald-700">delivery_dining</mat-icon>
                Entrega Rápida ({{ item().deliveryTimeMin || '30-45 min' }})
              </span>
            }
            @if (item().capabilities.pickup) {
              <span class="desk-shipping-tag inline-flex items-center gap-1 pl-4 pr-3 py-1 text-xs font-bold text-amber-950 font-mono">
                <mat-icon class="text-sm text-amber-800">storefront</mat-icon>
                Retirada no Balcão
              </span>
            }
            @if (item().capabilities.booking) {
              <span class="desk-shipping-tag inline-flex items-center gap-1 pl-4 pr-3 py-1 text-xs font-bold text-stone-800 font-mono">
                <mat-icon class="text-sm text-stone-700">calendar_today</mat-icon>
                Agendamento de Horário & Reservas
              </span>
            }
          </div>

          <!-- Direct Phone / Contact Bar -->
          @if (item().phone) {
            <div class="bg-[#f5eedc] p-3 rounded-xl border border-amber-700/25 flex items-center justify-between text-xs">
              <span class="flex items-center gap-1.5 font-semibold text-stone-800">
                <mat-icon class="text-xs text-amber-800">call</mat-icon> Contato Direto: {{ item().phone }}
              </span>
              <a 
                [href]="'tel:' + item().phone" 
                class="text-[11px] font-bold text-amber-900 hover:text-amber-950 underline font-mono">
                Ligar para o Balcão
              </a>
            </div>
          }

        </div>

        <!-- Footer Actions Bar (Brass Screws & Buttons) -->
        <div class="bg-[#ede4d1] px-6 py-4 border-t border-amber-900/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button 
            type="button"
            (click)="closeDossier.emit()" 
            class="text-xs text-stone-700 hover:text-stone-900 font-serif font-bold transition-colors">
            ← Voltar ao Fichário
          </button>

          <a 
            [routerLink]="['/public', item().companySlug]" 
            (click)="closeDossier.emit()"
            class="w-full sm:w-auto px-6 py-2.5 desk-brass-button text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 font-serif">
            <span>Acessar Vitrine & Fazer Pedido</span>
            <mat-icon class="text-sm">arrow_forward</mat-icon>
          </a>
        </div>

      </div>
    </div>
  `
})
export class MarketplaceDossierModalComponent {
  item = input.required<MarketplaceListingItem>();
  isSaved = input<boolean>(false);
  toggleSave = output<void>();
  closeDossier = output<void>();
}
