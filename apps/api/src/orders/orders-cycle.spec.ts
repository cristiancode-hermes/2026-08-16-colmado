import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartItem, Category, EmailLog, Order, OrderItem, Product, User } from '../entities/entities';
import { CartService } from '../cart/cart.service';
import { OrdersModule } from './orders.module';
import { OrdersService, generateQrSvg } from './orders.service';

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
  const p = await products.save({ categoryId: cat.id, name: 'Aceite', priceCents: 500, stock: 10, isActive: true } as any);

  const makeOrder = async () => {
    await cartService.addItem(user.id, p.id, 1);
    return cartService.checkout(user.id, {
      shippingName: 'Test', shippingAddress: 'Calle 1', shippingCity: 'Madrid', shippingZip: '28001', paymentMethod: 'card',
    });
  };

  return { ordersService, cartService, users, products, user, p, makeOrder };
}

describe('OrdersService — ciclo transaccional y factura (regla A/E)', () => {
  it('pay convierte pending→paid, genera QR y EmailLog de factura', async () => {
    const app = await makeApp();
    const { order } = await app.makeOrder();
    expect(order.status).toBe('pending');

    const result = await app.ordersService.pay(app.user.id, order.id);
    expect(result.order.status).toBe('paid');
    expect(result.order.paidAt).toBeTruthy();
    expect(result.invoice.invoiceNumber).toBe(order.number);
    expect(result.invoice.qrSvg).toContain('<svg');
    expect(result.invoice.qrSvg).toContain('width=');
  });

  it('generateQrSvg es determinista: mismo seed → mismo SVG', () => {
    const a = generateQrSvg('COL-1|123');
    const b = generateQrSvg('COL-1|123');
    expect(a).toBe(b);
    expect(generateQrSvg('COL-1|999')).not.toBe(a);
  });

  it('la factura solo está disponible después del pago', async () => {
    const app = await makeApp();
    const { order } = await app.makeOrder();
    await expect(app.ordersService.invoice(app.user.id, order.id)).rejects.toThrow(ConflictException);
  });

  it('advanceStatus respeta la máquina: paid→delivered es inválido, paid→preparing válido', async () => {
    const app = await makeApp();
    const { order } = await app.makeOrder();
    await app.ordersService.pay(app.user.id, order.id);
    await expect(app.ordersService.advanceStatus(order.id, 'delivered')).rejects.toThrow(BadRequestException);

    const preparing = await app.ordersService.advanceStatus(order.id, 'preparing');
    expect(preparing.status).toBe('preparing');
    const shipped = await app.ordersService.advanceStatus(order.id, 'shipped');
    expect(shipped.status).toBe('shipped');
    const delivered = await app.ordersService.advanceStatus(order.id, 'delivered');
    expect(delivered.status).toBe('delivered');
  });

  it('cancel de pedido paid restaura stock y registra reembolso', async () => {
    const app = await makeApp();
    const { order } = await app.makeOrder();
    await app.ordersService.pay(app.user.id, order.id);
    const stockBefore = (await app.products.findOneBy({ id: app.p.id }))?.stock ?? 0;

    const cancelled = await app.ordersService.cancel(app.user.id, order.id);
    expect(cancelled.status).toBe('cancelled');
    const stockAfter = (await app.products.findOneBy({ id: app.p.id }))?.stock ?? 0;
    expect(stockAfter).toBe(stockBefore + 1);
  });

  it('cancel de pedido en preparing lanza ConflictException', async () => {
    const app = await makeApp();
    const { order } = await app.makeOrder();
    await app.ordersService.pay(app.user.id, order.id);
    await app.ordersService.advanceStatus(order.id, 'preparing');
    await expect(app.ordersService.cancel(app.user.id, order.id)).rejects.toThrow(ConflictException);
  });
});
