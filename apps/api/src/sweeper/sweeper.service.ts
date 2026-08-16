import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';

/**
 * Sweeper — liberación automática de retenciones vencidas (regla C).
 * Corre cada 30s en la API, independiente de requests de clientes.
 */
@Injectable()
export class SweeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SweeperService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly orders: OrdersService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.orders
        .expireStale()
        .then((n) => {
          if (n > 0) this.logger.log(`Sweeper: ${n} retención(es) expirada(s), stock liberado`);
        })
        .catch((err) => this.logger.error(`Sweeper error: ${err.message}`));
    }, 30_000);
    // Primer barrido al arrancar (recupera pedidos vencidos durante el downtime)
    this.orders.expireStale().catch(() => undefined);
    this.logger.log('Sweeper activo (cada 30s)');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
