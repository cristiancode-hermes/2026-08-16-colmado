// QA DB fix — colmado: pan stock + sweeper state check
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '../data/colmado.db');
const db = new Database(dbPath);
const pan = db.prepare("UPDATE products SET stock = 1 WHERE name LIKE 'Pan de pueblo%'").run();
console.log('pan updated rows:', pan.changes);
const o5 = db.prepare("SELECT number, status, cancelReason FROM orders WHERE number = '2026-0816-0005'").get();
console.log('o5 (vencido):', JSON.stringify(o5));
const counts = db.prepare("SELECT status, COUNT(*) n FROM orders GROUP BY status").all();
console.log('orders by status:', JSON.stringify(counts));
db.close();
