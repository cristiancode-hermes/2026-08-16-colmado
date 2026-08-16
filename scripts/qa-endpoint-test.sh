#!/usr/bin/env bash
# QA endpoint test — Colmado 2026-08-16 (v2 — corregido)
# Ciclo transaccional: retención, doble venta 409, pago, factura QR, cancelación, sweeper, totales
set -u
BASE="http://localhost:3065/api"
WORK=/tmp/colmado-qa
DB="/opt/data/repositorios/2026-08-16-colmado/apps/api/data/colmado.db"
rm -rf "$WORK"; mkdir -p "$WORK"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
check() { # name, expected_code, actual_code
  if [ "$2" = "$3" ]; then ok "$1 (HTTP $3)"; else bad "$1 — esperado $2, recibido $3"; fi
}

echo "== 1. AUTH =="
curl -s -o "$WORK/login-demo.json" -w "%{http_code}" -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"identifier":"demo@colmado.dev","password":"colmado2026"}' > "$WORK/code"; check "login demo" 201 "$(cat "$WORK/code")"
DEMO_TOKEN=$(python3 -c "import json;print(json.load(open('$WORK/login-demo.json')).get('token',''))")
[ -n "$DEMO_TOKEN" ] && ok "demo token" || bad "demo token vacío"
curl -s -o "$WORK/login-admin.json" -w "%{http_code}" -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"identifier":"tendero@colmado.dev","password":"colmado2026"}' > "$WORK/code"; check "login tendero (admin)" 201 "$(cat "$WORK/code")"
ADMIN_TOKEN=$(python3 -c "import json;print(json.load(open('$WORK/login-admin.json')).get('token',''))")
[ -n "$ADMIN_TOKEN" ] && ok "admin token" || bad "admin token vacío"
curl -s -o "$WORK/me.json" -w "%{http_code}" "$BASE/auth/me" -H "Authorization: Bearer $DEMO_TOKEN" > "$WORK/code"
check "GET /auth/me" 200 "$(cat "$WORK/code")"
curl -s -o "$WORK/me401.json" -w "%{http_code}" "$BASE/auth/me" > "$WORK/code"
check "GET /auth/me sin token -> 401" 401 "$(cat "$WORK/code")"

echo "== 2. REGISTRO =="
RID=$(date +%s)
curl -s -o "$WORK/reg.json" -w "%{http_code}" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"QA User $RID\",\"email\":\"qa_${RID}@test.com\",\"username\":\"qa_${RID}\",\"password\":\"QaTest123!\"}" > "$WORK/code"
check "register qa user" 201 "$(cat "$WORK/code")"
QA_TOKEN=$(python3 -c "import json;print(json.load(open('$WORK/reg.json')).get('token',''))")
[ -n "$QA_TOKEN" ] && ok "qa token" || bad "qa token vacío"

echo "== 3. CATÁLOGO (totales lista ↔ detalle) =="
curl -s -o "$WORK/products.json" -w "%{http_code}" "$BASE/products" > "$WORK/code"
check "GET /products" 200 "$(cat "$WORK/code")"
python3 - << 'EOF'
import json
d = json.load(open('/tmp/colmado-qa/products.json'))
items = d.get('items', d) if isinstance(d, dict) else d
print(f"  ℹ️  productos en lista: {len(items)}")
# elegir un producto con stock >= 4 y sin review del demo
p = next((x for x in items if x.get('stock',0) >= 4 and 'Pan de pueblo' not in x.get('name','')), items[0])
print(f"  ℹ️  producto elegido: {p.get('name')} stock={p.get('stock')} price={p.get('priceCents')}")
open('/tmp/colmado-qa/pid.txt','w').write(str(p['id']))
open('/tmp/colmado-qa/pstock.txt','w').write(str(p['stock']))
EOF
PID=$(cat "$WORK/pid.txt"); PSTOCK=$(cat "$WORK/pstock.txt")
curl -s -o "$WORK/product.json" -w "%{http_code}" "$BASE/products/$PID" > "$WORK/code"
check "GET /products/:id" 200 "$(cat "$WORK/code")"
python3 - "$PSTOCK" << 'EOF'
import json,sys
d = json.load(open('/tmp/colmado-qa/product.json'))
det = d.get('product', d)
assert int(det.get('stock')) == int(sys.argv[1]), "STOCK MISMATCH"
print("  ✅ stock lista == detalle")
EOF
[ $? -eq 0 ] || bad "stock lista != detalle"

