import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Product } from '../models';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  readonly favorites = signal<Product[]>([]);

  constructor(private readonly api: ApiService) {}

  async load(): Promise<Product[]> {
    const favs = await this.api.get<Product[]>('/favorites');
    this.favorites.set(favs);
    return favs;
  }

  async add(productId: string): Promise<void> {
    await this.api.post<{ added: boolean }>(`/favorites/${productId}`);
    await this.load();
  }

  async remove(productId: string): Promise<void> {
    await this.api.delete<{ removed: boolean }>(`/favorites/${productId}`);
    await this.load();
  }
}
