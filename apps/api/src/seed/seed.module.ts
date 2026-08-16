import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Category,
      Product,
      Cart,
      CartItem,
      Order,
      OrderItem,
      Review,
      Favorite,
      EmailLog,
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