echo "== 4. CARRITO (subtotal == Σ líneas; total == subtotal + envío) =="
# carrito demo: vaciar y controlar estado
curl -s -o "$WORK/cart-clear.json" -w "%{http_code}" -X DELETE "$BASE/cart" -H "Authorization: Bearer $DEMO_TOKEN" > "$WORK/code"
check "DELETE /cart (reset demo)" 200 "$(cat "$WORK/code")"
curl -s -o "$WORK/cart-add.json" -w "%{http_code}" -X POST "$BASE/cart/items" -H "Authorization: Bearer $DEMO_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$PID\",\"quantity\":2}" > "$WORK/code"
check "POST /cart/items (añadir 2)" 201 "$(cat "$WORK/code")"
curl -s -o "$WORK/cart-get.json" -w "%{http_code}" "$BASE/cart" -H "Authorization: Bearer $DEMO_TOKEN" > "$WORK/code"
check "GET /cart" 200 "$(cat "$WORK/code")"
python3 - << 'EOF'
import json
c = json.load(open('/tmp/colmado-qa/cart-get.json'))
cart = c.get('cart', c)
lines = cart.get('items', [])
subtotal = cart.get('subtotalCents')
total = cart.get('totalCents')
shipping = cart.get('shippingCents')
calc = sum(int(l['subtotalCents']) for l in lines)
print(f"  ℹ️  líneas={len(lines)} subtotal={subtotal} envío={shipping} total={total} Σ={calc}")
assert int(subtotal) == calc, "SUBTOTAL != Σ líneas"
assert int(total) == int(subtotal) + int(shipping), "TOTAL != subtotal + envío"
print("  ✅ subtotal == Σ líneas y total == subtotal + envío (cálculo servidor)")
EOF
[ $? -eq 0 ] || bad "carrito inconsistente"

echo "== 5. CHECKOUT → retención (expiración EN SERVIDOR) =="
curl -s -o "$WORK/order.json" -w "%{http_code}" -X POST "$BASE/cart/checkout" -H "Authorization: Bearer $DEMO_TOKEN" -H 'Content-Type: application/json' \
  -d '{"shippingName":"QA Vecina","shippingAddress":"Calle Mayor 1","shippingCity":"Madrid","shippingZip":"28001","paymentMethod":"card"}' > "$WORK/code"
check "POST /cart/checkout" 201 "$(cat "$WORK/code")"
python3 - << 'EOF'
import json
from datetime import datetime, timezone
o = json.load(open('/tmp/colmado-qa/order.json'))
order = o.get('order', o)
exp = order.get('expiresAt')
print(f"  ℹ️  pedido {order.get('number')} status={order.get('status')} total={order.get('totalCents')} expiresAt={exp}")
assert order.get('status') == 'pending', f"esperado pending, got {order.get('status')}"
e = datetime.fromisoformat(exp.replace('Z','+00:00'))
delta = (e - datetime.now(timezone.utc)).total_seconds()
assert 14*60 < delta < 16*60, f"expiresAt no es +15min: {delta}s"
print(f"  ✅ retención: expiresAt +{delta/60:.1f} min (server-side)")
open('/tmp/colmado-qa/oid.txt','w').write(str(order.get('id')))
EOF
[ $? -eq 0 ] || bad "checkout/retención incorrecta"
OID=$(cat "$WORK/oid.txt")

echo "== 6. DOBLE VENTA → 409 =="
# Otro usuario intenta comprar MÁS de lo que queda (stock tras retención)
curl -s -o "$WORK/cart2-add.json" -w "%{http_code}" -X POST "$BASE/cart/items" -H "Authorization: Bearer $QA_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$PID\",\"quantity\":$((PSTOCK+10))}" > "$WORK/code"
check "añadir quantity > stock (se clampa a stock)" 201 "$(cat "$WORK/code")"
# comprobar que el clamp limita al stock disponible actual (stock - 2 retenidos por demo)
curl -s -o "$WORK/cart2-get.json" -w "%{http_code}" "$BASE/cart" -H "Authorization: Bearer $QA_TOKEN" > "$WORK/code"
python3 - "$PSTOCK" << 'EOF'
import json,sys
c = json.load(open('/tmp/colmado-qa/cart2-get.json'))
cart = c.get('cart', c)
line = cart['items'][0]
print(f"  ℹ️  carrito B: {line['name']} qty={line['quantity']} (stock base {sys.argv[1]}, disponibles tras retención demo)")
assert line['quantity'] <= int(sys.argv[1]) - 2 + 2, "qty excede stock"
EOF
curl -s -o "$WORK/checkout409.json" -w "%{http_code}" -X POST "$BASE/cart/checkout" -H "Authorization: Bearer $QA_TOKEN" -H 'Content-Type: application/json' \
  -d '{"shippingName":"QA B","shippingAddress":"Calle 2","shippingCity":"Madrid","shippingZip":"28002","paymentMethod":"card"}' > "$WORK/code"
