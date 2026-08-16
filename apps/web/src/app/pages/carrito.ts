import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CartService } from '../services/cart.service';
import { AuthService } from '../services/auth.service';
import { centsToEur } from '../models';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container" style="padding-top:32px;padding-bottom:64px">
      <h1 style="margin-bottom:8px">Tu cesta</h1>
      <p style="color:var(--muted)">Reservamos tu compra 15 minutos en el momento de pagar.</p>

      @if (cartService.loading() && !cartService.cart()) {
        <div class="skeleton" style="height:200px;margin-top:24px"></div>
      } @else if (cart()?.items?.length === 0) {
        <div class="empty-state" style="padding:64px 0">
          <div class="empty-icon">🧺</div>
          <h3>La cesta está vacía</h3>
          <p>Echa un vistazo al catálogo y llena la despensa.</p>
          <a class="btn btn-primary" style="margin-top:16px" routerLink="/tienda">Ir a la tienda</a>
        </div>
      } @else {
        <div class="cart-layout">
          <div>
            @for (line of cart()?.items; track line.productId) {
              <div class="cart-line">
                <img class="cart-line-img" [src]="line.imageUrl || fallbackImg" [alt]="line.name" />
                <div class="cart-line-info">
                  <div class="cart-line-name">{{ line.name }}</div>
                  <div class="cart-line-price">{{ centsToEur(line.unitPriceCents) }} /ud</div>
                  @if (line.stock <= 5) {
                    <div style="color:var(--warning);font-size:0.8125rem">⚠️ Solo quedan {{ line.stock }}</div>
                  }
                </div>
                <div class="qty-stepper">
                  <button (click)="dec(line)" [disabled]="line.quantity <= 1" aria-label="Quitar uno">−</button>
                  <span class="qty-val">{{ line.quantity }}</span>
                  <button (click)="inc(line)" [disabled]="line.quantity >= line.stock" aria-label="Añadir uno">+</button>
                </div>
                <strong style="font-variant-numeric:tabular-nums;min-width:80px;text-align:right">{{ centsToEur(line.subtotalCents) }}</strong>
                <button class="btn btn-ghost" style="min-height:40px;padding:8px 12px" (click)="remove(line.productId)" aria-label="Eliminar">✕</button>
              </div>
            }
            <a class="btn btn-secondary" style="margin-top:16px" routerLink="/tienda">← Seguir comprando</a>
          </div>

          <aside class="card summary-card">
            <h3 style="margin-bottom:16px">Resumen</h3>
            <div class="summary-row"><span>Subtotal</span><span>{{ centsToEur(cart()?.subtotalCents || 0) }}</span></div>
            <div class="summary-row"><span>Envío</span><span>{{ cart()?.shippingCents ? centsToEur(cart()!.shippingCents) : 'Gratis 🎉' }}</span></div>
            @if (!cart()?.freeShipping) {
              <p class="free-ship-note" style="margin-top:8px">Te faltan {{ centsToEur(5000 - (cart()?.subtotalCents || 0)) }} para envío gratis</p>
            }
            <div class="summary-row total"><span>Total</span><span>{{ centsToEur(cart()?.totalCents || 0) }}</span></div>
            <button class="btn btn-primary btn-block" style="margin-top:16px" (click)="goCheckout()">Tramitar pedido</button>
          </aside>
        </div>
      }
    </div>
  `,
})
export class CarritoPage implements OnInit {
  readonly cartService = inject(CartService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly fallbackImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80';

  ngOnInit(): void {
    void this.cartService.refresh().catch(() => undefined);
  }

  cart() {
    return this.cartService.cart();
  }

  async inc(line: { productId: string; quantity: number }): Promise<void> {
    try {
      await this.cartService.updateQty(line.productId, line.quantity + 1);
    } catch {
      // toast global
    }
  }

  async dec(line: { productId: string; quantity: number }): Promise<void> {
    if (line.quantity <= 1) return;
    try {
      await this.cartService.updateQty(line.productId, line.quantity - 1);
    } catch {
      // toast global
    }
  }

  async remove(productId: string): Promise<void> {
    try {
      await this.cartService.remove(productId);
    } catch {
      // toast global
    }
  }

  goCheckout(): void {
    if (!this.auth.token()) {
      void this.router.navigate(['/login'], { queryParams: { next: '/checkout' } });
      return;
    }
    void this.router.navigate(['/checkout']);
  }

  centsToEur = centsToEur;
}
