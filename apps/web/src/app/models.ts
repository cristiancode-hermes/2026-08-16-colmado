export type UserRole = 'client' | 'admin';
export type OrderStatus = 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentMethod = 'card' | 'cod';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Reservado',
  paid: 'Pagado',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const ORDER_FLOW: OrderStatus[] = ['pending', 'paid', 'preparing', 'shipped', 'delivered'];

export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'paid',
  paid: 'preparing',
  preparing: 'shipped',
  shipped: 'delivered',
};

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount?: number;
}

export interface Product {
  id: string;
  categoryId: string | null;
  category?: Category | null;
  name: string;
  description: string | null;
  priceCents: number;
  oldPriceCents: number | null;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  isFavorite?: boolean;
  rating?: number | null;
  reviewsCount?: number;
}

export interface CartLine {
  productId: string;
  name: string;
  imageUrl: string | null;
  unitPriceCents: number;
  oldPriceCents: number | null;
  quantity: number;
  stock: number;
  subtotalCents: number;
}

export interface CartDTO {
  items: CartLine[];
  itemCount: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  freeShipping: boolean;
}

export interface OrderItemDTO {
  id: string;
  productId: string | null;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
}

export interface TimelineEvent {
  status: OrderStatus;
  label: string;
  at: string;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  statusLabel?: string;
  cancelReason: string | null;
  totalCents: number;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingZip: string;
  paymentMethod: PaymentMethod;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  items?: OrderItemDTO[];
  timeline?: TimelineEvent[];
}

export interface CheckoutResult {
  order: Order;
  expiresAt: string;
  holdSecondsLeft: number;
}

export interface PayResult {
  order: Order;
  invoice: { qrSvg: string; invoiceNumber: string };
}

export interface InvoiceResult {
  qrSvg: string;
  invoiceNumber: string;
  html: string;
}

export interface ReviewDTO {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface AdminStats {
  products: number;
  categories: number;
  users: number;
  ordersToday: number;
  pendingHolds: number;
  revenueCents: number;
  lowStock: number;
  byStatus: Record<string, number>;
}

export function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}
