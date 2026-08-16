# Frontend — Colmado

Angular 22 standalone + signals + zoneless. CSS puro con variables (sin Tailwind): `styles.source.css` → `build-css.cjs` → `styles.css`.

## Rutas

| Ruta | Página | Guard |
|------|--------|-------|
| `/tienda` | Catálogo con filtros (categoría, ofertas, stock bajo, orden) | — |
| `/producto/:id` | Detalle + opiniones | — |
| `/carrito` | Cesta con stepper de cantidades + resumen (envío gratis ≥50 €) | — |
| `/checkout` | Dirección + pago → **retención 15 min con contador + barra** | auth |
| `/pedidos` | Lista de pedidos con badges de estado | auth |
| `/pedidos/:id` | Seguimiento (timeline), pagar, cancelar, factura + QR imprimible | auth |
| `/favoritos` | Productos guardados | auth |
| `/login` · `/registro` | Auth (login minimalista sin caja, demo visible) | public-only |
| `/admin` | Mostrador: stats + pedidos en tiempo real (poll 15s) + avanzar estados | admin |
| `**` | 404 | — |

## Sistema de diseño — "Bodega de Barrio"

Tokens CSS en `:root` / `[data-theme=dark]`:

- **Paleta:** paprika `#B93A24` (primario), oliva `#5E6B3C` (secundario), mostaza `#C99A2E` (acento), carbón `#23281F` (texto), off-white `#FAFAFA` croma 0 (fondo — nada de crema).
- **Tipografía:** Fraunces (display, h1-h3, `text-wrap: balance`) + Inter (body, `text-wrap: pretty`); precios con `tabular-nums`.
- **Radii:** 6/10/16/24/999px. **Sombras** suaves con tinta cálida; en dark, negro puro.
- **Motion:** 150-250ms ease-out-quart; entrada de cards fade+translateY; contador de retención NUNCA anima layout (barra con `transform: scaleX`); `prefers-reduced-motion: reduce` desactiva todo.
- **z-index semántico:** 10 dropdown → 20 sticky → 30 modal-backdrop → 40 modal → 50 toaster.
- **Contraste:** todo texto ≥4.5:1 (los badges saturados usan tinta oscura `ink` cuando el blanco no llega; nunca `opacity: 0.55`).

### Anti-slop aplicado (impeccable)

- ✅ Sin gradient text, sin glassmorphism, sin side-stripe borders, sin hero-metrics.
- ✅ Grid del catálogo `repeat(auto-fit, minmax(240px, 1fr))` — responsive sin breakpoints manuales.
- ✅ Cards de producto con dirección por fotografía (estilo Airbnb), no iconos genéricos.
- ✅ Estados: skeleton loading, empty states con CTA, errores en alertas.

## Contador de retención (checkout)

- `expiresAt` viene del servidor (`POST /cart/checkout`).
- `setInterval` 1s recalcula con `Date.now()` real; si la pestaña se congela, al volver el tick recalcula desde `expiresAt` (sin drift).
- Al llegar a 0: se muestra aviso de expiración y se bloquea pagar.
- `pay()` con retención vencida → el API devuelve 409 y el frontend recarga el pedido para mostrar `cancelled`.

## Pedidos en tiempo real (admin)

- Poll cada 15s de `/admin/orders` + `/admin/stats`.
- Botón por fila para avanzar estado según `NEXT_STATUS` (el pago `pending→paid` lo hace el cliente).
- Los badges de estado se derivan SIEMPRE del enum (`ORDER_STATUS_LABELS`) — nunca se guarda la etiqueta.

## Autenticación

- `AuthService`: `token`/`user` signals + localStorage (`colmado_token` / `colmado_user`); sobrevive reload.
- Login por **email o usuario**; inputs vacíos (`signal('')`), `autocomplete="off"` / `new-password`.
- Credenciales demo visibles bajo el formulario (regla 2b).
- Interceptor inyecta `Authorization` desde localStorage (nunca inyecta AuthService — evita NG0200).
- Guards: `authGuard` (redirige a login con `next`), `adminGuard`, `publicOnlyGuard`.

## Build

```bash
npm run build   # apps/web: build-css.cjs && ng build → dist/web
```
