import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderItem, Product } from '../entities/entities';

export interface AdminStats {
  kpis: {
    sales7dCents: number;
    activeOrders: number;
    lowStock: number;
    avgTicketCents: number;
    totalOrders: number;
  };
  // Campos planos consumidos por el frontend (AdminStats del web)
  products: number;
  ordersToday: number;
  pendingHolds: number;
  revenueCents: number;
  lowStock: number;
  salesByDay: { date: string; totalCents: number; orders: number }[];
  topProducts: { name: string; units: number; totalCents: number }[];
}

const SALE_STATUSES = ['paid', 'preparing', 'shipped', 'delivered'];

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async listOrders(estado?: string): Promise<Order[]> {
    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'oi')
      .orderBy("CASE WHEN o.status IN ('pending','paid') THEN 0 ELSE 1 END", 'ASC')
      .addOrderBy('o.createdAt', 'DESC');
    if (estado) qb.where('o.status = :estado', { estado });
    const rows = await qb.getMany();
    for (const r of rows) {
      (r as any).itemsCount = (r.items ?? []).reduce((a, i) => a + i.quantity, 0);
    }
    return rows;
  }

  async stats(): Promise<AdminStats> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const sales7d = await this.orderItems
      .createQueryBuilder('oi')
      .innerJoin(Order, 'o', 'o.id = oi.orderId AND o.status IN (:...statuses)', {
        statuses: SALE_STATUSES,
      })
      .where('o.createdAt >= :weekAgo', { weekAgo })
      .select('COALESCE(SUM(oi.subtotalCents), 0)', 'total')
      .getRawOne<{ total: string }>();

    const active = await this.orders
      .createQueryBuilder('o')
      .select('COUNT(*)', 'count')
      .where("o.status IN ('pending','paid','preparing','shipped')")
      .getRawOne<{ count: string }>();

    const lowStock = await this.products
      .createQueryBuilder('p')
      .select('COUNT(*)', 'count')
      .where('p.isActive = :active AND p.stock <= 5', { active: true })
      .getRawOne<{ count: string }>();

    const avg = await this.orders
      .createQueryBuilder('o')
      .select('COALESCE(AVG(o.totalCents), 0)', 'avg')
      .where('o.status IN (:...statuses)', { statuses: SALE_STATUSES })
      .getRawOne<{ avg: string }>();

    const totalOrders = await this.orders.count();

    // KPIs planos para el frontend
    const productsCount = await this.products
      .createQueryBuilder('p')
      .where('p.isActive = :active', { active: true })
      .getCount();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ordersToday = await this.orders
      .createQueryBuilder('o')
      .select('COUNT(*)', 'count')
      .where('o.createdAt >= :dayStart', { dayStart })
      .getRawOne<{ count: string }>();
    const pendingHolds = await this.orders
      .createQueryBuilder('o')
      .select('COUNT(*)', 'count')
      .where("o.status = 'pending'")
      .getRawOne<{ count: string }>();
    const revenueAll = await this.orderItems
      .createQueryBuilder('oi')
      .innerJoin(Order, 'o', 'o.id = oi.orderId AND o.status IN (:...statuses)', {
        statuses: SALE_STATUSES,
      })
      .select('COALESCE(SUM(oi.subtotalCents), 0)', 'total')
      .getRawOne<{ total: string }>();

    // Ventas por día — últimos 14 días con COALESCE (días sin ventas = 0)
    const salesByDay: { date: string; totalCents: number; orders: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 3600 * 1000);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
      const rows = await this.orderItems
        .createQueryBuilder('oi')
        .innerJoin(Order, 'o', 'o.id = oi.orderId AND o.status IN (:...statuses)', {
          statuses: SALE_STATUSES,
        })
        .where('o.createdAt >= :dayStart AND o.createdAt < :dayEnd', { dayStart, dayEnd })
        .select('COALESCE(SUM(oi.subtotalCents), 0)', 'total')
        .addSelect('COUNT(DISTINCT o.id)', 'count')
        .getRawOne<{ total: string; count: string }>();
      salesByDay.push({
        date: dayStart.toISOString().slice(0, 10),
        totalCents: Number(rows?.total ?? 0),
        orders: Number(rows?.count ?? 0),
      });
    }

    const top = await this.orderItems
      .createQueryBuilder('oi')
      .innerJoin(Order, 'o', 'o.id = oi.orderId AND o.status IN (:...statuses)', {
        statuses: SALE_STATUSES,
      })
      .leftJoin(Product, 'p', 'p.id = oi.productId')
      .select('COALESCE(p.name, oi.productName)', 'name')
      .addSelect('SUM(oi.quantity)', 'units')
      .addSelect('SUM(oi.subtotalCents)', 'total')
      .groupBy('COALESCE(p.name, oi.productName)')
      .orderBy('SUM(oi.subtotalCents)', 'DESC')
      .limit(5)
      .getRawMany<{ name: string; units: string; total: string }>();

    return {
      kpis: {
        sales7dCents: Number(sales7d?.total ?? 0),
        activeOrders: Number(active?.count ?? 0),
        lowStock: Number(lowStock?.count ?? 0),
        avgTicketCents: Math.round(Number(avg?.avg ?? 0)),
        totalOrders,
      },
      // KPIs planos para el frontend
      products: productsCount,
      ordersToday: Number(ordersToday?.count ?? 0),
      pendingHolds: Number(pendingHolds?.count ?? 0),
      revenueCents: Number(revenueAll?.total ?? 0),
      lowStock: Number(lowStock?.count ?? 0),
      salesByDay,
      topProducts: top.map((t) => ({
        name: t.name,
        units: Number(t.units ?? 0),
        totalCents: Number(t.total ?? 0),
      })),
    };
  }
}
