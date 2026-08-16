# Arquitectura — Colmado

> **Colmado** — la tienda de barrio online: catálogo, carrito, checkout con retención de stock y pedidos en tiempo real.
> Monorepo NestJS + TypeORM/SQLite + Angular 22 standalone (zoneless).

## Stack

| Capa | Tecnología | Notas |
|------|-----------|-------|
| API | NestJS 11 + TypeORM 1.1 | mejor-sqlite3 (dev) / postgres (prod via `DATABASE_TYPE`) |
| Web | Angular 22 standalone, signals, zoneless | `provideZonelessChangeDetection()` — sin zone.js |
| CSS | CSS puro + variables | `styles.source.css` → `build-css.cjs` → `styles.css` |
| Tests | Jest + ts-jest + SQLite `:memory:` | 24 tests en 3 suites |
| Auth | JWT (passport-jwt) + bcryptjs | `@Exclude` en `passwordHash` |

## Estructura

```
apps/api/src/
  entities/entities.ts     → 10 entidades + máquina de estados del pedido
  auth/                    → register/login/me, JwtAuthGuard, AdminGuard
  categories/ products/    → catálogo (admin CRUD + público)
  cart/                    → carrito + checkout TRANSACCIONAL (retención)
  orders/                  → pay/cancel/invoice, expireStale (sweeper), timeline
  reviews/ favorites/      → opiniones + favoritos
  admin/                   → stats + avance de estados (pedidos en tiempo real)
  sweeper/                 → liberación automática de retenciones vencidas (30s)
  seed/                    → demo con datos reales (usuarios, 15 productos, 5 pedidos)

apps/web/src/
  app/pages/               → tienda, producto-detalle, carrito, checkout, pedidos,
                             pedido-detalle (QR/factura), favoritos, login, registro, admin
  app/services/            → api, auth, catalog, cart, orders, admin, favorites
  app/layout/              → navbar (sticky, cart badge, theme toggle), footer
  app/components/          → status-badge, price (compartidos)
  app/guards/              → auth, admin, public-only
```

## Ciclo transaccional (reglas CineNova/Colmado)

El checkout es el corazón de la app. Cumple las 6 reglas del ciclo transaccional:

1. **A — La transacción NO termina en el ticket.** El checkout crea `Order(status=pending)` con estado real en backend; el ticket/QR se genera al pagar (`pay` → `paid` + `EmailLog` de factura).
2. **B — Expiración calculada EN SERVIDOR.** `expiresAt = Date.now() + 15min` se calcula en `CartService.checkout` dentro de la transacción; el frontend solo muestra un contador derivado de `expiresAt` (nunca cuenta él).
3. **C — Liberación automática (sweeper).** `SweeperService` corre `expireStale()` cada 30s en la API: cancela `pending` con `expiresAt < now` (`cancelReason='EXPIRED_HOLD'`) y restaura stock — sin esperar requests.
4. **D — Bloqueo de doble venta.** El checkout valida stock con los productos bloqueados (`FOR UPDATE` en postgres; SQLite serializa escrituras) y lanza **409** con detalle por ítem si falta. Además `pay()` sobre una retención vencida cancela en su propia transacción y devuelve 409.
5. **E — Comprobante fuera de la web.** `pay()` devuelve `qrSvg` + número de factura; `invoice()` genera HTML imprimible con el QR (verificación en mostrador).
6. **F — Contadores consistentes.** Los totals de lista y detalle se calculan SIEMPRE de los items persistidos (`subtotalCents` por línea, `totalCents` en el pedido). El seed deriva el stock de los pedidos históricos que ya lo consumieron.

## Máquina de estados

```
pending ──▶ paid ──▶ preparing ──▶ shipped ──▶ delivered
   │          │
   └─▶ cancelled (cliente o EXPIRED_HOLD — restaura stock)
```

- `ORDER_TRANSITIONS` en `entities.ts` es la única fuente de verdad; `advanceStatus` (admin) y `pay`/`cancel` la validan.
- Etiquetas ES (`ORDER_STATUS_LABELS`) siempre derivadas del enum, nunca guardadas.

## Decisiones clave

- **SQLite en tests con `:memory:`** — el setLock se omite para better-sqlite3 (no soporta FOR UPDATE); la validación + transacción cubren la doble venta.
- **`pay()` con pre-chequeo de expiración fuera de la transacción**: si la retención venció, se cancela en su propia transacción (commiteada) y luego se lanza 409 — evita que el rollback deshaga la liberación de stock.
- **Número de pedido** `YYYY-MMDD-NNNN` único generado con queryBuilder (orden DESC + prefijo).
- **Seed idempotente**: `if (users.count() > 0) return` — no duplica datos en reinicios.
- **Login minimalista sin caja** (regla variedad 2026-08-12): formulario desnudo sobre el fondo, credenciales demo visibles, inputs vacíos sin autocompletar.
- **Dark mode** con tokens por `data-theme`, persistido en localStorage; `prefers-reduced-motion` respetado.
