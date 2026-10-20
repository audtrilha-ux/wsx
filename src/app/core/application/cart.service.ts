import { Injectable, signal } from '@angular/core';
import { PublicSpaceData, PublicProduct } from '../../ui/public-space/components/restaurant-template.component';

export interface CartItem {
  product: PublicProduct;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  readonly space = signal<PublicSpaceData | null>(null);
  readonly items = signal<CartItem[]>([]);

  setSpace(space: PublicSpaceData) {
    this.space.set(space);
  }

  addToCart(product: PublicProduct) {
    this.items.update(curr => {
      const existing = curr.find(i => i.product.name === product.name);
      if (existing) {
        return curr.map(i => i.product.name === product.name ? { ...i, quantity: i.quantity + 1 } : i);
      } else {
        return [...curr, { product, quantity: 1 }];
      }
    });
  }
}
