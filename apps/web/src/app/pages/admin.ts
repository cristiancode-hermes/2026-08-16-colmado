import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../services/admin.service';
import { StatusBadge } from '../components/shared';
import { centsToEur, Order, ORDER_STATUS_LABELS, NEXT_STATUS, AdminStats } from '../models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [StatusBadge, CommonModule],
  template: `
    <div class="container" style="padding-top:32px;padding-bottom:64px">
      <h1 style="margin-bottom:8px">Mostrador</h1>
      <p style="color:var(--muted);margin-bottom:8px">Pedidos del barrio en tiempo real — avanza el estado y el cliente lo ve al instante.</p>

      @if (stats(); as s) {
        <div class="admin-grid">
          <div class="card stat-card">
            <div class="stat-value">{{ s.ordersToday }}</div>
            <div class="stat-label">Pedidos hoy</div>
          </div>
          <div class="card stat-card">
            <div class="stat-value">{{ eur(s.revenueCents) }}</div>
            <div class="stat-label">Ingresos pagados</div>
          </div>
          <div class="card stat-card">
            <div class="stat-value">{{ s.pendingHolds }}</div>
            <div class="stat-label">Retenciones activas</div>
          </div>
          <div class="card stat-card">
            <div class="stat-value">{{ s.lowStock }}</div>
            <div class="stat-label">Productos con stock bajo</div>
          </div>
          <div class="card stat-card">
            <div class="stat-value">{{ s.products }}</div>
            <div class="stat-label">Productos en catálogo</div>
          </div>
        </div>
      }

      <div class="filter-row" style="margin-top:24px">
        <button class="chip" [class.active]="!filter()" (click)="setFilter('')">Todos</button>
        @for (st of ['pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled']; track st) {
          <button class="chip" [class.active]="filter() === st" (click)="setFilter(st)">
            {{ label(st) }}
          </button>
        }
      </div>

      <div class="table-wrap" style="margin-top:16px">
        <table>
          <thead>
            <tr>
              <th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Acción</th>
            </tr>
          </thead>
          <tbody>
            @for (o of orders(); track o.id) {
              <tr>
                <td style="font-weight:600;font-variant-numeric:tabular-nums">{{ o.number }}</td>
                <td>{{ o.shippingName }}</td>
                <td style="white-space:nowrap">{{ o.createdAt | date: 'short' }}</td>
                <td style="font-variant-numeric:tabular-nums">{{ eur(o.totalCents) }}</td>
                <td><app-status-badge [status]="o.status" [label]="label(o.status)" /></td>
                <td>
                  @if (next(o)) {
                    <button class="btn btn-secondary" style="min-height:36px;padding:6px 12px" (click)="advance(o)">
                      → {{ label(next(o)!) }}
                    </button>
                  } @else if (o.status === 'pending') {
                    <span style="color:var(--muted);font-size:0.875rem">Esperando pago</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px">No hay pedidos con este estado.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AdminPage implements OnInit {
  private readonly adminService = inject(AdminService);
  readonly stats = signal<AdminStats | null>(null);
  readonly orders = signal<Order[]>([]);
  readonly filter = signal('');
  readonly labels = ORDER_STATUS_LABELS;

  ngOnInit(): void {
    void this.loadAll();
    // refetch cada 15s (pedidos en tiempo real)
    this.timer = setInterval(() => void this.loadAll(), 15_000);
  }

  private timer: ReturnType<typeof setInterval> | null = null;

  eur = centsToEur;

  label(st: string): string {
    return ORDER_STATUS_LABELS[st as Order['status']] ?? st;
  }

  private async loadAll(): Promise<void> {
    try {
      const [stats, orders] = await Promise.all([
        this.adminService.loadStats(),
        this.adminService.loadOrders(this.filter() || undefined),
      ]);
      this.stats.set(stats);
      this.orders.set(orders);
    } catch {
      // toast global
    }
  }

  setFilter(f: string): void {
    this.filter.set(f);
    void this.adminService.loadOrders(f || undefined).then((o) => this.orders.set(o));
  }

  next(o: Order): Order['status'] | null {
    if (o.status === 'cancelled' || o.status === 'delivered') return null;
    const n = NEXT_STATUS[o.status];
    if (o.status === 'pending' && n === 'paid') return null; // el pago lo hace el cliente
    return n ?? null;
  }

  async advance(o: Order): Promise<void> {
    const n = this.next(o);
    if (!n) return;
    try {
      const updated = await this.adminService.advance(o.id, n);
      this.orders.set(this.orders().map((x) => (x.id === o.id ? updated : x)));
      void this.adminService.loadStats().then((s) => this.stats.set(s));
    } catch {
      // toast global
    }
  }
}
