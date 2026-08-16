# QA Report — 2026-08-16 Colmado

**Project:** Tienda de barrio online — catálogo, carrito, checkout con retención de stock, pedidos en tiempo real y comprobante QR
**Stack:** Angular 22 (zoneless, signals, Tailwind v4) + NestJS 11 + TypeORM 1.x + better-sqlite3 (dev) / Neon Postgres (prod-ready)
**Author:** Hermes Daily Builder → QA tester-deployer
**Subdomain:** https://colmado.proyectos.cristiancode.dev · **API:** :3065 · **Repo:** github.com/cristiancode-hermes/2026-08-16-colmado

## ✅ 1. Build Verification

| Target | Status | Details |
|--------|--------|---------|
| API `tsc -p tsconfig.json` | ✅ | Compila limpio (TS 6.0.3), `dist/main.js` emitido |
| Web `ng build` | ✅ | `@angular/build:application`, output `dist/web/browser`, sin errores |
| CSS Tailwind v4 | ✅ | `build-css.cjs` → `styles.css` (21.6KB) |
| Arranque API | ✅ | Seed + Sweeper activos; Swagger en `/api/docs` |

## ✅ 2. Test Results

**31 test cases · 4 suites — ALL PASSED** (Jest, `npm test -w apps/api`)

| Test Suite | Cobertura | Assertions |
|------------|-----------|------------|
| `cart-checkout.spec.ts` | Checkout transaccional, retención, validación stock | — |
| `orders-cycle.spec.ts` | Máquina de estados, pago, cancelación, sweeper | — |
| `order-machine.spec.ts` | Transiciones de estado del pedido | — |
| `seed.spec.ts` | Seed idempotente, usuarios demo, datos consistentes | — |

## ✅ 3. Verificación funcional end-to-end (API + navegador)

**33/33 checks de endpoints PASS** (script `qa-endpoint-test.sh`):

