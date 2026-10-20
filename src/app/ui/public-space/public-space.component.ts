import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { RestaurantTemplateComponent, PublicSpaceData, PublicProduct } from './components/restaurant-template.component';
import { RetailTemplateComponent } from './components/retail-template.component';
import { BusinessTemplateComponent } from './components/business-template.component';
import { PublicSpaceFooterComponent } from './components/public-space-footer.component';
import { PublicSpaceCartDrawerComponent } from './components/public-space-cart-drawer.component';
import { CartService } from '../../core/application/cart.service';
import { WindowManagerService } from '../../core/application/window-manager.service';

@Component({
  selector: 'app-public-space',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    RestaurantTemplateComponent,
    RetailTemplateComponent,
    BusinessTemplateComponent,
    PublicSpaceFooterComponent,
    PublicSpaceCartDrawerComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-space.component.html'
})
export class PublicSpaceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private cartService = inject(CartService);
  private windowManager = inject(WindowManagerService);



  slug = signal<string>('');
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  data = signal<PublicSpaceData | null>(null);

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const companySlug = params.get('companySlug');
      if (companySlug) {
        this.slug.set(companySlug);
        this.loadPublicSpace(companySlug);
      } else {
        this.error.set('Nenhum identificador de empresa fornecido.');
        this.loading.set(false);
      }
    });
  }

  loadPublicSpace(slug: string) {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<PublicSpaceData>(`/api/v1/public-space/slug/${slug}`).subscribe({
      next: (res) => {
        this.data.set(res);
        this.cartService.setSpace(res);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Espaço público não encontrado ou ainda não publicado.');
        this.loading.set(false);
      }
    });
  }

  onAddProduct(product: PublicProduct) {
    this.cartService.addToCart(product);
    // Open the cart window if it's not open
    this.windowManager.openWindow('cart_drawer', 'Carrinho de Compras', 'shopping_cart');
  }
}

