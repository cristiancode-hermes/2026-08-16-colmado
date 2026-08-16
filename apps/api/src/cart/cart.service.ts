import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cart, CartItem, Order, OrderItem, Product, User } from '../entities/entities';
import { ORDER_STATUS_LABELS } from '../entities/entities';

export const HOLD_MINUTES = 15;
export const FREE_SHIPPING_CENTS = 5000;
export const SHIPPING_CENTS = 299;

export interface CartLineDTO {
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
  items: CartLineDTO[];
  itemCount: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  freeShipping: boolean;
}

@Injectable()
export class CartService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private async getOrCreateCart(userId: string): Promise<Cart> {
    const cart = await this.carts.findOneBy({ userId });
    if (cart) return cart;
    const created = await this.carts.save({ userId } as any);
    return created;
  }

  async getCart(userId: string): Promise<CartDTO> {
    const cart = await this.getOrCreateCart(userId);
    const rows = await this.items.find({
      where: { cartId: cart.id },
      relations: { product: true },
      order: { product: { name: 'ASC' } },
    });
    return this.buildDTO(rows);
  }

  private buildDTO(rows: CartItem[]): CartDTO {
    let subtotal = 0;
    let itemCount = 0;
    const items: CartLineDTO[] = [];
    for (const row of rows) {
      if (!row.product) continue;
      const line: CartLineDTO = {
        productId: row.productId,
        name: row.product.name,
        imageUrl: row.product.imageUrl,
        unitPriceCents: row.product.priceCents,
        oldPriceCents: row.product.oldPriceCents,
        quantity: row.quantity,
        stock: row.product.stock,
        subtotalCents: row.product.priceCents * row.quantity,
      };
      subtotal += line.subtotalCents;
      itemCount += row.quantity;
      items.push(line);
    }
    const shippingCents = subtotal === 0 || subtotal >= FREE_SHIPPING_CENTS ? 0 : SHIPPING_CENTS;
    return {
      items,
      itemCount,
      subtotalCents: subtotal,
      shippingCents,
      totalCents: subtotal + shippingCents,
      freeShipping: subtotal >= FREE_SHIPPING_CENTS,
    };
  }

  async addItem(userId: string, productId: string, quantity: number): Promise<CartDTO> {
    const qty = Math.max(1, Math.floor(quantity || 1));
    const product = await this.products.findOneBy({ id: productId });
    if (!product || !product.isActive) throw new NotFoundException('Producto no encontrado');
    if (product.stock <= 0) throw new BadRequestException('Este producto está agotado');
    const clamped = Math.min(qty, product.stock);
    const cart = await this.getOrCreateCart(userId);
    const existing = await this.items.findOneBy({ cartId: cart.id, productId });
    if (existing) {
      existing.quantity = Math.min(existing.quantity + qty, product.stock);
      await this.items.save(existing);
    } else {
      await this.items.save({ cartId: cart.id, productId, quantity: clamped } as any);
    }
    return this.getCart(userId);
  }

  async updateQty(userId: string, productId: string, quantity: number): Promise<CartDTO> {
    const cart = await this.getOrCreateCart(userId);
    const existing = await this.items.findOneBy({ cartId: cart.id, productId });
    if (!existing) throw new NotFoundException('El producto no está en el carrito');
    const product = await this.products.findOneBy({ id: productId });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const qty = Math.max(1, Math.floor(quantity || 1));
    if (qty > product.stock) {
      existing.quantity = product.stock;
      await this.items.save(existing);
      throw new ConflictException({ message: `Solo quedan ${product.stock} de ${product.name}`, max: product.stock });
    }
    existing.quantity = qty;
    await this.items.save(existing);
    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string): Promise<CartDTO> {
    const cart = await this.getOrCreateCart(userId);
    await this.items.delete({ cartId: cart.id, productId });
    return this.getCart(userId);
  }

  async clear(userId: string): Promise<{ cleared: boolean }> {
    const cart = await this.getOrCreateCart(userId);
    await this.items.delete({ cartId: cart.id });
    return { cleared: true };
  }

  /**
   * Checkout transaccional — bloqueo de doble venta (regla D).
   * FOR UPDATE sobre las filas de producto (orden estable → sin deadlocks),
   * crea Order(pending) con expiresAt = now + 15min, snapshot de ítems,
   * decrementa stock y vacía el carrito en la MISMA transacción.
   */
  async checkout(
    userId: string,
    dto: {
      shippingName: string;
      shippingAddress: string;
      shippingCity: string;
      shippingZip: string;
      paymentMethod: 'card' | 'cod';
    },
  ): Promise<{ order: Order; expiresAt: Date; holdSecondsLeft: number }> {
    if (!dto.shippingName?.trim() || !dto.shippingAddress?.trim() || !dto.shippingCity?.trim() || !dto.shippingZip?.trim()) {
      throw new BadRequestException('Completa todos los datos de envío');
    }
    const cart = await this.getOrCreateCart(userId);

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager
        .getRepository(CartItem)
        .find({ where: { cartId: cart.id }, relations: { product: true } });

      if (!rows.length) throw new BadRequestException('El carrito está vacío');

      const productIds = [...new Set(rows.map((r) => r.productId))].sort();
      // 1. Bloquear las filas de producto (FOR UPDATE — solo drivers que lo soportan;
      //    SQLite serializa transacciones de escritura por sí mismo, mutex + validación cubren el resto)
      const supportsLock = this.dataSource.options.type !== 'better-sqlite3';
      const locked: Product[] = [];
      for (const id of productIds) {
        const qb = manager
          .getRepository(Product)
          .createQueryBuilder('p')
          .where('p.id = :id', { id });
        const p = supportsLock ? await qb.setLock('pessimistic_write').getOne() : await qb.getOne();
        if (p) locked.push(p);
      }
      const stockMap = new Map(locked.map((p) => [p.id, p]));

      // 2. Validar stock (409 con detalle por ítem si falta)
      const missing: { productId: string; name: string; requested: number; available: number }[] = [];
      for (const row of rows) {
        const product = stockMap.get(row.productId);
        if (!product || product.stock < row.quantity) {
          missing.push({
            productId: row.productId,
            name: product?.name ?? row.productId,
            requested: row.quantity,
            available: product?.stock ?? 0,
          });
        }
      }
      if (missing.length) {
        throw new ConflictException({ message: 'Stock insuficiente', items: missing });
      }

      // 3. Crear pedido pending con retención
      const number = await this.nextOrderNumber(manager);
      const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
      const totalCents = rows.reduce((acc, r) => acc + r.product.priceCents * r.quantity, 0);
      const order = await manager.getRepository(Order).save({
        userId,
        number,
        status: 'pending',
        totalCents,
        shippingName: dto.shippingName.trim(),
        shippingAddress: dto.shippingAddress.trim(),
        shippingCity: dto.shippingCity.trim(),
        shippingZip: dto.shippingZip.trim(),
        paymentMethod: dto.paymentMethod || 'card',
        expiresAt,
      } as any);

      // 4. Snapshot de ítems
      for (const row of rows) {
        await manager.getRepository(OrderItem).save({
          orderId: order.id,
          productId: row.productId,
          productName: row.product.name,
          unitPriceCents: row.product.priceCents,
          quantity: row.quantity,
          subtotalCents: row.product.priceCents * row.quantity,
        } as any);
      }

      // 5. Decrementar stock (CHECK stock>=0 como red de seguridad)
      for (const row of rows) {
        await manager
          .getRepository(Product)
          .createQueryBuilder()
          .update(Product)
          .set({ stock: () => `stock - ${row.quantity}` })
          .where('id = :id', { id: row.productId })
          .execute();
      }

      // 6. Vaciar carrito
      await manager.getRepository(CartItem).delete({ cartId: cart.id });

      return {
        order: { ...order, statusLabel: ORDER_STATUS_LABELS[order.status] } as unknown as Order,
        expiresAt,
        holdSecondsLeft: HOLD_MINUTES * 60,
      };
    });
  }

  private async nextOrderNumber(manager: import('typeorm').EntityManager): Promise<string> {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mmdd = `${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
    const prefix = `${yyyy}-${mmdd}-`;
    const last = (await manager
      .getRepository(Order)
      .createQueryBuilder('o')
      .select('o.number', 'number')
      .where('o.number LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('o.number', 'DESC')
      .getRawOne()) as { number: string } | undefined;
    let seq = 1;
    if (last) {
      const parts = last.number.split('-');
      seq = Number(parts[parts.length - 1]) + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
