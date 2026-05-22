"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const error_1 = require("../middleware/error");
const payment_service_1 = require("../services/payment.service");
exports.paymentRouter = (0, express_1.Router)();
exports.paymentRouter.use(auth_1.requireAuth);
async function findInvoice(id, userId) {
    const [rows] = await db_1.pool.execute("SELECT id, invoice_number, total, currency FROM invoices WHERE id = :id AND user_id = :userId", { id, userId });
    const invoice = rows[0];
    if (!invoice)
        throw new error_1.AppError(404, "Invoice not found");
    return invoice;
}
exports.paymentRouter.post("/:id/stripe", async (req, res, next) => {
    try {
        res.json(await (0, payment_service_1.createStripeCheckout)(await findInvoice(req.params.id, req.user.id)));
    }
    catch (error) {
        next(error);
    }
});
exports.paymentRouter.post("/:id/razorpay", async (req, res, next) => {
    try {
        res.json(await (0, payment_service_1.createRazorpayOrder)(await findInvoice(req.params.id, req.user.id)));
    }
    catch (error) {
        next(error);
    }
});
exports.paymentRouter.get("/", async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute(`SELECT p.*, i.invoice_number, i.customer_name
       FROM payments p
       INNER JOIN invoices i ON i.id = p.invoice_id
       WHERE i.user_id = :userId
       ORDER BY p.created_at DESC`, { userId: req.user.id });
        res.json(rows);
    }
    catch (error) {
        next(error);
    }
});
exports.paymentRouter.post("/:id/manual", async (req, res, next) => {
    try {
        const invoice = await findInvoice(req.params.id, req.user.id);
        const amount = Math.max(Number(req.body.amount ?? invoice.total), 0);
        if (amount <= 0)
            throw new error_1.AppError(422, "Payment amount must be greater than zero");
        await db_1.pool.execute(`INSERT INTO payments (invoice_id, provider, provider_ref, amount, currency, status, metadata)
       VALUES (:invoiceId, 'manual', :providerRef, :amount, :currency, 'paid', JSON_OBJECT('note', :note))`, {
            invoiceId: invoice.id,
            providerRef: req.body.reference ?? null,
            amount,
            currency: invoice.currency,
            note: req.body.note ?? "",
        });
        const [paidRows] = await db_1.pool.execute("SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE invoice_id = :invoiceId AND status='paid'", {
            invoiceId: invoice.id,
        });
        const paid = Number(paidRows[0]?.paid ?? 0);
        if (paid >= Number(invoice.total)) {
            await db_1.pool.execute("UPDATE invoices SET status='Paid', paid_at=NOW() WHERE id=:id AND user_id=:userId", {
                id: invoice.id,
                userId: req.user.id,
            });
        }
        res.status(201).json({ message: "Payment recorded", paid, total: invoice.total });
    }
    catch (error) {
        next(error);
    }
});
exports.paymentRouter.post("/:paymentId/refund", async (req, res, next) => {
    try {
        const [result] = await db_1.pool.execute(`UPDATE payments p
       INNER JOIN invoices i ON i.id = p.invoice_id
       SET p.status='refunded', p.metadata = JSON_OBJECT('refundReason', :reason)
       WHERE p.id = :paymentId AND i.user_id = :userId`, { paymentId: req.params.paymentId, userId: req.user.id, reason: req.body.reason ?? "" });
        if (result.affectedRows === 0)
            throw new error_1.AppError(404, "Payment not found");
        res.json({ message: "Payment marked as refunded" });
    }
    catch (error) {
        next(error);
    }
});
exports.paymentRouter.post("/:id/mark-paid", async (req, res, next) => {
    try {
        const invoice = await findInvoice(req.params.id, req.user.id);
        await db_1.pool.execute(`INSERT INTO payments (invoice_id, provider, amount, currency, status, metadata)
       VALUES (:invoiceId, 'manual', :amount, :currency, 'paid', JSON_OBJECT('source', 'mark_paid'))
       ON DUPLICATE KEY UPDATE status = status`, { invoiceId: invoice.id, amount: invoice.total, currency: invoice.currency });
        const [result] = await db_1.pool.execute("UPDATE invoices SET status='Paid', paid_at=NOW() WHERE id=:id AND user_id=:userId", {
            id: req.params.id,
            userId: req.user.id,
        });
        if (result.affectedRows === 0)
            throw new error_1.AppError(404, "Invoice not found");
        res.json({ message: "Invoice marked as paid" });
    }
    catch (error) {
        next(error);
    }
});
