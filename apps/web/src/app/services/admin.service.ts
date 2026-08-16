import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AdminStats, Order, Product } from '../models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  readonly stats = signal<AdminStats | null>(null);
  readonly orders = signal<Order[]>([]);

  constructor(private readonly api: ApiService) {}

  async loadStats(): Promise<AdminStats> {
    const s = await this.api.get<AdminStats>('/admin/stats');
    this.stats.set(s);
    return s;
  }

  async loadOrders(estado?: string): Promise<Order[]> {
    const orders = await this.api.get<Order[]>('/admin/orders', { estado });
    this.orders.set(orders);
    return orders;
  }

  advance(orderId: string, status: Order['status']): Promise<Order> {
    return this.api.patch<Order>(`/admin/orders/${orderId}/status`, { status });
  }

  createProduct(dto: Record<string, unknown>): Promise<Product> {
    return this.api.post<Product>('/products', dto);
  }

  updateProduct(id: string, dto: Record<string, unknown>): Promise<Product> {
    return this.api.patch<Product>(`/products/${id}`, dto);
  }

  removeProduct(id: string): Promise<{ removed: boolean }> {
    return this.api.delete<{ removed: boolean }>(`/products/${id}`);
  }
}
