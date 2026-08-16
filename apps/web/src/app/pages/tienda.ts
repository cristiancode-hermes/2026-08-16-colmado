import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../services/catalog.service';
import { CartService } from '../services/cart.service';
import { PriceTag } from '../components/shared';
import { Category, Product } from '../models';

@Component({
  selector: 'app-tienda',
  standalone: true,
  imports: [RouterLink, PriceTag],
  template: `
    <section class="hero">
      <div class="hero-inner">
        <div>
          <h1>La tienda de barrio, en tu móvil</h1>
          <p>Producto fresco de la huerta y la panadería de siempre, con reparto a casa en menos de 15 minutos. Sin mínimos, sin letra pequeña.</p>
          <a class="btn btn-primary" routerLink="/tienda" [queryParams]="{ ofertas: '1' }">Ver ofertas de la semana</a>
        </div>
        <div class="hero-img">
          <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80" alt="Cestas de productos frescos de mercado" loading="eager" />
        </div>
      </div>
    </section>

    <div class="container" style="padding-top: 32px; padding-bottom: 64px;">
      <div class="filter-row">
        <button class="chip" [class.active]="!categoryId()" (click)="selectCategory(null)">Todo</button>
        @for (cat of catalog.categories(); track cat.id) {
          <button class="chip" [class.active]="categoryId() === cat.id" (click)="selectCategory(cat.id)">
            {{ cat.name }} @if (cat.productCount) { ({{ cat.productCount }}) }
          </button>
        }
      </div>

      <div class="filter-row" style="margin-top: 8px">
        <button class="chip" [class.active]="ofertas()" (click)="toggleOfertas()">🔥 Ofertas</button>
        <button class="chip" [class.active]="stockBajo()" (click)="toggleStockBajo()">⚠️ Últimas unidades</button>
        <select class="input" style="width:auto;min-height:40px" (change)="setOrden($event)" [value]="orden()">
          <option value="relevancia">Relevancia</option>
          <option value="precio-asc">Precio: menor a mayor</option>
          <option value="precio-desc">Precio: mayor a menor</option>
          <option value="nombre">Nombre A-Z</option>
        </select>
      </div>

      @if (catalog.loading()) {
        <div class="skeleton-grid">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="skeleton-card card">
              <div class="skeleton"></div>
              <div class="skeleton line"></div>
              <div class="skeleton line short"></div>
            </div>
          }
        </div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">🫙</div>
          <h3>No hay productos que coincidan</h3>
          <p>Prueba a quitar los filtros para ver todo el catálogo.</p>
          <button class="btn btn-secondary" style="margin-top:16px" (click)="resetFilters()">Limpiar filtros</button>
        </div>
      } @else {
        <div class="catalog-grid">
          @for (p of filtered(); track p.id) {
            <article class="card product-card">
              <a class="product-img" [routerLink]="['/producto', p.id]">
                @if (p.imageUrl) {
                  <img [src]="p.imageUrl" [alt]="p.name" loading="lazy" />
                } @else {
                  <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80" alt="" loading="lazy" />
                }
              </a>
              <div class="product-body">
                <h3 class="product-name"><a [routerLink]="['/producto', p.id]">{{ p.name }}</a></h3>
                <p class="product-desc">{{ p.description }}</p>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  @if (p.oldPriceCents && p.oldPriceCents > p.priceCents) {
                    <span class="badge badge-secondary">-{{ discount(p) }}%</span>
                  }
                  @if (p.stock <= 5 && p.stock > 0) {
                    <span class="badge badge-warning">Quedan {{ p.stock }}</span>
                  }
                  @if (p.stock === 0) {
                    <span class="badge badge-danger">Agotado</span>
                  }
                </div>
                <div class="price-row">
                  <app-price [price]="p.priceCents" [old]="p.oldPriceCents" />
                  <button class="btn btn-primary" style="margin-left:auto;min-height:40px;padding:8px 14px"
                    [disabled]="p.stock === 0" (click)="addToCart(p)">
                    Añadir
                  </button>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class TiendaPage implements OnInit {
  readonly catalog = inject(CatalogService);
  private readonly cartService = inject(CartService);
  readonly categoryId = signal<string | null>(null);
  readonly ofertas = signal(false);
  readonly stockBajo = signal(false);
  readonly orden = signal('relevancia');

  ngOnInit(): void {
    void this.catalog.loadCatalog();
  }

  filtered(): Product[] {
    let list = this.catalog.products();
    if (this.categoryId()) list = list.filter((p) => p.categoryId === this.categoryId());
    if (this.ofertas()) list = list.filter((p) => p.oldPriceCents && p.oldPriceCents > p.priceCents);
    if (this.stockBajo()) list = list.filter((p) => p.stock > 0 && p.stock <= 5);
    switch (this.orden()) {
      case 'precio-asc':
        list = [...list].sort((a, b) => a.priceCents - b.priceCents);
        break;
      case 'precio-desc':
        list = [...list].sort((a, b) => b.priceCents - a.priceCents);
        break;
      case 'nombre':
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return list;
  }

  discount(p: Product): number {
    if (!p.oldPriceCents || p.oldPriceCents <= p.priceCents) return 0;
    return Math.round((1 - p.priceCents / p.oldPriceCents) * 100);
  }

  selectCategory(id: string | null): void {
    this.categoryId.set(id);
  }

  toggleOfertas(): void {
    this.ofertas.set(!this.ofertas());
  }

  toggleStockBajo(): void {
    this.stockBajo.set(!this.stockBajo());
  }

  setOrden(ev: Event): void {
    this.orden.set((ev.target as HTMLSelectElement).value);
  }

  resetFilters(): void {
    this.categoryId.set(null);
    this.ofertas.set(false);
    this.stockBajo.set(false);
  }

  async addToCart(p: Product): Promise<void> {
    try {
      await this.cartService.add(p.id, 1);
    } catch {
      // El error ya se muestra como toast en el interceptor global
    }
  }
}
