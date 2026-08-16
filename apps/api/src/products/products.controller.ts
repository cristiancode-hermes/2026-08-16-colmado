import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { AdminGuard, JwtAuthGuard } from '../auth/guards';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  list(
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('orden') orden?: string,
    @Query('ofertas') ofertas?: string,
    @Query('stockBajo') stockBajo?: string,
    @Query('userId') userId?: string,
  ) {
    return this.service.list({ category, q, orden, ofertas, stockBajo, userId });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.service.findOne(id, userId);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
