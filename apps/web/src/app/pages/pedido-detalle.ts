import { Component, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrdersService } from '../services/orders.service';
import { StatusBadge } from '../components/shared';
import { centsToEur, Order, ORDER_FLOW, ORDER_STATUS_LABELS } from '../models';

@Component({
  selector: 'app-pedido-detalle',
  standalone: true,
  imports: [RouterLink, StatusBadge, CommonModule],
  template: `
    <div class="container" style="padding-top:32px;padding-bottom:64px;max-width:880px">
      @if (order(); as o) {
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:24px">
          <div>
            <h1 style="margin-bottom:4px">Pedido {{ o.number }}</h1>
            <p style="color:var(--muted)">{{ o.createdAt | date: 'medium' }}</p>
          </div>
          <app-status-badge [status]="o.status" [label]="label(o.status)" />
        </div>

        @if (o.status === 'pending') {
          <div class="alert" style="background:var(--secondary-soft);color:var(--ink);border:1px solid var(--secondary)">
            ⏱️ Tu pedido está <strong>reservado</strong>. El stock se libera automáticamente si no pagas antes de que expire la retención.
          </div>
          <div style="display:flex;gap:12px;margin:16px 0">
            <button class="btn btn-primary" (click)="pay()">💳 Pagar ahora</button>
            <button class="btn btn-secondary" (click)="cancel()">Cancelar</button>
          </div>
        }

        @if (o.status === 'paid' || o.status === 'preparing' || o.status === 'shipped' || o.status === 'delivered') {
          <div style="display:flex;gap:12px;margin:16px 0">
            <button class="btn btn-secondary" (click)="showInvoice()">🧾 Ver factura + QR</button>
          </div>
        }

        @if (o.status === 'cancelled') {
          <div class="alert alert-error">El pedido fue cancelado{{ o.cancelReason === 'EXPIRED_HOLD' ? ' porque la retención de stock expiró. El stock se liberó automáticamente.' : '' }}.</div>
        }

        <h2 style="margin:32px 0 16px">Seguimiento</h2>
        <div class="card" style="padding:24px">
          <ol class="timeline">
            @for (step of steps(); track step) {
              <li [class.active]="isStepActive(step)">
                <span class="tl-dot"></span>
                <span class="tl-label">{{ label(step) }}</span>
                @if (step === o.status && o.status !== 'cancelled') {
                  <span class="tl-time">Actual</span>
                }
              </li>
            }
          </ol>
        </div>

        <h2 style="margin:32px 0 16px">Artículos</h2>
        <div class="card" style="padding:24px">
          @for (item of o.items || []; track item.id) {
            <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:0.9375rem">
              <span>{{ item.productName }} <span style="color:var(--muted)">× {{ item.quantity }}</span></span>
              <span style="font-variant-numeric:tabular-nums">{{ eur(item.subtotalCents) }}</span>
            </div>
          }
          <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;font-weight:700">
            <span>Total</span><span>{{ eur(o.totalCents) }}</span>
          </div>
          <div style="margin-top:12px;color:var(--muted);font-size:0.875rem">
            <p>👤 {{ o.shippingName }}</p>
            <p>📍 {{ o.shippingAddress }}, {{ o.shippingCity }} ({{ o.shippingZip }})</p>
            <p>💳 {{ o.paymentMethod === 'cod' ? 'Contra reembolso' : 'Tarjeta (simulado)' }}</p>
          </div>
        </div>

        @if (invoice(); as inv) {
          <h2 style="margin:32px 0 16px">Factura con QR</h2>
          <div class="card" style="padding:24px;display:flex;gap:24px;align-items:center;flex-wrap:wrap">
            <div [innerHTML]="inv.qrSvg" style="width:180px"></div>
            <div>
              <p><strong>Factura nº:</strong> {{ inv.invoiceNumber }}</p>
              <p style="color:var(--muted);font-size:0.875rem;max-width:40ch">Presenta este QR en el mostrador del colmado para recoger tu pedido.</p>
              <button class="btn btn-secondary" style="margin-top:12px" (click)="printInvoice()">🖨️ Imprimir factura</button>
            </div>
          </div>
        }

        <a class="btn btn-ghost" style="margin-top:24px" routerLink="/pedidos">← Volver a mis pedidos</a>
      } @else {
        <div class="skeleton" style="height:300px;margin-top:32px"></div>
      }
    </div>
  `,
})
export class PedidoDetallePage implements OnInit {
  readonly id = input.required<string>();
  private readonly ordersService = inject(OrdersService);
  readonly order = signal<Order | null>(null);
  readonly invoice = signal<{ qrSvg: string; invoiceNumber: string } | null>(null);
  readonly labels = ORDER_STATUS_LABELS;

  ngOnInit(): void {
    void this.ordersService
      .get(this.id())
      .then((o) => this.order.set(o))
      .catch(() => this.order.set(null));
  }

  eur = centsToEur;

  label(st: string): string {
    return ORDER_STATUS_LABELS[st as Order['status']] ?? st;
  }

  steps(): Order['status'][] {
    const o = this.order();
    if (!o) return ORDER_FLOW;
    if (o.status === 'cancelled') return [...ORDER_FLOW.slice(0, 2), 'cancelled'];
    const idx = ORDER_FLOW.indexOf(o.status);
    return ORDER_FLOW.slice(0, idx + 1);
  }

  isStepActive(step: string): boolean {
    const o = this.order();
    if (!o) return false;
    if (o.status === 'cancelled') return step === 'cancelled';
    return ORDER_FLOW.indexOf(step as Order['status']) <= ORDER_FLOW.indexOf(o.status);
  }

  async pay(): Promise<void> {
    const o = this.order();
    if (!o) return;
    try {
      const res = await this.ordersService.pay(o.id);
      this.order.set(res.order);
    } catch {
      // toast global
      void this.ordersService.get(o.id).then((fresh) => this.order.set(fresh));
    }
  }

  async cancel(): Promise<void> {
    const o = this.order();
    if (!o) return;
    try {
      const res = await this.ordersService.cancel(o.id);
      this.order.set(res);
    } catch {
      // toast global
    }
  }

  async showInvoice(): Promise<void> {
    const o = this.order();
    if (!o) return;
    const inv = await this.ordersService.invoice(o.id);
    this.invoice.set({ qrSvg: inv.qrSvg, invoiceNumber: inv.invoiceNumber });
  }

  printInvoice(): void {
    const o = this.order();
    if (!o) return;
    void this.ordersService.invoice(o.id).then((inv) => {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(inv.html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
      }
    });
  }
}
