"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.use(auth_1.requireAuth);
exports.adminRouter.get("/users", async (_req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute(`SELECT u.id, u.name, u.email, u.role, u.created_at, COUNT(i.id) invoice_count, COALESCE(SUM(i.total),0) total_billed
       FROM users u LEFT JOIN invoices i ON i.user_id = u.id GROUP BY u.id ORDER BY u.created_at DESC`);
        res.json(rows);
    }
    catch (error) {
        next(error);
    }
});
exports.adminRouter.get("/analytics", async (_req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute(`SELECT COUNT(DISTINCT u.id) users, COUNT(i.id) invoices, COALESCE(SUM(i.total),0) total_volume,
       COALESCE(SUM(i.status='Paid'),0) paid_count FROM users u LEFT JOIN invoices i ON i.user_id = u.id`);
        res.json(rows[0]);
    }
    catch (error) {
        next(error);
    }
});
