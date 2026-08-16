import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Favorite, Product, Review } from '../entities/entities';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
  ) {}

  async list(userId: string): Promise<Product[]> {
    const favs = await this.favorites.find({ where: { userId } });
    const ids = favs.map((f) => f.productId);
    if (!ids.length) return [];
    const products = await this.products.find({
      where: { id: In(ids), isActive: true },
      relations: { category: true },
    });
    for (const p of products) {
      p.isFavorite = true;
      const agg = await this.reviews
        .createQueryBuilder('r')
        .select('COALESCE(AVG(r.rating), 0)', 'avg')
        .addSelect('COUNT(r.id)', 'count')
        .where('r.productId = :id', { id: p.id })
        .getRawOne();
      p.ratingAvg = Math.round(Number(agg?.avg ?? 0) * 10) / 10;
      p.reviewCount = Number(agg?.count ?? 0);
    }
    return products;
  }

  async add(userId: string, productId: string): Promise<{ added: boolean }> {
    const product = await this.products.findOneBy({ id: productId });
    if (!product) throw new Error('Producto no encontrado');
    const existing = await this.favorites.findOneBy({ userId, productId });
    if (!existing) {
      await this.favorites.save(this.favorites.create({ userId, productId } as any));
    }
    return { added: true };
  }

  async remove(userId: string, productId: string): Promise<{ removed: boolean }> {
    await this.favorites.delete({ userId, productId });
    return { removed: true };
  }
}
