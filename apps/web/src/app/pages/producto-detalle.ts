import { Component, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../services/catalog.service';
import { CartService } from '../services/cart.service';
import { AuthService } from '../services/auth.service';
import { PriceTag, StatusBadge } from '../components/shared';
import { Product, ReviewDTO } from '../models';

@Component({
  selector: 'app-producto-detalle',
  standalone: true,
  imports: [RouterLink, PriceTag, StatusBadge, CommonModule],
  template: `
    <div class="container" style="padding-top: 32px; padding-bottom: 64px;">
      @if (product(); as p) {
        <div class="detail-layout">
          <div class="detail-img">
            @if (p.imageUrl) {
              <img [src]="p.imageUrl" [alt]="p.name" />
            } @else {
              <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80" alt="" />
            }
          </div>
          <div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
              @if (p.category) {
                <a class="badge badge-secondary" [routerLink]="['/tienda']" [queryParams]="{ categoria: p.category.id }">{{ p.category.name }}</a>
              }
              @if (p.rating) {
                <span class="stars">{{ stars(p.rating) }}</span>
                <span style="color:var(--muted);font-size:0.875rem">{{ p.rating?.toFixed(1) }} ({{ p.reviewsCount }} opiniones)</span>
              }
            </div>
            <h1>{{ p.name }}</h1>
            <p style="color:var(--muted);margin:16px 0 24px">{{ p.description }}</p>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
              <app-price [price]="p.priceCents" [old]="p.oldPriceCents" />
            </div>
            <p class="stock-note" [class.stock-ok]="p.stock > 5" [class.stock-low]="p.stock > 0 && p.stock <= 5" [class.stock-out]="p.stock === 0">
              @if (p.stock === 0) { ❌ Agotado — vuelve en un rato }
              @else if (p.stock <= 5) { ⚠️ Últimas {{ p.stock }} unidades }
              @else { ✅ En stock ({{ p.stock }} uds) }
            </p>
            <div style="display:flex;gap:12px;margin-top:24px;flex-wrap:wrap">
              <button class="btn btn-primary" [disabled]="p.stock === 0" (click)="addToCart()">Añadir a la cesta</button>
              <a class="btn btn-secondary" routerLink="/tienda">← Seguir comprando</a>
            </div>
            <p style="color:var(--muted);font-size:0.875rem;margin-top:16px">
              🚚 Envío gratis a partir de 50 € · Reparto en menos de 15 min
            </p>
          </div>
        </div>

        <section style="margin-top:64px">
          <h2 style="margin-bottom:24px">Opiniones del barrio</h2>
          @if (reviews().length === 0) {
            <div class="empty-state" style="padding:32px">
              <p>Todavía no hay opiniones. ¡Sé el primero en probarlo!</p>
            </div>
          }
          <div style="max-width:760px">
            @for (r of reviews(); track r.id) {
              <div class="review-item">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <strong>{{ r.userName }}</strong>
                  <span class="stars">{{ stars(r.rating) }}</span>
                </div>
                <p style="color:var(--muted);font-size:0.9375rem;margin-top:4px">{{ r.comment }}</p>
                <p style="color:var(--muted);font-size:0.8125rem;margin-top:4px">{{ r.createdAt | date: 'mediumDate' }}</p>
              </div>
            }
          </div>
        </section>
      } @else {
        <div class="skeleton" style="height:400px;margin-top:32px"></div>
      }
    </div>
  `,
})
export class ProductoDetallePage implements OnInit {
  readonly id = input.required<string>();
  private readonly catalog = inject(CatalogService);
  private readonly cartService = inject(CartService);
  readonly auth = inject(AuthService);
  readonly product = signal<Product | null>(null);
  readonly reviews = signal<ReviewDTO[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const p = await this.catalog.getProduct(this.id());
      this.product.set(p);
      const r = await this.catalog.getReviews(this.id());
      this.reviews.set(r.reviews);
    } catch {
      this.product.set(null);
    }
  }

  stars(rating: number): string {
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  }

  async addToCart(): Promise<void> {
    const p = this.product();
    if (!p) return;
    try {
      await this.cartService.add(p.id, 1);
    } catch {
      // toast global
    }
  }
}