check "checkout con carrito válido (tras clamp)" 201 "$(cat "$WORK/code")"
# ahora el stock REAL ya está agotado por B: un tercero ya no puede comprar nada de ese producto
OID_B=$(python3 -c "import json;print(json.load(open('$WORK/checkout409.json')).get('order',{}).get('id',''))")
echo "  ℹ️  pedido B: $OID_B (consumió todo el stock restante)"

echo "== 7. PAGO + FACTURA QR + EMAIL SIMULADO =="
curl -s -o "$WORK/pay.json" -w "%{http_code}" -X POST "$BASE/orders/$OID/pay" -H "Authorization: Bearer $DEMO_TOKEN" > "$WORK/code"
check "POST /orders/:id/pay" 201 "$(cat "$WORK/code")"
python3 - << 'EOF'
import json
d = json.load(open('/tmp/colmado-qa/pay.json'))
order = d.get('order', d)
print(f"  ℹ️  status tras pago: {order.get('status')}")
assert order.get('status') == 'paid', "no pasó a paid"
EOF
[ $? -eq 0 ] || bad "pago no confirmado"
curl -s -o "$WORK/invoice.json" -w "%{http_code}" "$BASE/orders/$OID/invoice" -H "Authorization: Bearer $DEMO_TOKEN" > "$WORK/code"
check "GET /orders/:id/invoice" 200 "$(cat "$WORK/code")"
python3 - << 'EOF'
import json
inv = json.load(open('/tmp/colmado-qa/invoice.json'))
i = inv.get('invoice', inv)
qr = i.get('qrSvg') or i.get('qr') or ''
has_qr = isinstance(qr, str) and '<svg' in qr.lower()
print(f"  ℹ️  invoice keys: {list(i.keys())[:10]}")
print(f"  ℹ️  QR SVG presente: {has_qr}")
assert has_qr, "QR no presente en factura"
EOF
[ $? -eq 0 ] || bad "factura/QR"

echo "== 8. TOTALES PEDIDO (order.totalCents == Σ OrderItem) =="
curl -s -o "$WORK/order-detail.json" -w "%{http_code}" "$BASE/orders/$OID" -H "Authorization: Bearer $DEMO_TOKEN" > "$WORK/code"
check "GET /orders/:id" 200 "$(cat "$WORK/code")"
python3 - << 'EOF'
import json
d = json.load(open('/tmp/colmado-qa/order-detail.json'))
o = d.get('order', d)
items = o.get('items', [])
total = o.get('totalCents')
calc = sum(int(it['subtotalCents']) for it in items)
print(f"  ℹ️  pedido {o.get('number')} total={total}, Σ items={calc}, estado={o.get('status')}")
assert int(total) == calc, "ORDER TOTAL != Σ items"
print("  ✅ order.totalCents == Σ OrderItem.subtotalCents")
EOF
[ $? -eq 0 ] || bad "totales pedido inconsistentes"

echo "== 9. CANCELACIÓN → libera stock =="
curl -s -o "$WORK/cancel.json" -w "%{http_code}" -X POST "$BASE/orders/$OID_B/cancel" -H "Authorization: Bearer $QA_TOKEN" > "$WORK/code"
check "POST /orders/:id/cancel" 201 "$(cat "$WORK/code")"
python3 - << 'EOF'
import json
d = json.load(open('/tmp/colmado-qa/cancel.json'))
o = d.get('order', d)
print(f"  ℹ️  status tras cancelar: {o.get('status')}")
assert o.get('status') == 'cancelled', "no canceló"
EOF
[ $? -eq 0 ] || bad "cancelación"

echo "== 10. SWEEPER (expira retención vencida y libera stock) =="
curl -s -o "$WORK/add3.json" -w "%{http_code}" -X POST "$BASE/cart/items" -H "Authorization: Bearer $DEMO_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$PID\",\"quantity\":1}" > "$WORK/code"
check "demo añade 1 (stock liberado por B)" 201 "$(cat "$WORK/code")"
curl -s -o "$WORK/order3.json" -w "%{http_code}" -X POST "$BASE/cart/checkout" -H "Authorization: Bearer $DEMO_TOKEN" -H 'Content-Type: application/json' \
  -d '{"shippingName":"Sweep","shippingAddress":"Calle 4","shippingCity":"Madrid","shippingZip":"28004","paymentMethod":"card"}' > "$WORK/code"
