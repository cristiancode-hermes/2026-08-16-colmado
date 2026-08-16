# API — Colmado

Base URL: `/api` · Auth: `Authorization: Bearer <token>` · Swagger: `/api/docs`

## Auth

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/register` | — | `{name, email, username, password}` → `{token, user}` |
| POST | `/auth/login` | — | `{identifier, password}` (email o usuario) → `{token, user}` |
| GET | `/auth/me` | JWT | Usuario actual |

**Demo:** `demo@colmado.dev / colmado2026` (client) · `tendero@colmado.dev / colmado2026` (admin)

## Catálogo

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/categories` | — | Categorías con `productCount` |
| POST | `/categories` | admin | Crear |
| PATCH | `/categories/:id` | admin | Editar |
| DELETE | `/categories/:id` | admin | Borrar (mueve productos a sin categoría) |
| GET | `/products?category=&q=&orden=&ofertas=&stockBajo=` | — | Catálogo (solo activos) |
| GET | `/products/:id` | — | Detalle con `category`, `rating`, `reviewsCount` |
| POST | `/products` | admin | Crear |
| PATCH | `/products/:id` | admin | Editar |
| DELETE | `/products/:id` | admin | Desactivar (soft delete) |
| GET | `/products/:id/reviews` | — | `{reviews[], myReview}` |
| POST | `/products/:id/reviews` | JWT | Opinar (1 por usuario) |
| PATCH | `/products/:id/reviews` | JWT | Editar opinión |
| DELETE | `/products/:id/reviews` | JWT | Borrar opinión |

## Carrito + Checkout (transaccional)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/cart` | JWT | `CartDTO {items[], itemCount, subtotalCents, shippingCents, totalCents, freeShipping}` |
| POST | `/cart/items` | JWT | `{productId, quantity}` → CartDTO |
| PATCH | `/cart/items/:productId` | JWT | `{quantity}` — **409 si excede stock** (con `max`) |
| DELETE | `/cart/items/:productId` | JWT | Quitar línea |
| DELETE | `/cart` | JWT | Vaciar |
| POST | `/cart/checkout` | JWT | **Crear pedido `pending` + retención 15 min + decrementar stock** — `{order, expiresAt, holdSecondsLeft}`. **409 si stock insuficiente** (`{message, items[]}`) |

## Pedidos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/orders` | JWT | Lista del usuario |
| GET | `/orders/:id` | JWT | Detalle con `items` + `timeline` |
| POST | `/orders/:id/pay` | JWT | `pending→paid` + factura `{order, invoice{qrSvg, invoiceNumber}}`. **409 si vencida** (cancela + libera stock) |
| POST | `/orders/:id/cancel` | JWT | `pending|paid→cancelled` + restaura stock (+ refund si pagado) |
| GET | `/orders/:id/invoice` | JWT | `{qrSvg, invoiceNumber, html}` (solo paid+) |

## Admin (Mostrador)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/admin/stats` | admin | `{products, categories, users, ordersToday, pendingHolds, revenueCents, lowStock, byStatus}` |
| GET | `/admin/orders?estado=` | admin | Pedidos de todos los usuarios (con items) |
| PATCH | `/admin/orders/:id/status` | admin | `{status}` — valida máquina de transiciones, **400 si inválida** |

## Estados del pedido

| Estado | Label | Transiciones válidas |
|--------|-------|---------------------|
| `pending` | Reservado | `paid`, `cancelled` |
| `paid` | Pagado | `preparing`, `cancelled` |
| `preparing` | Preparando | `shipped` |
| `shipped` | Enviado | `delivered` |
| `delivered` | Entregado | — |
| `cancelled` | Cancelado | — (EXPIRED_HOLD restaura stock) |

## Errores

- `400 BadRequest` — validación / carrito vacío / transición inválida
- `401 Unauthorized` — sin token o credenciales malas
- `403 Forbidden` — requiere admin
- `404 NotFound` — recurso inexistente
- `409 Conflict` — **stock insuficiente**, retención vencida, email/usuario duplicado, opinión duplicada

## Configuración

```env
PORT=3065
DATABASE_TYPE=better-sqlite3   # o postgres
DATABASE_PATH=data/colmado.db  # postgres: DATABASE_URL
JWT_SECRET=colmado-dev-secret
```
