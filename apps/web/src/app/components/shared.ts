import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderStatus } from '../models';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [class]="badgeClass">
      <span class="status-dot" [class]="'status-' + status()"></span>{{ label() }}
    </span>
  `,
})
export class StatusBadge {
  readonly status = input<OrderStatus>('pending');
  readonly label = input<string>('');

  get badgeClass(): string {
    switch (this.status()) {
      case 'paid':
      case 'delivered':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'preparing':
      case 'shipped':
        return 'badge-secondary';
      case 'cancelled':
        return 'badge-danger';
      default:
        return 'badge-outline';
    }
  }
}

@Component({
  selector: 'app-price',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="price">{{ price() / 100 | number: '1.2-2' }} €</span>
    @if (old() && old()! > price()) {
      <span class="price-old">{{ old()! / 100 | number: '1.2-2' }} €</span>
    }
  `,
})
export class PriceTag {
  readonly price = input.required<number>();
  readonly old = input<number | null>(null);
}
