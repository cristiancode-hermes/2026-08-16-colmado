import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { CartDTO, CheckoutResult } from '../models';

export interface ShippingDTO {
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingZip: string;
  paymentMethod: 'card' | 'cod';
}

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly cart = signal<CartDTO | null>(null);
  readonly loading = signal(false);

  constructor(private readonly api: ApiService) {}

  async refresh(): Promise<CartDTO> {
    this.loading.set(true);
    try {
      const cart = await this.api.get<CartDTO>('/cart');
      this.cart.set(cart);
      return cart;
    } finally {
      this.loading.set(false);
    }
  }

  async add(productId: string, quantity = 1): Promise<CartDTO> {
    const cart = await this.api.post<CartDTO>('/cart/items', { productId, quantity });
    this.cart.set(cart);
    return cart;
  }

  async updateQty(productId: string, quantity: number): Promise<CartDTO> {
    const cart = await this.api.patch<CartDTO>(`/cart/items/${productId}`, { quantity });
    this.cart.set(cart);
    return cart;
  }

  async remove(productId: string): Promise<CartDTO> {
    const cart = await this.api.delete<CartDTO>(`/cart/items/${productId}`);
    this.cart.set(cart);
    return cart;
  }

  async clear(): Promise<void> {
    await this.api.delete<{ cleared: boolean }>('/cart');
    this.cart.set({ items: [], itemCount: 0, subtotalCents: 0, shippingCents: 0, totalCents: 0, freeShipping: false });
  }

  async checkout(dto: ShippingDTO): Promise<CheckoutResult> {
    const result = await this.api.post<CheckoutResult>('/cart/checkout', dto);
    this.cart.set({ items: [], itemCount: 0, subtotalCents: 0, shippingCents: 0, totalCents: 0, freeShipping: false });
    return result;
  }
}
