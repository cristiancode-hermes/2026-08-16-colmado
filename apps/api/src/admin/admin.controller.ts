import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/guards';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../entities/entities';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('orders')
  listOrders(@Query('estado') estado?: string) {
    return this.admin.listOrders(estado);
  }

  @Patch('orders/:id/status')
  advance(@Param('id') id: string, @Body() dto: { status: OrderStatus }) {
    return this.ordersService.advanceStatus(id, dto.status);
  }

  @Get('stats')
  stats() {
    return this.admin.stats();
  }
}
