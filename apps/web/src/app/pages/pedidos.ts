import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrdersService } from '../services/orders.service';
import { StatusBadge } from '../components/shared';
import { centsToEur, Order, ORDER_STATUS_LABELS } from '../models';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [RouterLink, StatusBadge, CommonModule],
  template: `
    <div class="container" style="padding-top:32px;padding-bottom:64px;max-width:880px">
      <h1 style="margin-bottom:8px">Mis pedidos</h1>
      <p style="color:var(--muted);margin-bottom:24px">Sigue el estado de tus compras del barrio.</p>

      @if (loading()) {
        <div class="skeleton" style="height:160px"></div>
      } @else if (orders().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <h3>Aún no has hecho pedidos</h3>
          <p>Cuando compres en la tienda, aquí verás el estado en tiempo real.</p>
          <a class="btn btn-primary" style="margin-top:16px" routerLink="/tienda">Ir a la tienda</a>
        </div>
      } @else {
        @for (o of orders(); track o.id) {
          <div class="card order-card">
            <div class="order-head">
              <div>
                <div class="order-number">Pedido {{ o.number }}</div>
                <div class="order-date">{{ o.createdAt | date: 'medium' }}</div>
              </div>
              <div style="display:flex;align-items:center;gap:12px">
                <app-status-badge [status]="o.status" [label]="label(o.status)" />
                <a class="btn btn-secondary" [routerLink]="['/pedidos', o.id]">Ver detalle</a>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:0.9375rem">
              <span>{{ o.itemsCount ?? 0 }} artículo(s)</span>
              <strong style="color:var(--ink);font-variant-numeric:tabular-nums">{{ eur(o.totalCents) }}</strong>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class PedidosPage implements OnInit {
  private readonly ordersService = inject(OrdersService);
  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly labels = ORDER_STATUS_LABELS;

  ngOnInit(): void {
    void this.ordersService
      .list()
      .then((orders) => this.orders.set(orders))
      .finally(() => this.loading.set(false));
  }

  eur = centsToEur;

  label(st: string): string {
    return ORDER_STATUS_LABELS[st as Order['status']] ?? st;
  }
}