- **Auth**: login demo/tendero, register, `/me` con/sin token (401), logout
- **Catálogo**: 15 productos; stock lista == stock detalle (regla Cristian #2)
- **Carrito**: subtotal == Σ líneas; total == subtotal + envío (cálculo servidor)
- **Checkout → retención**: `expiresAt = now + 15 min` EN SERVIDOR, `holdSecondsLeft` correcto
- **Doble venta**: clamp 1..stock al añadir; 409 "Stock insuficiente" con detalle por ítem cuando el carrito contiene un producto agotado (verificado en vivo con el carrito demo)
- **Pago + comprobante**: pending → paid; factura con `qrSvg` + `invoiceNumber` + `html` imprimible; EmailLog
- **Totales pedido**: `order.totalCents == Σ OrderItem.subtotalCents` (regla Cristian #2)
- **Cancelación**: pending → cancelled con restauración de stock
- **Sweeper**: pedido con `expiresAt` vencido (backdate en BD) → cancelado con `EXPIRED_HOLD` y stock liberado en el siguiente ciclo de 30 s (regla B/C)
- **Admin**: pedidos, stats con KPIs + `salesByDay` (14 días) + `topProducts`, transición de estados, 403 para no-admin
- **Reseñas/favoritos**: creación y consulta (usuario QA, sin colisión seed)

**Smoke test de rutas dinámicas en navegador (regla Cristian #1)**: `/producto/:id`, `/pedidos/:id` cargadas con usuario real — ninguna en blanco ni "Error inesperado". Flujo completo verificado en vivo: login → añadir al carrito → checkout (cuenta atrás 14:57 en vivo) → pagar → factura con QR → detalle con timeline. Restauración de sesión en reload completo OK (token persistente). Guardas: `/admin` bloqueado a no-admin, `/login` bloqueado a sesión activa.

**Gráficos reales (regla Cristian #3)**: panel admin con "Ventas por día (14 días)" (SVG con ejes Y/X, etiquetas de fecha MM-DD, gridlines fraccionarias y tooltips por barra) y "Top productos" (barras con unidades e ingresos) — verificado con visión. KPIs reales (pedidos hoy 7, ingresos 30,15 €, retenciones, stock bajo, productos).

**Contraste (regla Cristian #4)**: verificado visualmente — texto oscuro sobre fondo crema, botones paprika `#B93A24` + blanco (5.66:1), sin botones que parezcan deshabilitados.

## ✅ 4. Incidencias encontradas y corregidas durante QA

| # | Severidad | Incidencia | Fix |
|---|-----------|------------|-----|
| 1 | **CRÍTICA** | Rutas profundas (`/producto/:id`) en blanco: `index.html` sin `baseHref` → assets relativos resueltos bajo `/producto/` → Caddy devuelve HTML como JS | `"baseHref": "/"` en `angular.json` → `<base href="/">` en el build. Afecta también a cinenova (`/cine/:id`) — mismo patrón, pendiente de aplicar allí |
| 2 | **CRÍTICA** | Admin 403 para TODOS (incluido tendero): `AdminGuard.canActivate` sobrescribía sin llamar a `super.canActivate()` → `req.user` siempre undefined | Guard async que ejecuta passport primero y luego comprueba rol |
| 3 | **ALTA** | Panel admin: KPIs "Ingresos pagados: NaN €" y resto vacíos — el frontend esperaba campos planos (`revenueCents`, `ordersToday`, `pendingHolds`, `products`) pero la API devolvía `kpis.*` anidados | API `/admin/stats` ampliada con KPIs planos + `salesByDay`/`topProducts`; frontend ampliado con los DOS gráficos SVG requeridos por spec (no existían) |
| 4 | **ALTA** | Countdown del checkout roto: `{{ mmss }}`/`*ngIf="expired"` sin `()` renderizaban la función fuente (`()=>Mu(n)`), banner "tiempo agotado" siempre visible y botones deshabilitados | `mmss()`, `expired()`, `progress()` con llamada explícita (NG8109/NG8117) |
| 5 | **ALTA** | QR de la factura no se renderizaba: Angular sanitiza `<svg>` en `[innerHTML]` | `DomSanitizer.bypassSecurityTrustHtml` + `.qr-box` con SVG a 180px (además, el SVG generado traía width ~290px y se solapaba con el texto) |
| 6 | **MEDIA** | "0 artículo(s)" en la lista de pedidos: `GET /orders` no devolvía `itemsCount` | `listForUser` calcula `itemsCount` (mismo contrato que admin) |
| 7 | **MEDIA** | Seed inconsistente: "Pan de pueblo" con stock base 1 consumido por pedidos seed → carrito demo imposible de comprar (409 eterno); pedido o3 sin decremento de stock | Stock base 3 + decremento o3 → carrito demo funcional |

### Minor Issues (no bloqueantes)
| Issue | Severity | Suggestion |
|-------|----------|------------|
| NG8113 unused imports (RouterLink en checkout, StatusBadge en producto-detalle) | Cosmético | Limpiar imports |
| Etiqueta del eje Y del gráfico en céntimos sin sufijo "cts" | Cosmético | Añadir sufijo en el título del gráfico |
| Rutas profundas de **cinenova** (`/cine/:id`) con el mismo bug de `baseHref` | Pendiente | Aplicar `baseHref:"/"` y rebuild (mismo fix que colmado) |

## ✅ 5. Security Scan

| Check | Result |
|-------|--------|
| `***` malformed template literal (interceptor/scripts) | ✅ 0 matches |
| Secretos hardcodeados en código | ✅ Solo JWT_SECRET de dev en `.env` (no versionado) |
| `@Controller('api/...')` + global prefix duplicado | ✅ No aplica |
| APP_GUARD global bloqueando auth | ✅ No aplica |
| SQL sin parametrizar | ✅ QueryBuilder/params en toda la API |
| `innerHTML` no sanitizado | ✅ Corregido (QR con bypass explícito) |
| SQLite reserved words como alias | ✅ 0 matches |
| TypeORM 1.x patterns (`timestamp`, `delete({})`, `null as any`, setLock) | ✅ `setLock` condicional a driver no-SQLite |

## ✅ 6. Deployment

| Target | Result | Details |
|--------|--------|---------|
| Subdominio Caddy | ✅ | `colmado.proyectos.cristiancode.dev` → 200 (root dist/web/browser, `@api` → :3065) |
| manage-apis.sh | ✅ | Arrays alineados (51×3, verificados por regex); restart gestionado OK (HTTP 200) |
| GitHub repo | ✅ | `cristiancode-hermes/2026-08-16-colmado` creado y pusheado (main) |
| Excel | ✅ | Fila 81 (proyectos_completo.xlsx) |
| Landing page | ✅ | `proyectos.cristiancode.dev` — colmado en Core, JS válido, live 1 match |
| Portafolio (Astro) | ✅ | es/en/pt con slug colmado (id 189); detail 200 ×3 locales; md5 live == dist |
| Screenshots | ✅ | `assets/colmado.png` + `-m.png` (captura real logueada, verificado por visión) |
| Capture config | ✅ | config.mjs (loginField `identifier`) + prod-capture.mjs (key `colmado_token`, rutas tienda/pedidos) |

**Verificación de enlaces (regla obligatoria):**
- href (Web): `https://colmado.proyectos.cristiancode.dev` → **200** ✅
- link2 (README): blob **200** ✅ (raw 200) ✅
- link3 (repo): **200** ✅
- Detail pages: es/en/pt → **200/200/200** ✅
- Assets: colmado.png/-m.png → **200/200** ✅
- Listado `/hermes/`: `data-search="colmado"` → 1 match ✅

## Summary

**OVERALL: PASS ✅**

Proyecto nuevo (B2C comercio, dominio sin precedentes) con la capa de valor exigida: ciclo transaccional completo (retención 15 min server-side, sweeper 30 s, bloqueo doble venta 409, comprobante QR + email simulado, contadores consistentes). 31 tests + 33 checks E2E + smoke test de rutas dinámicas en navegador. 7 incidencias corregidas durante QA (2 críticas). Desplegado y verificado en todos los destinos.