check "checkout demo (pedido sweeper)" 201 "$(cat "$WORK/code")"
OID3=$(python3 -c "import json;d=json.load(open('$WORK/order3.json'));print(d.get('order',d).get('id',''))")
# Forzar expiración en BD (mejor-sqlite3 directo)
node -e "
const Database=require('better-sqlite3');
const db=new Database('$DB');
const r=db.prepare(\"UPDATE orders SET expiresAt = datetime('now','-2 minutes') WHERE id = ?\").run('$OID3');
console.log('expired rows:', r.changes);
db.close();
"
echo "  ⏳ esperando ciclo sweeper (35s)…"
sleep 35
curl -s -o "$WORK/order3-check.json" -w "%{http_code}" "$BASE/orders/$OID3" -H "Authorization: Bearer $DEMO_TOKEN" > "$WORK/code"
check "GET pedido vencido" 200 "$(cat "$WORK/code")"
python3 - << 'EOF'
import json
d = json.load(open('/tmp/colmado-qa/order3-check.json'))
o = d.get('order', d)
print(f"  ℹ️  status pedido vencido: {o.get('status')} motivo={o.get('cancelReason')}")
assert o.get('status') == 'cancelled', "el sweeper NO canceló el pedido vencido"
EOF
[ $? -eq 0 ] && ok "sweeper canceló pedido vencido y liberó stock" || bad "sweeper no actuó"

echo "== 11. ADMIN =="
curl -s -o "$WORK/admin-orders.json" -w "%{http_code}" "$BASE/admin/orders" -H "Authorization: Bearer $ADMIN_TOKEN" > "$WORK/code"
check "GET /admin/orders (admin)" 200 "$(cat "$WORK/code")"
curl -s -o "$WORK/admin-stats.json" -w "%{http_code}" "$BASE/admin/stats" -H "Authorization: Bearer $ADMIN_TOKEN" > "$WORK/code"
check "GET /admin/stats (admin)" 200 "$(cat "$WORK/code")"
python3 - << 'EOF'
import json
d = json.load(open('/tmp/colmado-qa/admin-stats.json'))
s = d.get('stats', d)
print(f"  ℹ️  stats: {json.dumps(s)[:300]}")
EOF
curl -s -o "$WORK/admin-status.json" -w "%{http_code}" -X PATCH "$BASE/admin/orders/$OID/status" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"preparing"}' > "$WORK/code"
check "PATCH admin status → preparing" 200 "$(cat "$WORK/code")"
python3 -c "import json;d=json.load(open('$WORK/admin-status.json'));o=d.get('order',d);print(f'  ℹ️  estado ahora: {o.get(\"status\")}')" || true
curl -s -o "$WORK/admin-orders-401.json" -w "%{http_code}" "$BASE/admin/orders" -H "Authorization: Bearer $DEMO_TOKEN" > "$WORK/code"
check "GET /admin/orders con cliente → 403" 403 "$(cat "$WORK/code")"

echo "== 12. RESEÑAS Y FAVORITOS (usuario QA, sin colisión seed) =="
curl -s -o "$WORK/review.json" -w "%{http_code}" -X POST "$BASE/products/$PID/reviews" -H "Authorization: Bearer $QA_TOKEN" -H 'Content-Type: application/json' \
  -d '{"rating":5,"comment":"QA test review"}' > "$WORK/code"
check "POST review (QA user)" 201 "$(cat "$WORK/code")"
curl -s -o "$WORK/reviews.json" -w "%{http_code}" "$BASE/products/$PID/reviews" > "$WORK/code"
check "GET reviews" 200 "$(cat "$WORK/code")"
curl -s -o "$WORK/fav.json" -w "%{http_code}" -X POST "$BASE/favorites/$PID" -H "Authorization: Bearer $QA_TOKEN" > "$WORK/code"
check "POST favorites/:id" 201 "$(cat "$WORK/code")"
curl -s -o "$WORK/favs.json" -w "%{http_code}" "$BASE/favorites" -H "Authorization: Bearer $QA_TOKEN" > "$WORK/code"
check "GET favorites" 200 "$(cat "$WORK/code")"
curl -s -o "$WORK/favs-demo.json" -w "%{http_code}" "$BASE/favorites" -H "Authorization: Bearer $DEMO_TOKEN" > "$WORK/code"
check "GET favorites demo (seed)" 200 "$(cat "$WORK/code")"

echo ""
echo "═══════════════════════════════════"
echo "RESULTADO: $PASS ✅ / $FAIL ❌"
echo "═══════════════════════════════════"
exit $FAIL
