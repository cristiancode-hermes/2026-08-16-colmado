import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FavoritesService } from '../services/favorites.service';
import { CartService } from '../services/cart.service';
import { PriceTag } from '../components/shared';
import { Product } from '../models';

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [RouterLink, PriceTag],
  template: `
    <div class="container" style="padding-top:32px;padding-bottom:64px">
      <h1 style="margin-bottom:8px">Mis favoritos</h1>
      <p style="color:var(--muted);margin-bottom:24px">Los productos que te hacen la boca agua.</p>

      @if (favs().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">❤️</div>
          <h3>Sin favoritos todavía</h3>
          <p>Guarda tus productos de siempre para encontrarlos rápido.</p>
          <a class="btn btn-primary" style="margin-top:16px" routerLink="/tienda">Explorar tienda</a>
        </div>
      } @else {
        <div class="catalog-grid">
          @for (p of favs(); track p.id) {
            <article class="card product-card">
              <a class="product-img" [routerLink]="['/producto', p.id]">
                <img [src]="p.imageUrl || fallback" [alt]="p.name" loading="lazy" />
              </a>
              <div class="product-body">
                <h3 class="product-name"><a [routerLink]="['/producto', p.id]">{{ p.name }}</a></h3>
                <div class="price-row">
                  <app-price [price]="p.priceCents" [old]="p.oldPriceCents" />
                </div>
                <div style="display:flex;gap:8px;margin-top:12px">
                  <button class="btn btn-primary" style="flex:1" [disabled]="p.stock === 0" (click)="add(p)">Añadir</button>
                  <button class="btn btn-ghost" (click)="unfav(p.id)" aria-label="Quitar de favoritos">❤️</button>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class FavoritosPage implements OnInit {
  private readonly favService = inject(FavoritesService);
  private readonly cartService = inject(CartService);
  readonly favs = signal<Product[]>([]);
  readonly fallback = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80';

  ngOnInit(): void {
    void this.favService.load().then((f) => this.favs.set(f));
  }

  async add(p: Product): Promise<void> {
    try {
      await this.cartService.add(p.id, 1);
    } catch {
      // toast
    }
  }

  async unfav(productId: string): Promise<void> {
    await this.favService.remove(productId);
    this.favs.set(this.favs().filter((f) => f.id !== productId));
  }
}
