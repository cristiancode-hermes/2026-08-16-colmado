import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  Cart,
  CartItem,
  Category,
  EmailLog,
  Favorite,
  Order,
  OrderItem,
  Product,
  Review,
  User,
} from '../entities/entities';

export const DEMO_PASSWORD = 'colmado2026';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly cartItems: Repository<CartItem>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(EmailLog) private readonly emailLogs: Repository<EmailLog>,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    if ((await this.users.count()) > 0) return;

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    // Usuarios
    const demo = (await this.users.save({
      name: 'María la Vecina',
      email: 'demo@colmado.dev',
      username: 'demo',
      passwordHash,
      role: 'client',
    } as any)) as User;
    const admin = (await this.users.save({
      name: 'Don Pepe',
      email: 'tendero@colmado.dev',
      username: 'tendero',
      passwordHash,
      role: 'admin',
    } as any)) as User;
    const vecino2 = (await this.users.save({
      name: 'Carlos del 3º',
      email: 'carlos@colmado.dev',
      username: 'carlos',
      passwordHash,
      role: 'client',
    } as any)) as User;

    // Categorías
    const despensa = (await this.categories.save({
      name: 'Despensa',
      slug: 'despensa',
      description: 'Arroces, pastas, legumbres y conservas',
    } as any)) as Category;
    const panaderia = (await this.categories.save({
      name: 'Panadería',
      slug: 'panaderia',
      description: 'Pan del día y bollería',
    } as any)) as Category;
    const fruteria = (await this.categories.save({
      name: 'Frutería',
      slug: 'fruteria',
      description: 'Fruta y verdura fresca',
    } as any)) as Category;
    const hogar = (await this.categories.save({
      name: 'Hogar',
      slug: 'hogar',
      description: 'Limpieza y menaje',
    } as any)) as Category;

    // Productos — 16: 1 con stock=1 (doble venta), 2 con stock<=5 (stock bajo), 1 inactivo
    const productDefs = [
      {
        categoryId: despensa.id,
        name: 'Aceite de oliva virgen extra 1L',
        description: 'AOVE de la cooperativa del pueblo, prensado en frío. Suave y afrutado.',
        priceCents: 895,
        oldPriceCents: 1045,
        stock: 14,
        imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&q=80',
      },
      {
        categoryId: despensa.id,
        name: 'Arroz bomba 1kg',
        description: 'Arroz de grano redondo perfecto para paellas y arroces melosos.',
        priceCents: 320,
        stock: 25,
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&q=80',
      },
      {
        categoryId: despensa.id,
        name: 'Garbanzos de la abuela 800g',
        description: 'Legumbre de cosecha local, remojo rápido y textura mantecosa.',
        priceCents: 240,
        stock: 30,
        imageUrl: 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=800&q=80',
      },
      {
        categoryId: despensa.id,
        name: 'Tomate frito casero 720g',
        description: 'Tomate de la huerta cocinado a fuego lento con aceite de oliva.',
        priceCents: 285,
        stock: 18,
        imageUrl: 'https://images.unsplash.com/photo-1546470427-e26264be5b0d?w=800&q=80',
      },
      {
        categoryId: panaderia.id,
        name: 'Pan de pueblo (barra)',
        description: 'Masa madre, horneado cada mañana. Corteza crujiente y miga esponjosa.',
        priceCents: 150,
        stock: 3,
        imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80',
      },
      {
        categoryId: panaderia.id,
        name: 'Pan de molde integral',
        description: 'Pan de molde 100% integral, sin azúcares añadidos.',
        priceCents: 265,
        stock: 8,
        imageUrl: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=800&q=80',
      },
      {
        categoryId: panaderia.id,
        name: 'Magdalenas de la tía Ana (6 uds)',
        description: 'Receta familiar de magdalenas esponjosas con limón.',
        priceCents: 220,
        oldPriceCents: 260,
        stock: 12,
        imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&q=80',
      },
      {
        categoryId: fruteria.id,
        name: 'Plátanos de Canarias (kg)',
        description: 'Plátanos de pequeño tamaño, dulces y cremosos.',
        priceCents: 195,
        stock: 20,
        imageUrl: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=800&q=80',
      },
      {
        categoryId: fruteria.id,
        name: 'Manzanas golden (kg)',
        description: 'Manzanas golden crujientes de temporada.',
        priceCents: 210,
        stock: 15,
        imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&q=80',
      },
      {
        categoryId: fruteria.id,
        name: 'Naranjas de zumo (kg)',
        description: 'Naranjas de Valencia, ideales para zumo natural.',
        priceCents: 180,
        stock: 4,
        imageUrl: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=800&q=80',
      },
      {
        categoryId: fruteria.id,
        name: 'Aguacates hass (2 uds)',
        description: 'Aguacates en punto óptimo de maduración.',
        priceCents: 340,
        oldPriceCents: 390,
        stock: 3,
        imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=800&q=80',
      },
      {
        categoryId: hogar.id,
        name: 'Detergente lavadora 2L',
        description: 'Detergente concentrado para ropa, aroma a limón.',
        priceCents: 495,
        stock: 10,
        imageUrl: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&q=80',
      },
      {
        categoryId: hogar.id,
        name: 'Papel de cocina (2 rollos)',
        description: 'Papel absorbente de doble hoja.',
        priceCents: 185,
        stock: 22,
        imageUrl: 'https://images.unsplash.com/photo-1605625848532-044b8d392ced?w=800&q=80',
      },
      {
        categoryId: hogar.id,
        name: 'Esponja de cocina (3 uds)',
        description: 'Esponjas multiusos con estropajo.',
        priceCents: 140,
        stock: 16,
        imageUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80',
      },
      {
        categoryId: hogar.id,
        name: 'Velas aromáticas (2 uds)',
        description: 'Velas de vainilla para tardes de sofá.',
        priceCents: 380,
        stock: 6,
        imageUrl: 'https://images.unsplash.com/photo-1602874801006-26c4c5f8a4c4?w=800&q=80',
      },
      // Inactivo — no visible en catálogo
      {
        categoryId: hogar.id,
        name: 'Café molido (retirado)',
        description: 'Producto retirado del catálogo.',
        priceCents: 450,
        stock: 0,
        isActive: false,
        imageUrl: null,
      },
    ];
    const products: Product[] = [];
    for (const def of productDefs) {
      products.push((await this.products.save(def as any)) as Product);
    }

    const aceite = products[0];
    const arroz = products[1];
    const pan = products[4];
    const magdalenas = products[6];
    const naranjas = products[9];
    const aguacates = products[10];

    // Carrito de demo con 2 líneas (para probar checkout)
    const cart = (await this.carts.save({ userId: demo.id } as any)) as Cart;
    await this.cartItems.save([
      { cartId: cart.id, productId: aceite.id, quantity: 2 },
      { cartId: cart.id, productId: pan.id, quantity: 1 },
    ] as any);

    // Pedidos de demo — 3 pagados + 1 pending activo (expira +10min) + 1 pending VENCIDO (sweeper)
    const now = new Date();
    const num = (i: number) => `2026-0816-${String(i).padStart(4, '0')}`;

    // Pedido 1: pagado y entregado (histórico, hace 8 días)
    const o1 = (await this.orders.save({
      userId: demo.id,
      number: num(1),
      status: 'delivered',
      totalCents: 1735,
      shippingName: 'María García',
      shippingAddress: 'Calle del Sol 12, 3ºB',
      shippingCity: 'Madrid',
      shippingZip: '28012',
      paymentMethod: 'card',
      paidAt: new Date(now.getTime() - 8 * 86400000),
      createdAt: new Date(now.getTime() - 8 * 86400000),
      expiresAt: new Date(now.getTime() - 8 * 86400000 + 15 * 60000),
    } as any)) as Order;
    await this.orderItems.save([
      { orderId: o1.id, productId: aceite.id, productName: aceite.name, unitPriceCents: 895, quantity: 1, subtotalCents: 895 },
      { orderId: o1.id, productId: magdalenas.id, productName: magdalenas.name, unitPriceCents: 220, quantity: 3, subtotalCents: 660 },
      { orderId: o1.id, productId: naranjas.id, productName: naranjas.name, unitPriceCents: 180, quantity: 1, subtotalCents: 180 },
    ] as any);
    // stock fue consumido por el pedido histórico: bajar del seed base
    aceite.stock = aceite.stock - 1;
    magdalenas.stock = magdalenas.stock - 3;
    naranjas.stock = naranjas.stock - 1;
    await this.products.save([aceite, magdalenas, naranjas] as any);

    // Pedido 2: pagado y en camino (hace 2 días)
    const o2 = (await this.orders.save({
      userId: demo.id,
      number: num(2),
      status: 'shipped',
      totalCents: 490,
      shippingName: 'María García',
      shippingAddress: 'Calle del Sol 12, 3ºB',
      shippingCity: 'Madrid',
      shippingZip: '28012',
      paymentMethod: 'cod',
      paidAt: new Date(now.getTime() - 2 * 86400000),
      createdAt: new Date(now.getTime() - 2 * 86400000),
      expiresAt: new Date(now.getTime() - 2 * 86400000 + 15 * 60000),
    } as any)) as Order;
    await this.orderItems.save([
      { orderId: o2.id, productId: aguacates.id, productName: aguacates.name, unitPriceCents: 340, quantity: 1, subtotalCents: 340 },
      { orderId: o2.id, productId: pan.id, productName: pan.name, unitPriceCents: 150, quantity: 1, subtotalCents: 150 },
    ] as any);
    aguacates.stock = aguacates.stock - 1;
    pan.stock = pan.stock - 1;
    await this.products.save([aguacates, pan] as any);

    // Pedido 3: pagado, preparando (hoy)
    const o3 = (await this.orders.save({
      userId: demo.id,
      number: num(3),
      status: 'preparing',
      totalCents: 150,
      shippingName: 'María García',
      shippingAddress: 'Calle del Sol 12, 3ºB',
      shippingCity: 'Madrid',
      shippingZip: '28012',
      paymentMethod: 'card',
      paidAt: new Date(now.getTime() - 3600000),
      createdAt: new Date(now.getTime() - 3600000),
      expiresAt: new Date(now.getTime() - 3600000 + 15 * 60000),
    } as any)) as Order;
    await this.orderItems.save([
      { orderId: o3.id, productId: pan.id, productName: pan.name, unitPriceCents: 150, quantity: 1, subtotalCents: 150 },
    ] as any);
    pan.stock = pan.stock - 1;
    await this.products.save(pan as any);

    // Pedido 4: pending ACTIVO — expira en +10 min (contador)
    const o4 = (await this.orders.save({
      userId: demo.id,
      number: num(4),
      status: 'pending',
      totalCents: 1790,
      shippingName: 'María García',
      shippingAddress: 'Calle del Sol 12, 3ºB',
      shippingCity: 'Madrid',
      shippingZip: '28012',
      paymentMethod: 'card',
      expiresAt: new Date(now.getTime() + 10 * 60000),
      createdAt: new Date(now.getTime() - 5 * 60000),
    } as any)) as Order;
    await this.orderItems.save([
      { orderId: o4.id, productId: aceite.id, productName: aceite.name, unitPriceCents: 895, quantity: 2, subtotalCents: 1790 },
    ] as any);
    aceite.stock = aceite.stock - 2;
    await this.products.save(aceite as any);

    // Pedido 5: pending VENCIDO — para el sweeper (30s)
    const o5 = (await this.orders.save({
      userId: vecino2.id,
      number: num(5),
      status: 'pending',
      totalCents: 320,
      shippingName: 'Carlos Ruiz',
      shippingAddress: 'Av. de la Paz 45, 1ºA',
      shippingCity: 'Madrid',
      shippingZip: '28015',
      paymentMethod: 'card',
      expiresAt: new Date(now.getTime() - 5 * 60000),
      createdAt: new Date(now.getTime() - 30 * 60000),
    } as any)) as Order;
    await this.orderItems.save([
      { orderId: o5.id, productId: arroz.id, productName: arroz.name, unitPriceCents: 320, quantity: 1, subtotalCents: 320 },
    ] as any);
    arroz.stock = arroz.stock - 1;
    await this.products.save(arroz as any);

    // Reseñas (demo sobre aceite y magdalenas)
    await this.reviews.save([
      { productId: aceite.id, userId: demo.id, rating: 5, comment: 'El aceite de la cooperativa es de otro nivel. Llega siempre fresco.' },
      { productId: aceite.id, userId: vecino2.id, rating: 4, comment: 'Muy buen precio y calidad. El reparto a casa, un lujo.' },
      { productId: magdalenas.id, userId: demo.id, rating: 5, comment: 'Las magdalenas de la tía Ana no fallan: esponjosas y con sabor a limón de verdad.' },
    ] as any);

    // Favoritos demo
    await this.favorites.save([
      { userId: demo.id, productId: aceite.id },
      { userId: demo.id, productId: magdalenas.id },
      { userId: demo.id, productId: aguacates.id },
    ] as any);

    // EmailLog de factura del pedido 2
    await this.emailLogs.save({
      orderId: o2.id,
      toEmail: demo.email,
      type: 'invoice',
    } as any);

    console.log(
      `🌿 Colmado seed: ${demo.username}/${DEMO_PASSWORD} (client), ${admin.username}/${DEMO_PASSWORD} (admin), 15 productos, 5 pedidos`,
    );
  }
}
