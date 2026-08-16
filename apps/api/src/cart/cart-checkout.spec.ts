import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartItem, Category, EmailLog, Order, OrderItem, Product, User } from '../entities/entities';
import { CartService, HOLD_MINUTES } from './cart.service';
import { OrdersModule } from '../orders/orders.module';
import { OrdersService } from '../orders/orders.service';

/** Harness: base SQLite :memory: con el dominio completo. */
async function makeApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: [User, Category, Product, Cart, CartItem, Order, OrderItem, EmailLog],
        synchronize: true,
      } as any),
      TypeOrmModule.forFeature([User, Category, Product, Cart, CartItem, Order, OrderItem, EmailLog]),
      OrdersModule,
    ],
    providers: [CartService],
  }).compile();
  const users = moduleRef.get<Repository<User>>(getRepositoryToken(User));
  const products = moduleRef.get<Repository<Product>>(getRepositoryToken(Product));
  const categories = moduleRef.get<Repository<Category>>(getRepositoryToken(Category));
  const cartService = moduleRef.get(CartService);
  const ordersService = moduleRef.get(OrdersService);

  const cat = await categories.save({ name: 'Despensa', slug: 'despensa' } as any);
  const user = await users.save({ name: 'Test', email: 't@t.dev', username: 'test', passwordHash: 'x', role: 'client' } as any);

  const makeProduct = (stock: number, price = 100) =>
    products.save({ categoryId: cat.id, name: `Prod ${Math.random().toString(36).slice(2, 7)}`, priceCents: price, stock, isActive: true } as any);

  return { cartService, ordersService, users, products, user, makeProduct };
}

