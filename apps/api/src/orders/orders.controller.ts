import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listForUser(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.findForUser(user.id, id);
  }

  @Post(':id/pay')
  pay(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.pay(user.id, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.cancel(user.id, id);
  }

  @Get(':id/invoice')
  invoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.invoice(user.id, id);
  }
}
