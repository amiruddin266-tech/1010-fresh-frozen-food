import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const file = process.env.DB_FILE || './data/1010.db';
mkdirSync(dirname(file), {recursive:true});
const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_no TEXT UNIQUE NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 payment_status TEXT NOT NULL DEFAULT 'pending',
 customer_name TEXT NOT NULL,
 email TEXT NOT NULL,
 phone TEXT NOT NULL,
 address TEXT NOT NULL,
 city TEXT NOT NULL,
 postcode TEXT NOT NULL,
 state TEXT NOT NULL,
 notes TEXT,
 total_cents INTEGER NOT NULL,
 billplz_id TEXT UNIQUE,
 billplz_url TEXT,
 notification_sent INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 paid_at TEXT
);
CREATE TABLE IF NOT EXISTS order_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id TEXT NOT NULL,
 product_name TEXT NOT NULL,
 size TEXT NOT NULL,
 weight_range TEXT NOT NULL,
 quantity INTEGER NOT NULL,
 unit_price_cents INTEGER NOT NULL,
 line_total_cents INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(payment_status);
`);

const orderColumns = db.prepare('PRAGMA table_info(orders)').all().map(column => column.name);
const orderMigrations = {
 subtotal_cents: 'INTEGER NOT NULL DEFAULT 0',
 delivery_method: "TEXT NOT NULL DEFAULT 'delivery'",
 pickup_location: 'TEXT',
 distance_km: 'REAL',
 delivery_fee_cents: 'INTEGER NOT NULL DEFAULT 0'
};
for (const [column, definition] of Object.entries(orderMigrations)) {
 if (!orderColumns.includes(column)) db.exec(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`);
}

export function createOrder(data, items){
 const orderNo = `1010-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
 const now = new Date().toISOString();
 const insert = db.transaction(()=>{
    const r=db.prepare(`INSERT INTO orders(order_no,status,payment_status,customer_name,email,phone,address,city,postcode,state,notes,subtotal_cents,delivery_method,pickup_location,distance_km,delivery_fee_cents,total_cents,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(orderNo,'pending','pending',data.customerName,data.email,data.phone,data.address,data.city,data.postcode,data.state,data.notes||null,data.subtotalCents,data.deliveryMethod,data.pickupLocation||null,data.distanceKm??null,data.deliveryFeeCents,data.totalCents,now);
  const stmt=db.prepare(`INSERT INTO order_items(order_id,product_id,product_name,size,weight_range,quantity,unit_price_cents,line_total_cents) VALUES(?,?,?,?,?,?,?,?)`);
  for(const i of items) stmt.run(r.lastInsertRowid,i.productId,i.productName,i.size,i.weightRange,i.quantity,i.unitPriceCents,i.lineTotalCents);
  return Number(r.lastInsertRowid);
 })();
 return getOrderById(insert);
}
export function getOrderById(id){
 const o=db.prepare('SELECT * FROM orders WHERE id=?').get(id); if(!o) return null;
 o.items=db.prepare('SELECT * FROM order_items WHERE order_id=?').all(id); return o;
}
export function getOrderByNo(no){
 const o=db.prepare('SELECT * FROM orders WHERE order_no=?').get(no); if(!o) return null;
 o.items=db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id); return o;
}
export function setBill(orderId,billId,url){db.prepare('UPDATE orders SET billplz_id=?,billplz_url=? WHERE id=?').run(billId,url,orderId);}
export function markPaid(billId, paidAt){
 const order=db.prepare('SELECT * FROM orders WHERE billplz_id=?').get(billId); if(!order) return null;
 db.prepare(`UPDATE orders SET payment_status='paid',status='confirmed',paid_at=? WHERE id=? AND payment_status<>'paid'`).run(paidAt||new Date().toISOString(),order.id);
 return getOrderById(order.id);
}
export function markNotificationSent(id){db.prepare('UPDATE orders SET notification_sent=1 WHERE id=?').run(id);}
export function listOrders(limit=100){return db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?').all(limit);}
export {db};
