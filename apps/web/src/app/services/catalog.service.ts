import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Category, Product } from '../models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly categories = signal<Category[]>([]);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);

  constructor(private readonly api: ApiService) {}

  async loadCatalog(): Promise<void> {
    this.loading.set(true);
    try {
      const [cats, prods] = await Promise.all([
        this.api.get<Category[]>('/categories'),
        this.api.get<Product[]>('/products'),
      ]);
      this.categories.set(cats);
      this.products.set(prods);
    } finally {
      this.loading.set(false);
    }
  }

  async loadProducts(params?: Record<string, string | number | undefined>): Promise<Product[]> {
    const prods = await this.api.get<Product[]>('/products', params);
    this.products.set(prods);
    return prods;
  }

  getProduct(id: string): Promise<Product> {
    return this.api.get<Product>(`/products/${id}`);
  }

  getReviews(productId: string): Promise<{ reviews: import('../models').ReviewDTO[]; myReview: import('../models').ReviewDTO | null }> {
    return this.api.get(`/products/${productId}/reviews`);
  }
}
