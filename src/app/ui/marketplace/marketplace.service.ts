import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MarketplaceListingItem } from './components/marketplace-listing-card.component';

@Injectable({
  providedIn: 'root'
})
export class MarketplaceService {
  private http = inject(HttpClient);

  getListings(): Observable<MarketplaceListingItem[]> {
    return this.http.get<MarketplaceListingItem[]>('/api/v1/marketplace/listings');
  }
}
