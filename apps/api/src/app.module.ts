import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
} from './entities/entities';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FavoritesModule } from './favorites/favorites.module';
import { AdminModule } from './admin/admin.module';
import { SeedModule } from './seed/seed.module';
import { SweeperService } from './sweeper/sweeper.service';

const ALL_ENTITIES = [User, Category, Product, Cart, CartItem, Order, OrderItem, Review, Favorite, EmailLog];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbType = config.get<string>('DATABASE_TYPE', 'better-sqlite3');
        if (dbType === 'postgres') {
          return {
            type: 'postgres',
            url: config.get<string>('DATABASE_URL'),
            entities: ALL_ENTITIES,
            synchronize: true,
            ssl: { rejectUnauthorized: false },
          } as any;
        }
        return {
          type: 'better-sqlite3',
          database: config.get<string>('DATABASE_PATH', 'data/colmado.db'),
          entities: ALL_ENTITIES,
          synchronize: true,
        } as any;
      },
    }),
    AuthModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    ReviewsModule,
    FavoritesModule,
    AdminModule,
    SeedModule,
  ],
  providers: [SweeperService],
})
export class AppModule {}
