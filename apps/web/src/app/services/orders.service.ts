import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { InvoiceResult, Order, PayResult } from '../models';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  constructor(private readonly api: ApiService) {}

  list(): Promise<Order[]> {
    return this.api.get<Order[]>('/orders');
  }

  get(id: string): Promise<Order> {
    return this.api.get<Order>(`/orders/${id}`);
  }

  pay(id: string): Promise<PayResult> {
    return this.api.post<PayResult>(`/orders/${id}/pay`);
  }

  cancel(id: string): Promise<Order> {
    return this.api.post<Order>(`/orders/${id}/cancel`);
  }

  invoice(id: string): Promise<InvoiceResult> {
    return this.api.get<InvoiceResult>(`/orders/${id}/invoice`);
  }
}
