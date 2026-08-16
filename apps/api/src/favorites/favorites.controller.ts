import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.id);
  }

  @Post(':productId')
  add(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string) {
    return this.service.add(user.id, productId);
  }

  @Delete(':productId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string) {
    return this.service.remove(user.id, productId);
  }
}
