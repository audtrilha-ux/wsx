import { Component, ChangeDetectionStrategy, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';

export interface LocationPreset {
  name: string;
  lat: number;
  lng: number;
}

interface NominatimSearchResult {
  display_name?: string;
  lat: string;
  lon: string;
}

@Component({
  selector: 'app-marketplace-filters',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="space-y-6 select-none font-sans">
      <!-- Geolocation & Radius Panel (Styled like a Brass-Fitted Navigator Box) -->
      <div class="desk-paper-sheet p-5 space-y-4 shadow-lg border border-amber-900/20 text-stone-900">
        <div class="flex items-center gap-2 mb-2 text-stone-900 border-b border-stone-200 pb-2">
          <mat-icon class="text-amber-800">explore</mat-icon>
          <h3 class="font-bold text-sm tracking-tight font-serif">Bússola & Localização</h3>
        </div>
        
        <p class="text-xs text-stone-600 leading-relaxed font-sans">
          Defina o ponto de referência para medir a distância em quilômetros reais de cada balcão comercial:
        </p>

        <!-- Current Active Location Panel -->
        <div class="p-3 bg-[#f6efe1] border border-amber-600/30 rounded-xl">
          <span class="block text-[10px] uppercase font-bold text-amber-900 mb-1 leading-none font-mono">Ponto Geográfico</span>
          <div class="flex items-start gap-1.5 text-xs text-stone-800 font-semibold leading-tight font-sans">
            <mat-icon class="text-amber-800 text-sm mt-0.5 shrink-0">my_location</mat-icon>
            <span class="break-words">{{ selectedLocation().name }}</span>
          </div>
        </div>

        <!-- Real GPS Location Button -->
        <button 
          type="button"
          (click)="useRealGeolocation()"
          [disabled]="gpsLoading()"
          class="w-full text-center text-xs px-3 py-2.5 desk-brass-button disabled:opacity-50 font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow">
          <mat-icon class="text-sm">my_location</mat-icon>
          <span>{{ gpsLoading() ? 'Obtendo GPS...' : 'Usar Sinal de GPS Real' }}</span>
        </button>
        @if (gpsError()) {
          <p class="text-[10px] text-rose-800 font-semibold leading-tight text-center bg-rose-50 border border-rose-200 p-2 rounded-lg">{{ gpsError() }}</p>
        }
        
        <!-- Address search form -->
        <div class="space-y-2 pt-2 border-t border-stone-200">
          <label for="address-search-input" class="block text-[11px] font-bold text-stone-700 font-serif">Buscar Endereço no Mapa</label>
          <div class="flex gap-1.5">
            <input 
              id="address-search-input"
              type="text" 
              #addrInput
              (keyup.enter)="searchAddress(addrInput.value)"
              placeholder="Rua, Bairro, Cidade..." 
              class="flex-1 px-3 py-2 text-xs border border-stone-300 rounded-xl focus:border-amber-600 focus:outline-none bg-white text-stone-900 shadow-inner">
            <button
              type="button"
              (click)="searchAddress(addrInput.value)"
              [disabled]="searchLoading()"
              class="px-3 py-2 border border-stone-300 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 text-[10px] font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
              title="Buscar coordenadas do endereço">
              <mat-icon class="text-xs">search</mat-icon>
              <span>{{ searchLoading() ? '...' : 'Buscar' }}</span>
            </button>
          </div>
          @if (searchError()) {
            <p class="text-[10px] text-rose-800 mt-1 font-semibold leading-tight bg-rose-50 p-1.5 rounded">{{ searchError() }}</p>
          }
        </div>

        <!-- Distance Range Slider -->
        <div class="pt-3 border-t border-stone-200">
          <div class="flex justify-between items-center text-xs mb-1.5 font-semibold text-stone-700 font-serif">
            <label for="distance-slider">Raio Máximo:</label>
            <span class="text-amber-900 font-bold font-mono tabular-nums">{{ maxDistance() }} km</span>
          </div>
          <input 
            id="distance-slider"
            type="range" 
            min="1" 
            max="30" 
            [value]="maxDistance()"
            (input)="onDistanceInput($event)"
            class="w-full accent-amber-600 cursor-pointer">
          <div class="flex justify-between text-[10px] text-stone-500 font-mono font-bold">
            <span>1 km</span>
            <span>15 km</span>
            <span>30 km</span>
          </div>
        </div>
      </div>

      <!-- Capabilities & Operating filters -->
      <div class="desk-paper-sheet p-5 space-y-4 shadow-lg border border-amber-900/20 text-stone-900">
        <div class="flex items-center gap-2 mb-2 text-stone-900 border-b border-stone-200 pb-2">
          <mat-icon class="text-amber-800">tune</mat-icon>
          <h3 class="font-bold text-sm tracking-tight font-serif">Modalidades do Balcão</h3>
        </div>

        <div class="space-y-3 font-sans">
          <!-- Delivery Checkbox -->
          <label class="flex items-center gap-3 text-xs text-stone-700 hover:text-stone-950 cursor-pointer select-none">
            <input 
              type="checkbox" 
              [checked]="filterDelivery()"
              (change)="onDeliveryChange($event)"
              class="rounded border-stone-300 text-amber-700 focus:ring-amber-500 w-4 h-4 cursor-pointer">
            <span class="flex items-center gap-1.5 font-medium">
              <mat-icon class="text-xs text-amber-800">delivery_dining</mat-icon>
              Suporta Entrega (Delivery)
            </span>
          </label>

          <!-- Pickup Checkbox -->
          <label class="flex items-center gap-3 text-xs text-stone-700 hover:text-stone-950 cursor-pointer select-none">
            <input 
              type="checkbox" 
              [checked]="filterPickup()"
              (change)="onPickupChange($event)"
              class="rounded border-stone-300 text-amber-700 focus:ring-amber-500 w-4 h-4 cursor-pointer">
            <span class="flex items-center gap-1.5 font-medium">
              <mat-icon class="text-xs text-amber-800">storefront</mat-icon>
              Suporta Retirada no Balcão
            </span>
          </label>

          <!-- Booking Checkbox -->
          <label class="flex items-center gap-3 text-xs text-stone-700 hover:text-stone-950 cursor-pointer select-none">
            <input 
              type="checkbox" 
              [checked]="filterBooking()"
              (change)="onBookingChange($event)"
              class="rounded border-stone-300 text-amber-700 focus:ring-amber-500 w-4 h-4 cursor-pointer">
            <span class="flex items-center gap-1.5 font-medium">
              <mat-icon class="text-xs text-amber-800">calendar_today</mat-icon>
              Aceita Agendamento de Mesa / Horário
            </span>
          </label>

          <!-- Open Now Checkbox -->
          <label class="flex items-center gap-3 text-xs text-stone-700 hover:text-stone-950 cursor-pointer select-none pt-2 border-t border-stone-200">
            <input 
              type="checkbox" 
              [checked]="filterOpenNow()"
              (change)="onOpenNowChange($event)"
              class="rounded border-stone-300 text-amber-700 focus:ring-amber-500 w-4 h-4 cursor-pointer">
            <span class="flex items-center gap-1.5 font-medium">
              <mat-icon class="text-xs text-emerald-700">schedule</mat-icon>
              Aberto Agora (Funcionamento Ativo)
            </span>
          </label>
        </div>
      </div>
    </aside>
  `
})
export class MarketplaceFiltersComponent {
  private http = inject(HttpClient);

  selectedLocation = input.required<LocationPreset>();
  maxDistance = input.required<number>();
  filterDelivery = input.required<boolean>();
  filterPickup = input.required<boolean>();
  filterBooking = input.required<boolean>();
  filterOpenNow = input.required<boolean>();

  locationChange = output<LocationPreset>();
  maxDistanceChange = output<number>();
  filterDeliveryChange = output<boolean>();
  filterPickupChange = output<boolean>();
  filterBookingChange = output<boolean>();
  filterOpenNowChange = output<boolean>();

  gpsLoading = signal<boolean>(false);
  gpsError = signal<string | null>(null);

  searchLoading = signal<boolean>(false);
  searchError = signal<string | null>(null);

  searchAddress(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      this.searchError.set('Digite um endereço para buscar.');
      return;
    }

    this.searchLoading.set(true);
    this.searchError.set(null);

    this.http.get<NominatimSearchResult[]>(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1`).subscribe({
      next: (results) => {
        this.searchLoading.set(false);
        if (results && results.length > 0) {
          const first = results[0];
          const loc: LocationPreset = {
            name: first.display_name || trimmed,
            lat: parseFloat(first.lat),
            lng: parseFloat(first.lon)
          };
          this.locationChange.emit(loc);
        } else {
          this.searchError.set('Nenhum local encontrado para este endereço.');
        }
      },
      error: () => {
        this.searchLoading.set(false);
        this.searchError.set('Erro ao buscar endereço. Verifique sua conexão.');
      }
    });
  }

  useRealGeolocation() {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      this.gpsLoading.set(true);
      this.gpsError.set(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.gpsLoading.set(false);
          const loc: LocationPreset = {
            name: 'Minha Localização (GPS Real)',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          this.locationChange.emit(loc);
        },
        (err) => {
          this.gpsLoading.set(false);
          console.error(err);
          this.gpsError.set('Acesso ao GPS negado ou sinal indisponível.');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      this.gpsError.set('GPS não suportado.');
    }
  }

  onDistanceInput(event: Event) {
    this.maxDistanceChange.emit(Number((event.target as HTMLInputElement).value));
  }

  onDeliveryChange(event: Event) {
    this.filterDeliveryChange.emit((event.target as HTMLInputElement).checked);
  }

  onPickupChange(event: Event) {
    this.filterPickupChange.emit((event.target as HTMLInputElement).checked);
  }

  onBookingChange(event: Event) {
    this.filterBookingChange.emit((event.target as HTMLInputElement).checked);
  }

  onOpenNowChange(event: Event) {
    this.filterOpenNowChange.emit((event.target as HTMLInputElement).checked);
  }
}
