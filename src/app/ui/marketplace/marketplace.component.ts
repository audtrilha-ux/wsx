import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MarketplaceFiltersComponent, LocationPreset } from './components/marketplace-filters.component';
import { MarketplaceSearchHeaderComponent } from './components/marketplace-search-header.component';
import { MarketplaceListingCardComponent, MarketplaceListingItem } from './components/marketplace-listing-card.component';
import { CustomerAccountModalComponent } from './components/customer-account-modal.component';
import { CustomerIdentityService } from '../../core/identity/customer-identity.service';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceDossierModalComponent } from './components/marketplace-dossier-modal.component';
import { animate, stagger } from 'motion';

import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MarketplaceFiltersComponent,
    MarketplaceSearchHeaderComponent,
    MarketplaceListingCardComponent,
    MarketplaceDossierModalComponent,
    CustomerAccountModalComponent,
    GoogleMap,
    MapAdvancedMarker
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marketplace.component.html'
})
export class MarketplaceComponent implements OnInit, AfterViewInit {
  private marketplaceService = inject(MarketplaceService);
  customerService = inject(CustomerIdentityService);
  private el = inject(ElementRef);

  showCustomerModal = signal<boolean>(false);
  selectedDossier = signal<MarketplaceListingItem | null>(null);

  // Sliding Desk Drawer State ("Gaveta do Balcão")
  drawerOpen = signal<boolean>(false);
  savedCompanyIds = signal<string[]>([]);

  // Raw listings
  listings = signal<MarketplaceListingItem[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Search & Filter State
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('Todos');
  
  // Capabilities Filters
  filterDelivery = signal<boolean>(false);
  filterPickup = signal<boolean>(false);
  filterBooking = signal<boolean>(false);
  filterOpenNow = signal<boolean>(false);

  // Geolocation State (Real Default Location)
  selectedLocation = signal<LocationPreset>({
    name: 'Avenida Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100',
    lat: -23.5616,
    lng: -46.6560
  });
  maxDistance = signal<number>(15); // Default 15 km

  // Google Maps Availability Check
  isGoogleMapsLoaded = computed(() => typeof window !== 'undefined' && !!(window as unknown as { google?: { maps?: unknown } }).google?.maps);

  // DEsk Physical Atmosphere
  lampLit = signal<boolean>(true);
  viewMode = signal<'grid' | 'ledger' | 'map'>('grid');

  ngAfterViewInit() {
    this.animateContent();
  }

  openCustomerAccount(): void {
    this.showCustomerModal.set(true);
  }

  private animateContent() {
    const cards = this.el.nativeElement.querySelectorAll('app-marketplace-listing-card');
    if (cards.length > 0) {
      animate(cards, { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.05), duration: 0.5, ease: 'easeOut' });
    }
  }
  
  toggleLamp(): void {
    this.lampLit.update(v => !v);
  }

  toggleDrawer(): void {
    this.drawerOpen.update(v => !v);
    if(this.drawerOpen()){
        animate('.desk-drawer-handle', { rotate: [0, 10, -10, 0] }, { duration: 0.3 });
    }
  }

  openDossier(item: MarketplaceListingItem): void {
    this.selectedDossier.set(item);
  }

  closeDossier(): void {
    this.selectedDossier.set(null);
  }

  toggleSaveCompany(companyId: string): void {
    this.savedCompanyIds.update(ids => {
      const exists = ids.includes(companyId);
      const updated = exists ? ids.filter(i => i !== companyId) : [...ids, companyId];
      try {
        localStorage.setItem('3eatcru_desk_saved_fichas', JSON.stringify(updated));
      } catch {
        // storage quota fallback
      }
      return updated;
    });
  }

  isCompanySaved(companyId: string): boolean {
    return this.savedCompanyIds().includes(companyId);
  }

  // Sorting
  sortBy = signal<'rating' | 'distance' | 'name'>('rating');

  ngOnInit() {
    this.loadListings();
    try {
      const raw = localStorage.getItem('3eatcru_desk_saved_fichas');
      if (raw) {
        this.savedCompanyIds.set(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }

  loadListings() {
    this.loading.set(true);
    this.error.set(null);
    this.marketplaceService.getListings().subscribe({
      next: (data) => {
        this.listings.set(data);
        this.loading.set(false);
        // Animate after listings are rendered
        setTimeout(() => this.animateContent(), 0);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Erro ao carregar o marketplace do ecossistema. Tente novamente.');
        this.loading.set(false);
      }
    });
  }

  // Calculate Distance in KM using Haversine
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Robust, real-time parser to evaluate if any establishment is open based on hours string (P1)
  parseIsOpen(hoursStr: string): boolean {
    try {
      const currentHour = new Date().getHours();
      const currentDay = new Date().getDay(); // 0 is Sunday, 1 is Monday...
      const normalized = hoursStr.toLowerCase();
      
      let dayOk = false;
      if (normalized.includes('todos os dias') || normalized.includes('diariamente')) {
        dayOk = true;
      } else if (normalized.includes('seg - sex')) {
        dayOk = currentDay >= 1 && currentDay <= 5;
      } else if (normalized.includes('seg - sab')) {
        dayOk = currentDay >= 1 && currentDay <= 6;
      } else {
        dayOk = true; // Fallback for other configurations
      }

      // Extract time range (e.g. "08:00 às 18:00", "09:00 - 18:00", etc.)
      const timeMatch = normalized.match(/(\d{2}):(\d{2})\s*(?:às|as|-)\s*(\d{2}):(\d{2})/);
      if (timeMatch) {
        const startHour = parseInt(timeMatch[1], 10);
        const endHour = parseInt(timeMatch[3], 10);
        return dayOk && currentHour >= startHour && currentHour < endHour;
      }
    } catch (e) {
      console.error('Error parsing working hours:', e);
    }
    return true; // default fallback if unparseable
  }

  // Filtered and Decorated Listings
  filteredListings = computed(() => {
    const raw = this.listings();
    const query = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
    const delivery = this.filterDelivery();
    const pickup = this.filterPickup();
    const booking = this.filterBooking();
    const openNow = this.filterOpenNow();
    const currentLoc = this.selectedLocation();
    const maxDist = this.maxDistance();
    const sort = this.sortBy();

    let result = raw.map(item => {
      const distance = this.calculateDistance(
        currentLoc.lat,
        currentLoc.lng,
        item.coordinates.lat,
        item.coordinates.lng
      );
      // Calculate dynamic opening state
      const isOpen = this.parseIsOpen(item.hours);
      return { ...item, calculatedDistance: distance, isOpen };
    });

    // 1. Category Filter
    if (cat !== 'Todos') {
      result = result.filter(item => item.category === cat);
    }

    // 2. Search Query Filter
    if (query) {
      result = result.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.subCategory.toLowerCase().includes(query) ||
        item.address.toLowerCase().includes(query)
      );
    }

    // 3. Capabilities Filters
    if (delivery) {
      result = result.filter(item => item.capabilities.delivery);
    }
    if (pickup) {
      result = result.filter(item => item.capabilities.pickup);
    }
    if (booking) {
      result = result.filter(item => item.capabilities.booking);
    }

    // 4. Open Now Filter - dynamically evaluated for all (P1)
    if (openNow) {
      result = result.filter(item => item.isOpen);
    }

    // 5. Geolocation Max Distance Filter
    result = result.filter(item => item.calculatedDistance <= maxDist);

    // 6. Sorting
    if (sort === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sort === 'distance') {
      result.sort((a, b) => a.calculatedDistance - b.calculatedDistance);
    } else if (sort === 'name') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  });
}
