import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EmailLog, Order, OrderItem, OrderStatus, Product } from '../entities/entities';
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS } from '../entities/entities';

export interface TimelineEvent {
  status: OrderStatus;
  label: string;
  at: string;
}

/** Genera un QR SVG simple (patrón de módulos determinista) para la factura. */
export function generateQrSvg(seed: string): string {
  const size = 21;
  const cells: boolean[] = [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let state = h || 1;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967295;
  };
  for (let i = 0; i < size * size; i++) cells.push(rand() > 0.5);
  // Patrón de localización (finder patterns) en 3 esquinas
  const finder = (cx: number, cy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const border = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        cells[(cy + y) * size + (cx + x)] = border || core;
      }
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  const scale = 10;
  const padding = 20;
  const dim = size * scale + padding * 2;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">`;
  svg += `<rect width="${dim}" height="${dim}" fill="#ffffff"/>`;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (cells[y * size + x]) {
        svg += `<rect x="${padding + x * scale}" y="${padding + y * scale}" width="${scale}" height="${scale}" fill="#23281F"/>`;
      }
    }
  }
  svg += `</svg>`;
  return svg;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(EmailLog) private readonly emailLogs: Repository<EmailLog>,
  ) {}

  async listForUser(userId: string): Promise<Order[]> {
    const orders = await this.orders.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    // itemCount para la lista (mismo contrato que admin.listOrders)
    for (const o of orders) {
      const count = await this.orderItems
        .createQueryBuilder('oi')
        .select('COALESCE(SUM(oi.quantity), 0)', 'count')
        .where('oi.orderId = :id', { id: o.id })
        .getRawOne<{ count: string }>();
      (o as any).itemsCount = Number(count?.count ?? 0);
    }
    return orders;
  }

  async findForUser(userId: string, id: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id, userId },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    order.timeline = this.buildTimeline(order);
    return order;
  }

  private buildTimeline(order: Order): TimelineEvent[] {
    const events: TimelineEvent[] = [
      { status: 'pending', label: 'Pedido realizado', at: order.createdAt.toISOString() },
    ];
    if (order.paidAt) events.push({ status: 'paid', label: 'Pago confirmado', at: order.paidAt.toISOString() });
    if (order.status === 'preparing' || order.status === 'shipped' || order.status === 'delivered') {
      events.push({ status: 'preparing', label: 'En preparación', at: order.updatedAt?.toISOString?.() ?? order.createdAt.toISOString() });
    }
    if (order.status === 'shipped' || order.status === 'delivered') {
      events.push({ status: 'shipped', label: 'Enviado', at: order.updatedAt?.toISOString?.() ?? order.createdAt.toISOString() });
    }
    if (order.status === 'delivered') {
      events.push({ status: 'delivered', label: 'Entregado', at: order.updatedAt?.toISOString?.() ?? order.createdAt.toISOString() });
    }
    if (order.status === 'cancelled') {
      const reason = order.cancelReason === 'EXPIRED_HOLD' ? 'Retención expirada' : 'Cancelado por el cliente';
      events.push({ status: 'cancelled', label: reason, at: order.updatedAt?.toISOString?.() ?? order.createdAt.toISOString() });
    }
    return events;
  }

  /** pending → paid: genera factura QR + email simulado (EmailLog). */
  async pay(userId: string, id: string): Promise<{ order: Order; invoice: { qrSvg: string; invoiceNumber: string } }> {
    // Pre-chequeo de expiración FUERA de la transacción de pago: si la retención
    // venció, se cancela en su propia transacción (commiteada) y se lanza 409.
    const pre = await this.orders.findOne({ where: { id, userId } });
    if (!pre) throw new NotFoundException('Pedido no encontrado');
    if (pre.status === 'cancelled') {
      throw new ConflictException('La retención expiró: el pedido se canceló y el stock se liberó');
    }
    if (pre.expiresAt && pre.expiresAt.getTime() < Date.now()) {
      await this.dataSource.transaction(async (manager) => this.cancelExpired(manager, pre));
      throw new ConflictException('La retención expiró: el pedido se canceló y el stock se liberó');
    }

    return this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).findOne({ where: { id, userId } });
      if (!order) throw new NotFoundException('Pedido no encontrado');
      if (order.status !== 'pending') {
        if (order.status === 'cancelled') {
          throw new ConflictException('La retención expiró: el pedido se canceló y el stock se liberó');
        }
        throw new ConflictException('Este pedido ya no está pendiente de pago');
      }
      order.status = 'paid';
      order.paidAt = new Date();
      await manager.getRepository(Order).save(order);

      const user = await manager.getRepository('User' as any).findOneBy({ id: userId } as any);
      const invoiceNumber = order.number;
      const qrSvg = generateQrSvg(`${invoiceNumber}|${order.totalCents}`);
      await manager.getRepository(EmailLog).save(
        manager.getRepository(EmailLog).create({
          orderId: order.id,
          toEmail: user?.email ?? '',
          type: 'invoice',
        } as any),
      );
      const saved = await manager.getRepository(Order).findOne({
        where: { id: order.id },
        relations: { items: true },
      });
      if (saved) saved.timeline = this.buildTimeline(saved);
      return { order: saved ?? order, invoice: { qrSvg, invoiceNumber } };
    });
  }

  /** pending|paid → cancelled con liberación de stock en la misma transacción. */
  async cancel(userId: string, id: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).findOne({ where: { id, userId } });
      if (!order) throw new NotFoundException('Pedido no encontrado');
      if (order.status === 'cancelled') return order;
      if (order.status === 'preparing' || order.status === 'shipped' || order.status === 'delivered') {
        throw new ConflictException('Ya no se puede cancelar: está en preparación');
      }
      const wasPaid = order.status === 'paid';
      order.status = 'cancelled';
      order.cancelReason = 'client';
      await manager.getRepository(Order).save(order);
      await this.restoreStock(manager, order);
      if (wasPaid) {
        await manager.getRepository(EmailLog).save(
          manager.getRepository(EmailLog).create({
            orderId: order.id,
            toEmail: 'demo@colmado.dev',
            type: 'refund',
          } as any),
        );
      }
      const saved = await manager.getRepository(Order).findOne({
        where: { id: order.id },
        relations: { items: true },
      });
      if (saved) saved.timeline = this.buildTimeline(saved);
      return saved ?? order;
    });
  }

  /** Factura imprimible: QR SVG + HTML. Solo propia y paid+. */
  async invoice(userId: string, id: string): Promise<{ qrSvg: string; invoiceNumber: string; html: string }> {
    const order = await this.orders.findOne({
      where: { id, userId },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (!['paid', 'preparing', 'shipped', 'delivered'].includes(order.status)) {
      throw new ConflictException('La factura solo está disponible después del pago');
    }
    const qrSvg = generateQrSvg(`${order.number}|${order.totalCents}`);
    const rows = (order.items ?? [])
      .map(
        (it) =>
          `<tr><td>${it.productName}</td><td>${it.quantity}</td><td>${(it.unitPriceCents / 100).toFixed(2)} €</td><td>${(it.subtotalCents / 100).toFixed(2)} €</td></tr>`,
      )
      .join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Factura ${order.number}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;color:#23281F">
<h1 style="color:#B93A24">Colmado — Factura</h1>
<p><strong>Nº:</strong> ${order.number}</p>
<p><strong>Fecha:</strong> ${order.paidAt?.toISOString() ?? order.createdAt.toISOString()}</p>
<p><strong>Cliente:</strong> ${order.shippingName}</p>
<p><strong>Dirección:</strong> ${order.shippingAddress}, ${order.shippingCity} (${order.shippingZip})</p>
<table style="width:100%;border-collapse:collapse;margin:24px 0">
<thead><tr style="text-align:left;border-bottom:2px solid #E4E0D6"><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
<tbody>${rows}</tbody></table>
<p style="text-align:right;font-size:1.2rem"><strong>Total: ${(order.totalCents / 100).toFixed(2)} €</strong></p>
<p>Pago: ${order.paymentMethod === 'cod' ? 'Contra reembolso' : 'Tarjeta (simulado)'}</p>
<p>Este QR verifica tu compra en el mostrador del colmado.</p>
</body></html>`;
    return { qrSvg, invoiceNumber: order.number, html };
  }

  /** Sweeper: cancela pending vencidos y restaura stock (regla C). */
  async expireStale(): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const stale = await manager
        .getRepository(Order)
        .createQueryBuilder('o')
        .where("o.status = 'pending' AND o.expiresAt < :now", { now: new Date() })
        .getMany();
      for (const order of stale) {
        await this.cancelExpired(manager, order);
      }
      return stale.length;
    });
  }

  private async cancelExpired(manager: any, order: Order): Promise<void> {
    order.status = 'cancelled';
    order.cancelReason = 'EXPIRED_HOLD';
    await manager.getRepository(Order).save(order);
    await this.restoreStock(manager, order);
    await manager.getRepository(EmailLog).save(
      manager.getRepository(EmailLog).create({
        orderId: order.id,
        toEmail: 'demo@colmado.dev',
        type: 'hold_expired',
      } as any),
    );
  }

  private async restoreStock(manager: any, order: Order): Promise<void> {
    const items = await manager.getRepository(OrderItem).find({ where: { orderId: order.id } });
    for (const item of items) {
      if (!item.productId) continue;
      await manager
        .getRepository(Product)
        .createQueryBuilder()
        .update(Product)
        .set({ stock: () => `stock + ${item.quantity}` })
        .where('id = :id', { id: item.productId })
        .execute();
    }
  }

  /** Admin: avanzar estado según la máquina de transiciones. */
  async advanceStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: { items: true } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status === status) return order;
    const allowed = ORDER_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Transición inválida: ${ORDER_STATUS_LABELS[order.status]} → ${ORDER_STATUS_LABELS[status]}`,
      );
    }
    order.status = status;
    if (status === 'paid' && !order.paidAt) order.paidAt = new Date();
    await this.orders.save(order);
    const saved = await this.orders.findOne({ where: { id: orderId }, relations: { items: true } });
    if (saved) saved.timeline = this.buildTimeline(saved);
    return saved ?? order;
  }
}
