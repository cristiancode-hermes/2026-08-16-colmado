import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';

@Controller()
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Get('products/:id/reviews')
  list(@Param('id') productId: string, @Query('userId') userId?: string) {
    return this.service.list(productId, userId);
  }

  @Post('products/:id/reviews')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('id') productId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { rating: number; comment: string },
  ) {
    return this.service.create(productId, user.id, dto);
  }

  @Put('products/:id/reviews')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') productId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { rating: number; comment: string },
  ) {
    return this.service.update(productId, user.id, dto);
  }
}
