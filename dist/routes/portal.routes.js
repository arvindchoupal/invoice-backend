"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.portalRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const auth_2 = require("../utils/auth");
exports.portalRouter = (0, express_1.Router)();
exports.portalRouter.post("/tokens/:invoiceId", auth_1.requireAuth, async (req, res, next) => {
    try {
        const token = (0, auth_2.randomToken)();
        await db_1.pool.execute("INSERT INTO client_portal_tokens (invoice_id, token, expires_at) VALUES (:invoiceId, :token, DATE_ADD(NOW(), INTERVAL 30 DAY))", { invoiceId: req.params.invoiceId, token });
        res.status(201).json({ token, url: `/portal/${token}` });
    }
    catch (error) {
        next(error);
    }
});
exports.portalRouter.get("/:token", async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute(`SELECT i.id, i.invoice_number, i.customer_name, i.customer_email, i.status, i.issue_date, i.due_date, i.total, i.currency
       FROM client_portal_tokens t
       INNER JOIN invoices i ON i.id = t.invoice_id
       WHERE t.token = :token AND (t.expires_at IS NULL OR t.expires_at > NOW())`, { token: req.params.token });
        const invoice = rows[0];
        res.json({ invoice });
    }
    catch (error) {
        next(error);
    }
});
