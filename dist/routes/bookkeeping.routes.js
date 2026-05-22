"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookkeepingRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
exports.bookkeepingRouter = (0, express_1.Router)();
exports.bookkeepingRouter.use(auth_1.requireAuth);
function classifyCategory(text) {
    const value = text.toLowerCase();
    if (/gst|vat|tax/.test(value))
        return "taxes";
    if (/raw|material|inventory|purchase/.test(value))
        return "purchases";
    if (/rent|utility|travel|fuel|software|salary|contractor/.test(value))
        return "expenses";
    return "expenses";
}
exports.bookkeepingRouter.get("/summary", async (req, res, next) => {
    try {
        const [income] = await db_1.pool.execute(`SELECT DATE_FORMAT(issue_date, '%Y-%m') month, COALESCE(SUM(CASE WHEN status='Paid' THEN total ELSE 0 END),0) income
       FROM invoices WHERE user_id=:userId GROUP BY month ORDER BY month DESC LIMIT 12`, { userId: req.user.id });
        const [expenses] = await db_1.pool.execute(`SELECT DATE_FORMAT(expense_date, '%Y-%m') month, COALESCE(SUM(total),0) expenses, COALESCE(SUM(tax_total),0) taxes
       FROM expenses WHERE user_id=:userId GROUP BY month ORDER BY month DESC LIMIT 12`, { userId: req.user.id });
        const expenseByMonth = new Map(expenses.map((row) => [row.month, row]));
        const monthly = income.map((row) => {
            const expense = expenseByMonth.get(row.month);
            const expenseTotal = Number(expense?.expenses ?? 0);
            return { month: row.month, income: Number(row.income), expenses: expenseTotal, profit: Number(row.income) - expenseTotal, taxes: Number(expense?.taxes ?? 0) };
        }).reverse();
        res.json({ monthly });
    }
    catch (error) {
        next(error);
    }
});
exports.bookkeepingRouter.post("/expenses", async (req, res, next) => {
    try {
        const body = req.body;
        const category = body.category ?? classifyCategory(`${body.vendorName ?? ""} ${body.notes ?? ""}`);
        const [result] = await db_1.pool.execute(`INSERT INTO expenses (user_id, vendor_name, vendor_tax_id, expense_number, category, expense_date, currency, subtotal, tax_total, total, payment_status, source, notes, metadata)
       VALUES (:userId, :vendorName, :vendorTaxId, :expenseNumber, :category, :expenseDate, :currency, :subtotal, :taxTotal, :total, :paymentStatus, :source, :notes, CAST(:metadata AS JSON))`, {
            userId: req.user.id,
            vendorName: body.vendorName,
            vendorTaxId: body.vendorTaxId ?? null,
            expenseNumber: body.expenseNumber ?? null,
            category,
            expenseDate: body.expenseDate,
            currency: body.currency ?? "USD",
            subtotal: Number(body.subtotal ?? 0),
            taxTotal: Number(body.taxTotal ?? 0),
            total: Number(body.total ?? 0),
            paymentStatus: body.paymentStatus ?? "paid",
            source: body.source ?? "manual",
            notes: body.notes ?? null,
            metadata: JSON.stringify(body.metadata ?? {}),
        });
        res.status(201).json({ id: result.insertId, category });
    }
    catch (error) {
        next(error);
    }
});
exports.bookkeepingRouter.get("/expenses", async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute("SELECT * FROM expenses WHERE user_id=:userId ORDER BY expense_date DESC", { userId: req.user.id });
        res.json(rows);
    }
    catch (error) {
        next(error);
    }
});
