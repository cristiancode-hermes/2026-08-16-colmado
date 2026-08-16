import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly service: CartService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getCart(user.id);
  }

  @Post('items')
  add(@CurrentUser() user: AuthenticatedUser, @Body() dto: { productId: string; quantity: number }) {
    return this.service.addItem(user.id, dto.productId, dto.quantity);
  }

  @Patch('items/:productId')
  update(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string, @Body() dto: { quantity: number }) {
    return this.service.updateQty(user.id, productId, dto.quantity);
  }

  @Delete('items/:productId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string) {
    return this.service.removeItem(user.id, productId);
  }

  @Delete()
  clear(@CurrentUser() user: AuthenticatedUser) {
    return this.service.clear(user.id);
  }

  @Post('checkout')
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { shippingName: string; shippingAddress: string; shippingCity: string; shippingZip: string; paymentMethod: 'card' | 'cod' },
  ) {
    return this.service.checkout(user.id, dto);
  }
}
