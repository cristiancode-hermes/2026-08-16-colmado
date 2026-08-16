# 🧺 Colmado — la tienda de barrio online

Catálogo, carrito, checkout con **retención de stock (15 min)** y pedidos en tiempo real.

## Quick start

```bash
npm install --legacy-peer-deps --no-audit --no-fund

# API (puerto 3065) — seed automático
cd apps/api && npm run start

# Web (proxy /api → :3065)
cd apps/web && npm run start
```

**Demo:** `demo@colmado.dev / colmado2026` · **Admin:** `tendero@colmado.dev / colmado2026`

## Lo que hace

- **Catálogo** con fotos, ofertas, filtros por categoría y stock bajo.
- **Carrito** con envío gratis ≥50 €.
- **Checkout transaccional**: reserva tu compra 15 minutos (expiración en servidor), sin doble venta (409 si el stock se agota), sweeper que libera retenciones vencidas automáticamente.
- **Pago simulado** con factura + **QR de verificación** imprimible.
- **Pedidos en tiempo real** con timeline y estados (Reservado → Pagado → Preparando → Enviado → Entregado).
- **Mostrador (admin)**: stats del día + avanzar estados de todos los pedidos.

## Stack

NestJS 11 · TypeORM 1.1 · SQLite (dev) / Postgres (prod) · Angular 22 (signals, zoneless) · CSS puro con tokens · Jest (24 tests)

## Docs

- `docs/ARCHITECTURE.md` — decisiones y ciclo transaccional
- `docs/API.md` — endpoints y contratos
- `docs/FRONTEND.md` — rutas y sistema de diseño "Bodega de Barrio"
