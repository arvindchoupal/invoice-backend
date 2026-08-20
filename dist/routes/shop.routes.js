"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../config/db");
const error_1 = require("../middleware/error");
const auth_1 = require("../middleware/auth");
exports.shopRouter = (0, express_1.Router)();
const parseJson = (value, fallback) => value == null ? fallback : typeof value === "string" ? JSON.parse(value) : value;
const productOut = (row) => ({ id: Number(row.id), slug: row.slug, name: row.name, description: row.description || "", category: row.category, price: Number(row.price), compareAt: row.compare_at_price == null ? undefined : Number(row.compare_at_price), image: row.image_url, images: parseJson(row.images, []), colors: parseJson(row.colors, []), sizes: parseJson(row.sizes, []), badge: row.badge || undefined, inventory: Number(row.inventory), featured: Boolean(row.featured), status: row.status });
exports.shopRouter.get("/products", async (req, res, next) => { try {
    const featured = req.query.featured === "true";
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const params = {};
    let where = "status='active'";
    if (featured)
        where += " AND featured=1";
    if (category) {
        where += " AND category=:category";
        params.category = category;
    }
    const [rows] = await db_1.pool.execute(`SELECT * FROM shop_products WHERE ${where} ORDER BY featured DESC, created_at DESC`, params);
    res.json({ products: rows.map(productOut) });
}
catch (e) {
    next(e);
} });
exports.shopRouter.get("/products/:slug", async (req, res, next) => { try {
    const slug = zod_1.z.string().trim().min(2).max(160).parse(req.params.slug);
    const [rows] = await db_1.pool.execute("SELECT * FROM shop_products WHERE slug=:slug AND status='active' LIMIT 1", { slug });
    const row = rows[0];
    if (!row)
        throw new error_1.AppError(404, "Product not found");
    res.json({ product: productOut(row) });
}
catch (e) {
    next(e);
} });
exports.shopRouter.get("/collections", async (_req, res, next) => { try {
    const [rows] = await db_1.pool.execute("SELECT category AS name, COUNT(*) AS productCount, MIN(image_url) AS image FROM shop_products WHERE status='active' GROUP BY category ORDER BY category");
    res.json({ collections: rows });
}
catch (e) {
    next(e);
} });
const orderSchema = zod_1.z.object({ customer: zod_1.z.object({ email: zod_1.z.string().email(), firstName: zod_1.z.string().min(1).max(100), lastName: zod_1.z.string().min(1).max(100), phone: zod_1.z.string().max(40).optional() }), shippingAddress: zod_1.z.object({ address: zod_1.z.string().min(5).max(500), city: zod_1.z.string().min(2).max(100), state: zod_1.z.string().min(2).max(100), postalCode: zod_1.z.string().min(4).max(12), country: zod_1.z.string().default("India") }), items: zod_1.z.array(zod_1.z.object({ productId: zod_1.z.number().int().positive(), quantity: zod_1.z.number().int().min(1).max(20), variant: zod_1.z.string().max(120).optional() })).min(1).max(50), paymentMethod: zod_1.z.enum(["cod", "razorpay"]).default("cod"), notes: zod_1.z.string().max(1000).optional() });
exports.shopRouter.post("/orders", async (req, res, next) => { try {
    const input = orderSchema.parse(req.body);
    const result = await (0, db_1.withTransaction)(async (db) => { const ids = input.items.map(x => x.productId); const placeholders = ids.map(() => "?").join(","); const [rows] = await db.query(`SELECT id,name,price,inventory FROM shop_products WHERE status='active' AND id IN (${placeholders}) FOR UPDATE`, ids); const products = rows; if (products.length !== new Set(ids).size)
        throw new error_1.AppError(400, "One or more products are unavailable"); const items = input.items.map(item => { const p = products.find(x => Number(x.id) === item.productId); if (p.inventory < item.quantity)
        throw new error_1.AppError(409, `${p.name} has insufficient stock`); return { ...item, name: p.name, unitPrice: Number(p.price), total: Number(p.price) * item.quantity }; }); const subtotal = items.reduce((n, x) => n + x.total, 0); const shipping = subtotal >= 3500 ? 0 : 199; const [customerResult] = await db.execute(`INSERT INTO shop_customers(email,first_name,last_name,phone) VALUES(:email,:firstName,:lastName,:phone) ON DUPLICATE KEY UPDATE first_name=VALUES(first_name),last_name=VALUES(last_name),phone=VALUES(phone),id=LAST_INSERT_ID(id)`, { ...input.customer, phone: input.customer.phone || null }); const customerId = Number(customerResult.insertId); const orderNumber = `NRD-${Date.now().toString().slice(-8)}`; const [orderResult] = await db.execute(`INSERT INTO shop_orders(order_number,customer_id,payment_method,subtotal,shipping_total,total,shipping_address,notes) VALUES(:orderNumber,:customerId,:paymentMethod,:subtotal,:shipping,:total,:address,:notes)`, { orderNumber, customerId, paymentMethod: input.paymentMethod, subtotal, shipping, total: subtotal + shipping, address: JSON.stringify(input.shippingAddress), notes: input.notes || null }); for (const item of items) {
        await db.execute("INSERT INTO shop_order_items(order_id,product_id,product_name,variant,quantity,unit_price,total) VALUES(?,?,?,?,?,?,?)", [orderResult.insertId, item.productId, item.name, item.variant || null, item.quantity, item.unitPrice, item.total]);
        await db.execute("UPDATE shop_products SET inventory=inventory-? WHERE id=?", [item.quantity, item.productId]);
    } await db.execute("UPDATE shop_customers SET orders_count=orders_count+1,total_spent=total_spent+? WHERE id=?", [subtotal + shipping, customerId]); return { id: orderResult.insertId, orderNumber, total: subtotal + shipping, status: "pending" }; });
    res.status(201).json({ order: result });
}
catch (e) {
    next(e);
} });
const eventSchema = zod_1.z.object({ eventName: zod_1.z.string().min(1).max(100), eventId: zod_1.z.string().max(100).optional(), sessionId: zod_1.z.string().max(100).optional(), pagePath: zod_1.z.string().max(500).optional(), properties: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional() });
exports.shopRouter.post("/events", async (req, res, next) => { try {
    const e = eventSchema.parse(req.body);
    await db_1.pool.execute("INSERT INTO shop_events(event_name,event_id,session_id,page_path,properties) VALUES(:eventName,:eventId,:sessionId,:pagePath,:properties)", { ...e, eventId: e.eventId || null, sessionId: e.sessionId || null, pagePath: e.pagePath || null, properties: e.properties ? JSON.stringify(e.properties) : null });
    res.status(202).json({ ok: true });
}
catch (e) {
    next(e);
} });
exports.shopRouter.use("/admin", auth_1.requireAuth, (0, auth_1.requireRole)("admin"));
exports.shopRouter.get("/admin/dashboard", async (_req, res, next) => { try {
    const [[sales], [orders], [customers], [inventory]] = await Promise.all([db_1.pool.query("SELECT COALESCE(SUM(total),0) total FROM shop_orders WHERE status <> 'cancelled'"), db_1.pool.query("SELECT COUNT(*) count FROM shop_orders"), db_1.pool.query("SELECT COUNT(*) count FROM shop_customers"), db_1.pool.query("SELECT COALESCE(SUM(inventory),0) count FROM shop_products WHERE status='active'")]);
    res.json({ sales: Number(sales[0].total), orders: Number(orders[0].count), customers: Number(customers[0].count), inventory: Number(inventory[0].count) });
}
catch (e) {
    next(e);
} });
exports.shopRouter.get("/admin/orders", async (_req, res, next) => { try {
    const [rows] = await db_1.pool.execute("SELECT o.*, CONCAT(c.first_name,' ',c.last_name) customer_name,c.email customer_email FROM shop_orders o JOIN shop_customers c ON c.id=o.customer_id ORDER BY o.created_at DESC");
    res.json({ orders: rows });
}
catch (e) {
    next(e);
} });
exports.shopRouter.get("/admin/customers", async (_req, res, next) => { try {
    const [rows] = await db_1.pool.execute("SELECT id,email,first_name,last_name,phone,orders_count,total_spent,created_at FROM shop_customers ORDER BY created_at DESC");
    res.json({ customers: rows });
}
catch (e) {
    next(e);
} });
exports.shopRouter.get("/admin/products", async (_req, res, next) => { try {
    const [rows] = await db_1.pool.execute("SELECT * FROM shop_products ORDER BY created_at DESC");
    res.json({ products: rows.map(productOut) });
}
catch (e) {
    next(e);
} });
exports.shopRouter.get("/admin/products/:id", async (req, res, next) => { try {
    const id = zod_1.z.coerce.number().int().positive().parse(req.params.id);
    const [rows] = await db_1.pool.execute("SELECT * FROM shop_products WHERE id=:id LIMIT 1", { id });
    const row = rows[0];
    if (!row)
        throw new error_1.AppError(404, "Product not found");
    res.json({ product: productOut(row) });
}
catch (e) {
    next(e);
} });
const productSchema = zod_1.z.object({ slug: zod_1.z.string().min(2).max(160).regex(/^[a-z0-9-]+$/), name: zod_1.z.string().min(2).max(220), description: zod_1.z.string().max(5000).default(""), category: zod_1.z.string().min(2).max(120), price: zod_1.z.number().positive(), compareAt: zod_1.z.number().positive().nullable().optional(), image: zod_1.z.string().url().max(1000), colors: zod_1.z.array(zod_1.z.string()).max(20).default([]), sizes: zod_1.z.array(zod_1.z.string()).max(30).default([]), badge: zod_1.z.string().max(60).nullable().optional(), inventory: zod_1.z.number().int().min(0), status: zod_1.z.enum(["draft", "active", "archived"]).default("active"), featured: zod_1.z.boolean().default(false) });
exports.shopRouter.post("/admin/products", async (req, res, next) => { try {
    const p = productSchema.parse(req.body);
    const [result] = await db_1.pool.execute(`INSERT INTO shop_products(slug,name,description,category,price,compare_at_price,image_url,colors,sizes,badge,inventory,status,featured) VALUES(:slug,:name,:description,:category,:price,:compareAt,:image,:colors,:sizes,:badge,:inventory,:status,:featured)`, { ...p, compareAt: p.compareAt || null, colors: JSON.stringify(p.colors), sizes: JSON.stringify(p.sizes), badge: p.badge || null, featured: p.featured ? 1 : 0 });
    res.status(201).json({ product: { ...p, id: result.insertId } });
}
catch (e) {
    next(e);
} });
exports.shopRouter.put("/admin/products/:id", async (req, res, next) => { try {
    const id = zod_1.z.coerce.number().int().positive().parse(req.params.id);
    const p = productSchema.parse(req.body);
    const [result] = await db_1.pool.execute(`UPDATE shop_products SET slug=:slug,name=:name,description=:description,category=:category,price=:price,compare_at_price=:compareAt,image_url=:image,colors=:colors,sizes=:sizes,badge=:badge,inventory=:inventory,status=:status,featured=:featured WHERE id=:id`, { ...p, id, compareAt: p.compareAt || null, colors: JSON.stringify(p.colors), sizes: JSON.stringify(p.sizes), badge: p.badge || null, featured: p.featured ? 1 : 0 });
    if (!result.affectedRows)
        throw new error_1.AppError(404, "Product not found");
    res.json({ product: { ...p, id } });
}
catch (e) {
    next(e);
} });
exports.shopRouter.patch("/admin/orders/:id/status", async (req, res, next) => { try {
    const id = zod_1.z.coerce.number().int().positive().parse(req.params.id);
    const { status } = zod_1.z.object({ status: zod_1.z.enum(["pending", "paid", "processing", "shipped", "delivered", "cancelled"]) }).parse(req.body);
    const [result] = await db_1.pool.execute("UPDATE shop_orders SET status=:status WHERE id=:id", { id, status });
    if (!result.affectedRows)
        throw new error_1.AppError(404, "Order not found");
    res.json({ id, status });
}
catch (e) {
    next(e);
} });
exports.shopRouter.get("/admin/settings", async (_req, res, next) => { try {
    const [rows] = await db_1.pool.execute("SELECT * FROM shop_settings WHERE id=1");
    res.json({ settings: rows[0] });
}
catch (e) {
    next(e);
} });
exports.shopRouter.put("/admin/settings", async (req, res, next) => { try {
    const s = zod_1.z.object({ storeName: zod_1.z.string().min(2).max(180), supportEmail: zod_1.z.string().email(), currency: zod_1.z.string().length(3), country: zod_1.z.string().min(2).max(100), freeShippingThreshold: zod_1.z.number().min(0), flatShippingRate: zod_1.z.number().min(0), codEnabled: zod_1.z.boolean() }).parse(req.body);
    await db_1.pool.execute(`UPDATE shop_settings SET store_name=:storeName,support_email=:supportEmail,currency=:currency,country=:country,free_shipping_threshold=:freeShippingThreshold,flat_shipping_rate=:flatShippingRate,cod_enabled=:codEnabled WHERE id=1`, { ...s, codEnabled: s.codEnabled ? 1 : 0 });
    res.json({ settings: s });
}
catch (e) {
    next(e);
} });
