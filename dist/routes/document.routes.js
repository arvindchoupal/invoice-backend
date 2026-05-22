"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
exports.documentRouter = (0, express_1.Router)();
exports.documentRouter.use(auth_1.requireAuth);
exports.documentRouter.get("/", async (req, res, next) => {
    try {
        const type = String(req.query.type ?? "all");
        const [rows] = await db_1.pool.execute(`SELECT * FROM finance_documents
       WHERE user_id = :userId AND (:type = 'all' OR document_type = :type)
       ORDER BY created_at DESC`, { userId: req.user.id, type });
        res.json(rows);
    }
    catch (error) {
        next(error);
    }
});
exports.documentRouter.post("/", async (req, res, next) => {
    try {
        const body = req.body;
        const [result] = await db_1.pool.execute(`INSERT INTO finance_documents (user_id, client_id, source_invoice_id, document_type, document_number, status, issue_date, due_date,
        currency, party_name, party_email, party_tax_id, subtotal, tax_total, discount_total, total, notes, metadata)
       VALUES (:userId, :clientId, :sourceInvoiceId, :documentType, :documentNumber, :status, :issueDate, :dueDate,
        :currency, :partyName, :partyEmail, :partyTaxId, :subtotal, :taxTotal, :discountTotal, :total, :notes, CAST(:metadata AS JSON))`, {
            userId: req.user.id,
            clientId: body.clientId ?? null,
            sourceInvoiceId: body.sourceInvoiceId ?? null,
            documentType: body.documentType,
            documentNumber: body.documentNumber,
            status: body.status ?? "Draft",
            issueDate: body.issueDate,
            dueDate: body.dueDate ?? null,
            currency: body.currency ?? "USD",
            partyName: body.partyName,
            partyEmail: body.partyEmail ?? null,
            partyTaxId: body.partyTaxId ?? null,
            subtotal: Number(body.subtotal ?? 0),
            taxTotal: Number(body.taxTotal ?? 0),
            discountTotal: Number(body.discountTotal ?? 0),
            total: Number(body.total ?? 0),
            notes: body.notes ?? null,
            metadata: JSON.stringify(body.metadata ?? {}),
        });
        res.status(201).json({ id: result.insertId });
    }
    catch (error) {
        next(error);
    }
});
