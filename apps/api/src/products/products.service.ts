import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Category, Favorite, Product, Review } from '../entities/entities';

export interface ProductFilters {
  category?: string;
  q?: string;
  orden?: string;
  ofertas?: string;
  stockBajo?: string;
  userId?: string;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly repo: Repository<Product>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  async list(filters: ProductFilters = {}): Promise<Product[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .where('p.isActive = :active', { active: true })
      .addSelect((sub) => {
        return sub
          .select('COALESCE(AVG(r.rating), 0)', 'ratingAvg')
          .from(Review, 'r')
          .where('r.productId = p.id');
      }, 'ratingAvg')
      .addSelect((sub) => {
        return sub
          .select('COUNT(r.id)', 'reviewCount')
          .from(Review, 'r')
          .where('r.productId = p.id');
      }, 'reviewCount');

    if (filters.category) {
      qb.andWhere('p.categoryId = :cat', { cat: filters.category });
    }
    if (filters.q) {
      qb.andWhere('LOWER(p.name) LIKE :q', { q: `%${filters.q.toLowerCase()}%` });
    }
    if (filters.ofertas === 'true') {
      qb.andWhere('p.oldPriceCents IS NOT NULL');
    }
    if (filters.stockBajo === 'true') {
      qb.andWhere('p.stock <= 5');
    }
    if (filters.orden === 'precio-asc') qb.orderBy('p.priceCents', 'ASC');
    else if (filters.orden === 'precio-desc') qb.orderBy('p.priceCents', 'DESC');
    else if (filters.orden === 'novedad') qb.orderBy('p.createdAt', 'DESC');
    else if (filters.orden === 'valoracion') qb.orderBy('"ratingAvg"', 'DESC');
    else qb.orderBy('p.name', 'ASC');

    const products = await qb.getMany();

    if (filters.userId) {
      const favs = await this.favorites.findBy({ userId: filters.userId });
      const favSet = new Set(favs.map((f) => f.productId));
      for (const p of products) p.isFavorite = favSet.has(p.id);
    }
    return products;
  }

  async findOne(id: string, userId?: string): Promise<Product> {
    const product = await this.repo.findOne({
      where: { id, isActive: true },
      relations: { category: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const agg = await this.reviews
      .createQueryBuilder('r')
      .select('COALESCE(AVG(r.rating), 0)', 'avg')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.productId = :id', { id })
      .getRawOne();
    product.ratingAvg = Math.round(Number(agg?.avg ?? 0) * 10) / 10;
    product.reviewCount = Number(agg?.count ?? 0);
    if (userId) {
      product.isFavorite = !!(await this.favorites.findOneBy({ userId, productId: id }));
    }
    return product;
  }

  async create(dto: {
    name: string;
    categoryId?: string | null;
    description?: string;
    priceCents: number;
    stock: number;
    imageUrl?: string;
    oldPriceCents?: number;
    isActive?: boolean;
  }): Promise<Product> {
    this.validate(dto);
    if (dto.categoryId) {
      const cat = await this.categories.findOneBy({ id: dto.categoryId });
      if (!cat) throw new BadRequestException('Categoría no existe');
    }
    const product = await this.repo.save({
      name: dto.name.trim(),
      categoryId: dto.categoryId ?? null,
      description: dto.description ?? null,
      priceCents: dto.priceCents,
      stock: dto.stock,
      imageUrl: dto.imageUrl ?? null,
      oldPriceCents: dto.oldPriceCents ?? null,
      isActive: dto.isActive ?? true,
    } as any);
    return product;
  }

  async update(
    id: string,
    dto: Partial<{
      name: string;
      categoryId: string | null;
      description: string;
      priceCents: number;
      stock: number;
      imageUrl: string;
      oldPriceCents: number | null;
      isActive: boolean;
    }>,
  ): Promise<Product> {
    const product = await this.repo.findOneBy({ id });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const merged = { ...product, ...dto };
    this.validate(merged as any);
    if (dto.categoryId !== undefined) {
      if (dto.categoryId) {
        const cat = await this.categories.findOneBy({ id: dto.categoryId });
        if (!cat) throw new BadRequestException('Categoría no existe');
      }
      product.categoryId = dto.categoryId;
    }
    if (dto.name !== undefined) product.name = dto.name.trim();
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.priceCents !== undefined) product.priceCents = dto.priceCents;
    if (dto.stock !== undefined) product.stock = dto.stock;
    if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl;
    if (dto.oldPriceCents !== undefined) product.oldPriceCents = dto.oldPriceCents;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;
    return this.repo.save(product);
  }

  async remove(id: string): Promise<{ removed: boolean }> {
    const product = await this.repo.findOneBy({ id });
    if (!product) throw new NotFoundException('Producto no encontrado');
    product.isActive = false;
    await this.repo.save(product);
    return { removed: true };
  }

  private validate(dto: {
    name?: string;
    priceCents?: number;
    stock?: number;
    oldPriceCents?: number;
  }) {
    if (!dto.name || dto.name.trim().length < 3) {
      throw new BadRequestException('El nombre debe tener al menos 3 caracteres');
    }
    if (!dto.priceCents || dto.priceCents <= 0) {
      throw new BadRequestException('El precio debe ser mayor que 0');
    }
    if (dto.stock === undefined || dto.stock < 0) {
      throw new BadRequestException('El stock no puede ser negativo');
    }
    if (dto.oldPriceCents !== undefined && dto.oldPriceCents !== null) {
      if (dto.oldPriceCents <= (dto.priceCents ?? 0)) {
        throw new BadRequestException('El precio de oferta debe ser mayor que el precio actual');
      }
    }
  }

  async decorateRatings(products: Product[]): Promise<Product[]> {
    const ids = products.map((p) => p.id);
    if (!ids.length) return products;
    const aggs = await this.reviews
      .createQueryBuilder('r')
      .select('r.productId', 'productId')
      .addSelect('COALESCE(AVG(r.rating), 0)', 'avg')
      .addSelect('COUNT(r.id)', 'count')
      .where({ productId: In(ids) })
      .groupBy('r.productId')
      .getRawMany();
    const map = new Map<string, { avg: number; count: number }>();
    for (const row of aggs) {
      map.set(row.productId, { avg: Number(row.avg), count: Number(row.count) });
    }
    for (const p of products) {
      const agg = map.get(p.id);
      p.ratingAvg = agg ? Math.round(agg.avg * 10) / 10 : 0;
      p.reviewCount = agg?.count ?? 0;
    }
    return products;
  }
}
