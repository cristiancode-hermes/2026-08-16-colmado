import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, Review, User } from '../entities/entities';

export interface ReviewDTO {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async list(productId: string, userId?: string): Promise<{ reviews: ReviewDTO[]; myReview: ReviewDTO | null }> {
    const rows = await this.reviews.find({
      where: { productId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    const reviews: ReviewDTO[] = rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      userId: r.userId,
      userName: r.user?.name ?? 'Vecino',
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    }));
    const mine = userId ? reviews.find((r) => r.userId === userId) ?? null : null;
    return { reviews, myReview: mine };
  }

  async create(productId: string, userId: string, dto: { rating: number; comment: string }): Promise<ReviewDTO> {
    const product = await this.products.findOneBy({ id: productId });
    if (!product || !product.isActive) throw new NotFoundException('Producto no encontrado');
    const rating = Math.round(Number(dto.rating));
    const comment = dto.comment?.trim();
    if (!rating || rating < 1 || rating > 5) throw new ConflictException('La valoración debe ser entre 1 y 5');
    if (!comment || comment.length < 10 || comment.length > 500) {
      throw new ConflictException('El comentario debe tener entre 10 y 500 caracteres');
    }
    const existing = await this.reviews.findOneBy({ productId, userId });
    if (existing) throw new ConflictException('Ya opinaste sobre este producto');
    const review = await this.reviews.save({ productId, userId, rating, comment } as any);
    return this.toDTO(review);
  }

  async update(productId: string, userId: string, dto: { rating: number; comment: string }): Promise<ReviewDTO> {
    const review = await this.reviews.findOneBy({ productId, userId });
    if (!review) throw new NotFoundException('No tienes una reseña en este producto');
    const rating = Math.round(Number(dto.rating));
    const comment = dto.comment?.trim();
    if (!rating || rating < 1 || rating > 5) throw new ConflictException('La valoración debe ser entre 1 y 5');
    if (!comment || comment.length < 10 || comment.length > 500) {
      throw new ConflictException('El comentario debe tener entre 10 y 500 caracteres');
    }
    review.rating = rating;
    review.comment = comment;
    await this.reviews.save(review);
    return this.toDTO(review);
  }

  private async toDTO(review: Review): Promise<ReviewDTO> {
    const user = await this.users.findOneBy({ id: review.userId });
    return {
      id: review.id,
      productId: review.productId,
      userId: review.userId,
      userName: user?.name ?? 'Vecino',
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    };
  }
}
