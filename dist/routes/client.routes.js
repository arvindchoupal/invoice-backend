"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db");
const error_1 = require("../middleware/error");
const auth_1 = require("../middleware/auth");
const validators_1 = require("../utils/validators");
exports.clientRouter = (0, express_1.Router)();
exports.clientRouter.use(auth_1.requireAuth);
exports.clientRouter.get("/", async (req, res, next) => {
    try {
        const search = `%${String(req.query.search ?? "")}%`;
        const [rows] = await db_1.pool.execute(`SELECT c.*,
        COUNT(i.id) AS invoice_count,
        COALESCE(SUM(i.total), 0) AS lifetime_value,
        COALESCE(SUM(CASE WHEN i.status <> 'Paid' THEN i.total ELSE 0 END), 0) AS outstanding_amount,
        COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.total ELSE 0 END), 0) AS paid_amount,
        MAX(i.issue_date) AS last_invoice_date
       FROM clients c
       LEFT JOIN invoices i ON i.client_id = c.id
       WHERE c.user_id = :userId AND (c.name LIKE :search OR c.email LIKE :search)
       GROUP BY c.id
       ORDER BY c.created_at DESC`, { userId: req.user.id, search });
        res.json(rows);
    }
    catch (error) {
        next(error);
    }
});
exports.clientRouter.get("/:id", async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute(`SELECT c.*,
        COUNT(i.id) AS invoice_count,
        COALESCE(SUM(i.total), 0) AS lifetime_value,
        COALESCE(SUM(CASE WHEN i.status <> 'Paid' THEN i.total ELSE 0 END), 0) AS outstanding_amount,
        COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.total ELSE 0 END), 0) AS paid_amount,
        MAX(i.issue_date) AS last_invoice_date
       FROM clients c
       LEFT JOIN invoices i ON i.client_id = c.id
       WHERE c.user_id = :userId AND c.id = :id
       GROUP BY c.id`, { userId: req.user.id, id: req.params.id });
        const client = rows[0];
        if (!client)
            throw new error_1.AppError(404, "Client not found");
        const [history] = await db_1.pool.execute("SELECT id, invoice_number, status, issue_date, due_date, total, currency FROM invoices WHERE user_id = :userId AND client_id = :id ORDER BY issue_date DESC", { userId: req.user.id, id: req.params.id });
        const [payments] = await db_1.pool.execute(`SELECT p.*, i.invoice_number
       FROM payments p
       INNER JOIN invoices i ON i.id = p.invoice_id
       WHERE i.user_id = :userId AND i.client_id = :id
       ORDER BY p.created_at DESC`, { userId: req.user.id, id: req.params.id });
        res.json({ client, history, payments });
    }
    catch (error) {
        next(error);
    }
});
exports.clientRouter.post("/", async (req, res, next) => {
    try {
        const body = validators_1.clientSchema.parse(req.body);
        const [result] = await db_1.pool.execute(`INSERT INTO clients (user_id, name, email, phone, tax_id, billing_address, shipping_address, notes)
       VALUES (:userId, :name, :email, :phone, :taxId, :billingAddress, :shippingAddress, :notes)`, { userId: req.user.id, ...body });
        res.status(201).json({ id: result.insertId, ...body });
    }
    catch (error) {
        next(error);
    }
});
exports.clientRouter.get("/:id/history", async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute("SELECT id, invoice_number, status, issue_date, due_date, total, currency FROM invoices WHERE user_id = :userId AND client_id = :id ORDER BY issue_date DESC", { userId: req.user.id, id: req.params.id });
        res.json(rows);
    }
    catch (error) {
        next(error);
    }
});
exports.clientRouter.put("/:id", async (req, res, next) => {
    try {
        const body = validators_1.clientSchema.parse(req.body);
        const [result] = await db_1.pool.execute(`UPDATE clients SET name=:name, email=:email, phone=:phone, tax_id=:taxId, billing_address=:billingAddress,
       shipping_address=:shippingAddress, notes=:notes WHERE id=:id AND user_id=:userId`, { id: req.params.id, userId: req.user.id, ...body });
        if (result.affectedRows === 0)
            throw new error_1.AppError(404, "Client not found");
        res.json({ id: Number(req.params.id), ...body });
    }
    catch (error) {
        next(error);
    }
});
exports.clientRouter.delete("/:id", async (req, res, next) => {
    try {
        const [result] = await db_1.pool.execute("DELETE FROM clients WHERE id = :id AND user_id = :userId", {
            id: req.params.id,
            userId: req.user.id,
        });
        if (result.affectedRows === 0)
            throw new error_1.AppError(404, "Client not found");
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
