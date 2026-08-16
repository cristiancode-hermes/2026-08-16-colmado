
## Sesión responsive + isFinalDesign (2026-08-16, tarde)

Mejoras de adaptación móvil tras la revisión de Cristian (header roto a 390px, textos en cards):

1. **Header móvil** — acciones con clase `navbar-actions`/`navbar-user`; a ≤640px: brand+user fila 1, links centrados fila 2 (patrón CineNova); compactado (paddings/gaps/tamaños) para caber en 390px sin 3ª fila; `user-name` con ellipsis.
2. **Cards de tienda/favoritos** — `product-body` más compacto, nombre 1rem, descripción con `line-clamp: 2`, `price-row` con `flex-wrap` (precio+botón ya no revientan en 2 columnas), precio 1.25rem.
3. **Checkout** — grid `2fr 1fr` (Ciudad/C.P.) a clase `grid-2-1`; se apila a 1 col ≤560px. Container con padding lateral 16px ≤640px.
4. **Ruido 401** — navbar ya no llama a `/api/cart` sin sesión (eliminado error de consola en visitas anónimas).
5. **Guard race (recarga directa)** — `AuthService.ready` + guards `await ready`: /admin, /pedidos, /pedido-detalle, /carrito, /checkout, /favoritos ya renderizan al recargar con token válido aunque no haya usuario cacheado (antes admin caía a tienda).
6. **3 imágenes rotas** — Tomate frito, Papel de cocina, Velas aromáticas (Unsplash 404): reemplazadas y verificadas HTTP 200 en seed + BD viva.

Verificación: puppeteer 390/768/1280 × 8 rutas = 24 checks: 0 overflow horizontal, 0 errores consola, 0 imágenes rotas; /admin renders "Mostrador" en los 3 viewports. Build `npm run build` exitoso.
