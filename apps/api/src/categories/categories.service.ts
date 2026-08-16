import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, Product } from '../entities/entities';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly repo: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async list(): Promise<Category[]> {
    const categories = await this.repo.find({ order: { name: 'ASC' } });
    const counts = await this.products
      .createQueryBuilder('p')
      .select('p.categoryId', 'categoryId')
      .addSelect('COUNT(*)', 'count')
      .where('p.isActive = :active', { active: true })
      .groupBy('p.categoryId')
      .getRawMany();
    const map = new Map<string, number>();
    for (const row of counts) map.set(row.categoryId, Number(row.count));
    return categories.map((c) => ({ ...c, productCount: map.get(c.id) ?? 0 }));
  }

  async create(dto: { name: string; description?: string }): Promise<Category> {
    const name = dto.name?.trim();
    if (!name || name.length < 2) throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
    const slug = slugify(name);
    if (!slug) throw new BadRequestException('Nombre inválido');
    const existing = await this.repo.findOneBy({ slug });
    if (existing) throw new ConflictException('Ya existe una categoría con ese nombre');
    return this.repo.save({ name, slug, description: dto.description ?? null } as any);
  }

  async update(id: string, dto: { name?: string; description?: string }): Promise<Category> {
    const category = await this.repo.findOneBy({ id });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length < 2) throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
      const slug = slugify(name);
      const clash = await this.repo.findOneBy({ slug });
      if (clash && clash.id !== id) throw new ConflictException('Ya existe una categoría con ese nombre');
      category.name = name;
      category.slug = slug;
    }
    if (dto.description !== undefined) category.description = dto.description;
    return this.repo.save(category);
  }

  async remove(id: string): Promise<{ moved: number }> {
    const category = await this.repo.findOneBy({ id });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    const total = await this.repo.count();
    if (total <= 1) throw new BadRequestException('No se puede eliminar la única categoría');
    const moved = await this.products.update({ categoryId: id }, { categoryId: null });
    await this.repo.remove(category);
    return { moved: moved.affected ?? 0 };
  }
}
