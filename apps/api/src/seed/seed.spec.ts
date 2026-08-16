import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
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
import { SeedModule } from './seed.module';
import { SeedService, DEMO_PASSWORD } from './seed.service';

describe('SeedService — datos demo consistentes (regla F)', () => {
  async function makeApp() {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [User, Category, Product, Cart, CartItem, Order, OrderItem, Review, Favorite, EmailLog],
          synchronize: true,
        } as any),
        SeedModule,
      ],
    }).compile();
    await moduleRef.get(SeedService).seed();
    return {
      users: moduleRef.get<Repository<User>>(getRepositoryToken(User)),
      products: moduleRef.get<Repository<Product>>(getRepositoryToken(Product)),
      categories: moduleRef.get<Repository<Category>>(getRepositoryToken(Category)),
      orders: moduleRef.get<Repository<Order>>(getRepositoryToken(Order)),
      orderItems: moduleRef.get<Repository<OrderItem>>(getRepositoryToken(OrderItem)),
      reviews: moduleRef.get<Repository<Review>>(getRepositoryToken(Review)),
      favorites: moduleRef.get<Repository<Favorite>>(getRepositoryToken(Favorite)),
      emailLogs: moduleRef.get<Repository<EmailLog>>(getRepositoryToken(EmailLog)),
    };
  }

  it('crea usuarios demo con roles correctos', async () => {
    const app = await makeApp();
    const users = await app.users.find();
    expect(users.length).toBe(3);
    const demo = users.find((u) => u.username === 'demo');
    const admin = users.find((u) => u.username === 'tendero');
    expect(demo?.email).toBe('demo@colmado.dev');
    expect(demo?.role).toBe('client');
    expect(admin?.role).toBe('admin');
  });

  it('el stock de los productos refleja los pedidos históricos (totales consistentes)', async () => {
    const app = await makeApp();
    const products = await app.products.find();
    const active = products.filter((p) => p.isActive);
    expect(active.length).toBe(15);

    // Aceite: seed 14 − 1 (pedido 1) − 2 (pedido 4) = 11
    const aceite = active.find((p) => p.name.startsWith('Aceite'));
    expect(aceite?.stock).toBe(11);
    // Pan: seed 1 − 1 (pedido 2) − 1 (pedido 3) = -1 → el seed lo fija en 1? No: pan tiene stock=1 y se resta 2 veces...
    // El seed resta pan.stock (1) − 1 (o2) y de nuevo − 1 (o3) — quedaría -1.
    // Verificamos el INVARIANTE: el stock nunca es negativo en el catálogo activo.
    for (const p of active) {
      expect(p.stock).toBeGreaterThanOrEqual(0);
    }
  });

  it('los pedidos demo suman exactamente sus items (lista ↔ detalle)', async () => {
    const app = await makeApp();
    const orders = await app.orders.find();
    expect(orders.length).toBe(5);
    for (const o of orders) {
      const items = await app.orderItems.find({ where: { orderId: o.id } });
      const sum = items.reduce((acc, i) => acc + i.subtotalCents, 0);
      expect(sum).toBe(o.totalCents);
    }
  });

  it('hay un pedido pending ACTIVO (retención futura) y uno VENCIDO (para el sweeper)', async () => {
    const app = await makeApp();
    const orders = await app.orders.find({ where: { status: 'pending' as any } });
    expect(orders.length).toBe(2);
    const now = Date.now();
    const active = orders.find((o) => new Date(o.expiresAt!).getTime() > now);
    const expired = orders.find((o) => new Date(o.expiresAt!).getTime() < now);
    expect(active).toBeTruthy();
    expect(expired).toBeTruthy();
  });

  it('genera reviews, favoritos y email logs de factura', async () => {
    const app = await makeApp();
    expect(await app.reviews.count()).toBe(3);
    expect(await app.favorites.count()).toBe(3);
    expect(await app.emailLogs.count()).toBe(1);
  });

  it('es idempotente: un segundo seed no duplica datos', async () => {
    const app = await makeApp();
    await app.users.manager.getRepository(User).count();
    const seedService = new SeedService(
      app.users,
      app.categories,
      app.products,
      app.users.manager.getRepository(Cart),
      app.users.manager.getRepository(CartItem),
      app.orders,
      app.orderItems,
      app.reviews,
      app.favorites,
      app.emailLogs,
    );
    await seedService.seed();
    expect(await app.users.count()).toBe(3);
    expect(await app.products.count()).toBe(16);
  });

  it('exporta la contraseña demo', () => {
    expect(DEMO_PASSWORD).toBe('colmado2026');
  });
});
