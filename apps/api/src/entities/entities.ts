import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

export type UserRole = 'client' | 'admin';
export type OrderStatus = 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentMethod = 'card' | 'cod';

/** Etiqueta ES SIEMPRE derivada del enum en el frontend — nunca se guarda. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Reservado',
  paid: 'Pagado',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const ORDER_FLOW: OrderStatus[] = ['pending', 'paid', 'preparing', 'shipped', 'delivered'];

/** Transiciones válidas de la máquina de estados del pedido. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['preparing', 'cancelled'],
  preparing: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ unique: true, length: 190 })
  email: string;

  @Column({ unique: true, length: 60 })
  username: string;

  @Exclude()
  @Column({ length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', default: 'client' })
  role: UserRole;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80 })
  name: string;

  @Column({ unique: true, length: 90 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  productCount?: number;
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category | null;

  @Column({ type: 'varchar', nullable: true })
  categoryId: string | null;

  @Column({ length: 140 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  priceCents: number;

  @Column({ type: 'int', nullable: true })
  oldPriceCents: number | null;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  ratingAvg?: number;
  reviewCount?: number;
  isFavorite?: boolean;
}

@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;
}

@Entity('cart_items')
@Unique(['cartId', 'productId'])
export class CartItem {
  @PrimaryColumn()
  cartId: string;

  @PrimaryColumn()
  productId: string;

  @ManyToOne(() => Cart, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cartId' })
  cart: Cart;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int' })
  quantity: number;
}

@Entity('orders')
@Index(['userId', 'createdAt'])
@Index(['status', 'expiresAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ unique: true, length: 24 })
  number: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  cancelReason: string;

  @Column({ type: 'int' })
  totalCents: number;

  @Column({ length: 120 })
  shippingName: string;

  @Column({ length: 200 })
  shippingAddress: string;

  @Column({ length: 80 })
  shippingCity: string;

  @Column({ length: 10 })
  shippingZip: string;

  @Column({ type: 'varchar', default: 'card' })
  paymentMethod: PaymentMethod;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @OneToMany(() => OrderItem, (oi) => oi.order)
  items?: OrderItem[];
  timeline?: OrderTimelineEvent[];
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: string;

  @Column({ type: 'varchar', nullable: true })
  productId: string | null;

  @Column({ length: 140 })
  productName: string;

  @Column({ type: 'int' })
  unitPriceCents: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  subtotalCents: number;
}

@Entity('reviews')
@Unique(['productId', 'userId'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  productId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ length: 500 })
  comment: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  userName?: string;
}

@Entity('favorites')
export class Favorite {
  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  productId: string;
}

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: string;

  @Column({ length: 190 })
  toEmail: string;

  @Column({ length: 30, default: 'invoice' })
  type: string;

  @CreateDateColumn({ type: 'datetime' })
  sentAt: Date;
}

export interface OrderTimelineEvent {
  status: OrderStatus;
  label: string;
  at: string;
}