describe('Carrito y checkout transaccional (regla D: bloqueo doble venta)', () => {
  it('checkout crea pedido pending con retención y decrementa stock', async () => {
    const app = await makeApp();
    const p = await app.makeProduct(5, 200);
    await app.cartService.addItem(app.user.id, p.id, 2);

    const result = await app.cartService.checkout(app.user.id, {
      shippingName: 'Test User',
      shippingAddress: 'Calle 1',
      shippingCity: 'Madrid',
      shippingZip: '28001',
      paymentMethod: 'card',
    });

    expect(result.order.status).toBe('pending');
    expect(result.order.totalCents).toBe(400);
    expect(result.order.items?.length ?? 0).toBeGreaterThanOrEqual(0);
    // expiresAt calculado EN SERVIDOR (regla B)
    expect(result.expiresAt.getTime() - Date.now()).toBeGreaterThan((HOLD_MINUTES - 1) * 60_000);
    expect(result.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(HOLD_MINUTES * 60_000 + 5_000);
    expect(result.holdSecondsLeft).toBe(HOLD_MINUTES * 60);
    // stock decrementado en la misma transacción
    const after = await app.products.findOneBy({ id: p.id });
    expect(after?.stock).toBe(3);
  });

  it('checkout con stock insuficiente lanza ConflictException (409) y NO crea pedido', async () => {
    const app = await makeApp();
    const p = await app.makeProduct(1, 100);
    await app.cartService.addItem(app.user.id, p.id, 1);
    // un segundo usuario agota el stock
    const user2 = await app.users.save({ name: 'U2', email: 'u2@t.dev', username: 'u2', passwordHash: 'x', role: 'client' } as any);
    await app.cartService.addItem(user2.id, p.id, 1);
    await app.cartService.checkout(user2.id, {
      shippingName: 'U2', shippingAddress: 'Calle 2', shippingCity: 'Madrid', shippingZip: '28002', paymentMethod: 'card',
    });

    await expect(
      app.cartService.checkout(app.user.id, {
        shippingName: 'Test', shippingAddress: 'Calle 1', shippingCity: 'Madrid', shippingZip: '28001', paymentMethod: 'card',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('checkout con carrito vacío lanza BadRequestException', async () => {
    const app = await makeApp();
    await expect(
      app.cartService.checkout(app.user.id, {
        shippingName: 'T', shippingAddress: 'C', shippingCity: 'M', shippingZip: '28001', paymentMethod: 'cod',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('addItem añade línea y suma cantidades del mismo producto', async () => {
    const app = await makeApp();
    const p = await app.makeProduct(10, 150);
    await app.cartService.addItem(app.user.id, p.id, 1);
    await app.cartService.addItem(app.user.id, p.id, 2);
    const cart = await app.cartService.getCart(app.user.id);
    expect(cart.itemCount).toBe(3);
    expect(cart.subtotalCents).toBe(450);
    expect(cart.items[0].quantity).toBe(3);
  });

  it('updateQty por encima del stock lanza ConflictException con max', async () => {
    const app = await makeApp();
    const p = await app.makeProduct(2, 100);
    await app.cartService.addItem(app.user.id, p.id, 1);
    try {
      await app.cartService.updateQty(app.user.id, p.id, 99);
      fail('debería lanzar ConflictException');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as any).response.max).toBe(2);
    }
  });

  it('addItem con stock 0 lanza BadRequestException (agotado)', async () => {
    const app = await makeApp();
    const p = await app.makeProduct(0);
    await expect(app.cartService.addItem(app.user.id, p.id, 1)).rejects.toThrow(BadRequestException);
  });

  it('removeItem y clear vacían el carrito correctamente', async () => {
    const app = await makeApp();
    const p1 = await app.makeProduct(5);
    const p2 = await app.makeProduct(5);
    await app.cartService.addItem(app.user.id, p1.id, 1);
    await app.cartService.addItem(app.user.id, p2.id, 2);
    await app.cartService.removeItem(app.user.id, p1.id);
    let cart = await app.cartService.getCart(app.user.id);
    expect(cart.itemCount).toBe(2);
    await app.cartService.clear(app.user.id);
    cart = await app.cartService.getCart(app.user.id);
    expect(cart.itemCount).toBe(0);
    expect(cart.totalCents).toBe(0);
  });

  it('expireStale libera la retención: cancela pending vencidos y restaura stock (regla C)', async () => {
    const app = await makeApp();
    const p = await app.makeProduct(4, 100);
    await app.cartService.addItem(app.user.id, p.id, 2);
    const { order } = await app.cartService.checkout(app.user.id, {
      shippingName: 'T', shippingAddress: 'C', shippingCity: 'M', shippingZip: '28001', paymentMethod: 'card',
    });
    // forzar expiración
    const orders = app.ordersService as any;
    const repo = app.cartService as any;
    const orderRepo = repo.orders;
    await orderRepo.update(order.id, { expiresAt: new Date(Date.now() - 60_000) });

    const expired = await orders.expireStale();
    expect(expired).toBe(1);

    const after = await orderRepo.findOneBy({ id: order.id });
    expect(after?.status).toBe('cancelled');
    expect(after?.cancelReason).toBe('EXPIRED_HOLD');
    // stock restaurado
    const product = await app.products.findOneBy({ id: p.id });
    expect(product?.stock).toBe(4);
  });

  it('expireStale no toca pedidos pending NO vencidos', async () => {
    const app = await makeApp();
    const p = await app.makeProduct(4, 100);
    await app.cartService.addItem(app.user.id, p.id, 1);
    await app.cartService.checkout(app.user.id, {
      shippingName: 'T', shippingAddress: 'C', shippingCity: 'M', shippingZip: '28001', paymentMethod: 'card',
    });
    const orders = app.ordersService as any;
    const n = await orders.expireStale();
    expect(n).toBe(0);
  });

  it('pagar una retención vencida lanza ConflictException y libera stock', async () => {
    const app = await makeApp();
    const p = await app.makeProduct(3, 100);
    await app.cartService.addItem(app.user.id, p.id, 1);
    const { order } = await app.cartService.checkout(app.user.id, {
      shippingName: 'T', shippingAddress: 'C', shippingCity: 'M', shippingZip: '28001', paymentMethod: 'card',
    });
    const orderRepo = (app.cartService as any).orders as Repository<Order>;
    await orderRepo.update(order.id, { expiresAt: new Date(Date.now() - 60_000) });

    await expect(app.ordersService.pay(app.user.id, order.id)).rejects.toThrow(ConflictException);
    const after = await orderRepo.findOneBy({ id: order.id });
    expect(after?.status).toBe('cancelled');
    const product = await app.products.findOneBy({ id: p.id });
    expect(product?.stock).toBe(3);
  });
});
