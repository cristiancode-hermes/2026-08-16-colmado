import { Component, computed, inject, OnInit, signal } from '@angular/core';
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

        <div class="charts-row">
          <div class="card chart-card">
            <h2 style="font-size:1.05rem;margin-bottom:4px">Ventas por día (14 días)</h2>
            <p style="color:var(--muted);font-size:0.85rem;margin-bottom:12px">Ingresos pagados en céntimos — pasa el ratón por cada barra</p>
            @if (sales().length) {
              <svg viewBox="0 0 720 230" width="100%" role="img" aria-label="Ventas por día" style="display:block">
                @for (f of gridlines; track f) {
                  <line [attr.x1]="44" [attr.x2]="712" [attr.y1]="gridY(f)" [attr.y2]="gridY(f)" stroke="var(--border)" stroke-width="1" />
                  <text [attr.x]="40" [attr.y]="gridY(f) + 4" text-anchor="end" font-size="10" fill="var(--muted)">{{ gridLabel(f) }}</text>
                }
                @for (d of sales(); track d.date; let i = $index) {
                  <rect [attr.x]="barX(i)" [attr.y]="barY(d.totalCents)" [attr.width]="barW" [attr.height]="barH(d.totalCents)" rx="3" fill="var(--primary)">
                    <title>{{ d.date }} — {{ eur(d.totalCents) }} ({{ d.orders }} pedido(s))</title>
                  </rect>
                  @if (i % 3 === 0) {
                    <text [attr.x]="barX(i) + barW / 2" [attr.y]="218" text-anchor="middle" font-size="10" fill="var(--muted)">{{ dayLabel(d.date) }}</text>
                  }
                }
              </svg>
            } @else {
              <p style="color:var(--muted)">Sin ventas en los últimos 14 días.</p>
            }
          </div>
          <div class="card chart-card">
            <h2 style="font-size:1.05rem;margin-bottom:4px">Top productos</h2>
            <p style="color:var(--muted);font-size:0.85rem;margin-bottom:12px">Por ingresos — unidades vendidas</p>
            @for (t of tops(); track t.name) {
              <div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:4px">
                  <span style="font-weight:600">{{ t.name }}</span>
                  <span style="color:var(--muted)">{{ t.units }} ud · {{ eur(t.totalCents) }}</span>
                </div>
                <div style="background:var(--surface-2);border-radius:6px;height:8px;overflow:hidden">
                  <div [style.width.%]="topPct(t.totalCents)" style="height:100%;background:var(--primary);border-radius:6px"></div>
                </div>
              </div>
            } @empty {
              <p style="color:var(--muted)">Aún no hay productos vendidos.</p>
            }
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

  // ---- Gráficos (ejes, fechas y tooltips — datos reales del backend) ----
  readonly sales = computed(() => this.stats()?.salesByDay ?? []);
  readonly tops = computed(() => this.stats()?.topProducts ?? []);
  readonly gridlines = [0.25, 0.5, 0.75, 1];
  readonly barW = 28;
  private readonly plotTop = 8;
  private readonly plotH = 180;

  private chartMax(): number {
    const vals = this.sales().map((d) => d.totalCents);
    return Math.max(1, ...vals);
  }

  gridY(f: number): number {
    return this.plotTop + this.plotH - f * this.plotH;
  }

  gridLabel(f: number): string {
    return String(Math.round((this.chartMax() * f) / 100));
  }

  barX(i: number): number {
    return 50 + i * (668 / Math.max(1, this.sales().length));
  }

  barY(cents: number): number {
    return this.plotTop + this.plotH - this.barH(cents);
  }

  barH(cents: number): number {
    return Math.max(2, (cents / this.chartMax()) * this.plotH);
  }

  dayLabel(date: string): string {
    return date.slice(5); // MM-DD
  }

  topPct(cents: number): number {
    const max = Math.max(1, ...this.tops().map((t) => t.totalCents));
    return Math.max(4, Math.round((cents / max) * 100));
  }

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
