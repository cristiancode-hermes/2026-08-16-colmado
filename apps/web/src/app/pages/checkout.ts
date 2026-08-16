import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService, ShippingDTO } from '../services/cart.service';
import { OrdersService } from '../services/orders.service';
import { AuthService } from '../services/auth.service';
import { centsToEur, CheckoutResult } from '../models';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  template: `
    <div class="container" style="padding-top:32px;padding-bottom:64px;max-width:880px">
      <h1 style="margin-bottom:24px">Checkout</h1>

      @if (hold(); as hold) {
        <div class="hold-banner" style="margin-bottom:24px">
          <span>⏱️ Reservamos tu compra</span>
          <span class="hold-timer" style="margin-left:auto">{{ mmss() }}</span>
        </div>
        <div class="hold-progress" style="margin-bottom:24px">
          <div class="hold-progress-bar" [style.transform]="'scaleX(' + progress() + ')'"></div>
        </div>
        <div class="alert alert-error" *ngIf="expired()">⏰ El tiempo de reserva se agotó. Vuelve a tramitar el pedido para regenerar la retención.</div>

        <div class="card" style="padding:24px;margin-bottom:16px">
          <h3 style="margin-bottom:16px">📦 Pedido {{ hold.order.number }} — {{ centsToEur(hold.order.totalCents) }}</h3>
          @for (item of hold.order.items || []; track item.id) {
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.9375rem">
              <span>{{ item.productName }} × {{ item.quantity }}</span>
              <span style="font-variant-numeric:tabular-nums">{{ centsToEur(item.subtotalCents) }}</span>
            </div>
          }
          <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;font-weight:700">
            <span>Total</span><span>{{ centsToEur(hold.order.totalCents) }}</span>
          </div>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn btn-primary" [disabled]="paying() || expired()" (click)="pay()">
            {{ paying() ? 'Procesando…' : '💳 Pagar ahora' }}
          </button>
          <button class="btn btn-secondary" [disabled]="paying() || expired()" (click)="cancel()">Cancelar pedido</button>
        </div>
        <p style="color:var(--muted);font-size:0.875rem;margin-top:12px">
          Pago simulado (demo) — al confirmar recibirás tu factura con código QR.
        </p>
      } @else {
        <form (ngSubmit)="submit()" novalidate>
          <div class="card" style="padding:24px;margin-bottom:16px">
            <h3 style="margin-bottom:16px">Envío a domicilio</h3>
            <div class="field">
              <label for="name">Nombre completo</label>
              <input id="name" class="input" name="shippingName" [(ngModel)]="form.shippingName" required placeholder="María García" />
            </div>
            <div class="field">
              <label for="addr">Dirección</label>
              <input id="addr" class="input" name="shippingAddress" [(ngModel)]="form.shippingAddress" required placeholder="Calle del Sol 12, 3ºB" />
            </div>
            <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px">
              <div class="field">
                <label for="city">Ciudad</label>
                <input id="city" class="input" name="shippingCity" [(ngModel)]="form.shippingCity" required placeholder="Madrid" />
              </div>
              <div class="field">
                <label for="zip">C.P.</label>
                <input id="zip" class="input" name="shippingZip" [(ngModel)]="form.shippingZip" required placeholder="28012" maxlength="5" />
              </div>
            </div>
            <div class="field">
              <label for="pay">Método de pago</label>
              <select id="pay" class="input" name="paymentMethod" [(ngModel)]="form.paymentMethod">
                <option value="card">Tarjeta (simulado)</option>
                <option value="cod">Contra reembolso</option>
              </select>
            </div>
          </div>

          <div class="card summary-card" style="position:static">
            <div class="summary-row"><span>Subtotal</span><span>{{ centsToEur(cart()?.subtotalCents || 0) }}</span></div>
            <div class="summary-row"><span>Envío</span><span>{{ cart()?.shippingCents ? centsToEur(cart()!.shippingCents) : 'Gratis' }}</span></div>
            <div class="summary-row total"><span>Total</span><span>{{ centsToEur(cart()?.totalCents || 0) }}</span></div>
            <button class="btn btn-primary btn-block" style="margin-top:16px" [disabled]="submitting()">
              {{ submitting() ? 'Reservando…' : 'Confirmar pedido (reserva 15 min)' }}
            </button>
            @if (error()) {
              <div class="alert alert-error" style="margin-top:12px">{{ error() }}</div>
            }
          </div>
        </form>
      }
    </div>
  `,
})
export class CheckoutPage implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly ordersService = inject(OrdersService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly hold = signal<CheckoutResult | null>(null);
  readonly submitting = signal(false);
  readonly paying = signal(false);
  readonly expired = signal(false);
  readonly error = signal('');
  readonly mmss = signal('15:00');
  readonly progress = signal(1);
  readonly form: ShippingDTO = {
    shippingName: '',
    shippingAddress: '',
    shippingCity: '',
    shippingZip: '',
    paymentMethod: 'card',
  };
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    void this.cartService.refresh().catch(() => undefined);
  }

  cart() {
    return this.cartService.cart();
  }

  async submit(): Promise<void> {
    this.error.set('');
    if (!this.form.shippingName.trim() || !this.form.shippingAddress.trim() || !this.form.shippingCity.trim() || !this.form.shippingZip.trim()) {
      this.error.set('Completa todos los datos de envío');
      return;
    }
    this.submitting.set(true);
    try {
      const result = await this.cartService.checkout(this.form);
      this.hold.set(result);
      this.startHoldTimer(result.expiresAt);
    } catch (e: unknown) {
      const msg = (e as { error?: { message?: string } }).error?.message;
      this.error.set(msg || 'No se pudo tramitar el pedido. Revisa el stock e inténtalo de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }

  private startHoldTimer(expiresAt: string): void {
    const end = new Date(expiresAt).getTime();
    const total = 15 * 60 * 1000;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      this.mmss.set(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      this.progress.set(left / total);
      if (left <= 0) {
        this.expired.set(true);
        if (this.timer) clearInterval(this.timer);
      }
    };
    tick();
    this.timer = setInterval(tick, 1000);
  }

  async pay(): Promise<void> {
    const h = this.hold();
    if (!h || this.expired()) return;
    this.paying.set(true);
    try {
      await this.ordersService.pay(h.order.id);
      void this.router.navigate(['/pedidos', h.order.id]);
    } catch (e: unknown) {
      const msg = (e as { error?: { message?: string } }).error?.message;
      this.error.set(msg || 'No se pudo procesar el pago');
      // si la retención expiró, recargar estado
      if (msg && msg.includes('expir')) {
        this.expired.set(true);
        if (this.timer) clearInterval(this.timer);
      }
    } finally {
      this.paying.set(false);
    }
  }

  async cancel(): Promise<void> {
    const h = this.hold();
    if (!h) return;
    try {
      await this.ordersService.cancel(h.order.id);
      void this.router.navigate(['/tienda']);
    } catch {
      // toast global
    }
  }

  centsToEur = centsToEur;
}
