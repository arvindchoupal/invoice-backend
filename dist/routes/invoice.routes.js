"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db");
const error_1 = require("../middleware/error");
const auth_1 = require("../middleware/auth");
const email_service_1 = require("../services/email.service");
const pdf_service_1 = require("../services/pdf.service");
const invoice_1 = require("../utils/invoice");
const validators_1 = require("../utils/validators");
function invoiceSqlParams(body, totals, pdfStyle) {
    return {
        clientId: body.clientId ?? null,
        invoiceNumber: body.invoiceNumber ?? "",
        issueDate: body.issueDate,
        dueDate: body.dueDate,
        status: body.status,
        currency: body.currency,
        businessName: body.businessName,
        businessEmail: body.businessEmail || null,
        businessTaxId: body.businessTaxId || null,
        businessAddress: body.businessAddress || null,
        customerName: body.customerName,
        customerEmail: body.customerEmail || null,
        customerTaxId: body.customerTaxId || null,
        customerAddress: body.customerAddress || null,
        notes: body.notes || null,
        terms: body.terms || null,
        pdfStyle,
        ...totals,
    };
}
exports.invoiceRouter = (0, express_1.Router)();
exports.invoiceRouter.use(auth_1.requireAuth);
async function defaultPdfStyleForUser(userId, db = db_1.pool) {
    const [rows] = await db.execute("SELECT default_pdf_style FROM settings WHERE user_id = :userId", { userId });
    return (0, pdf_service_1.normalizePdfStyle)(rows[0]?.default_pdf_style);
}
async function nextInvoiceNumber(userId, prefix = "INV", db = db_1.pool) {
    const [rows] = await db.execute("SELECT invoice_counter FROM settings WHERE user_id = :userId", { userId });
    const counter = (rows[0]?.invoice_counter ?? 0) + 1;
    await db.execute(`INSERT INTO settings (user_id, invoice_counter, invoice_prefix)
     VALUES (:userId, :counter, :prefix)
     ON DUPLICATE KEY UPDATE invoice_counter = :counter`, { userId, counter, prefix });
    return (0, invoice_1.makeInvoiceNumber)(prefix, counter);
}
exports.invoiceRouter.get("/", async (req, res, next) => {
    try {
        const page = Math.max(Number(req.query.page ?? 1), 1);
        const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 10), 1), 100);
        const offset = (page - 1) * pageSize;
        const search = `%${String(req.query.search ?? "")}%`;
        const status = String(req.query.status ?? "all");
        const sortBy = ["created_at", "issue_date", "due_date", "total", "invoice_number", "status"].includes(String(req.query.sortBy))
            ? String(req.query.sortBy)
            : "created_at";
        const sortDir = String(req.query.sortDir).toLowerCase() === "asc" ? "ASC" : "DESC";
        const params = {
            userId: req.user.id,
            search,
            status,
            limit: pageSize,
            offset,
        };
        const where = `user_id = :userId
      AND (:status = 'all' OR status = :status)
      AND (invoice_number LIKE :search OR customer_name LIKE :search OR customer_email LIKE :search OR customer_tax_id LIKE :search)`;
        const [rows] = await db_1.pool.execute(`
        SELECT *
        FROM invoices
        WHERE ${where}
        ORDER BY ${sortBy} ${sortDir}
        LIMIT ${pageSize}
        OFFSET ${offset}
        `, {
            userId: req.user.id,
            search,
            status
        });
        const [countRows] = await db_1.pool.execute(`SELECT COUNT(*) total FROM invoices WHERE ${where}`, params);
        const [facets] = await db_1.pool.execute(`SELECT status, COUNT(*) count FROM invoices WHERE user_id = :userId GROUP BY status`, { userId: req.user.id });
        res.json({
            data: rows,
            pagination: {
                page,
                pageSize,
                total: Number(countRows[0]?.total ?? 0),
            },
            facets,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.invoiceRouter.get("/stats/summary", async (req, res, next) => {
    try {
        const [summary] = await db_1.pool.execute(`SELECT COUNT(*) total_invoices,
        SUM(status = 'Paid') paid_invoices,
        SUM(status IN ('Draft','Sent','Pending')) pending_invoices,
        COALESCE(SUM(CASE WHEN status='Paid' THEN total ELSE 0 END),0) revenue
       FROM invoices WHERE user_id = :userId`, { userId: req.user.id });
        const [monthly] = await db_1.pool.execute(`SELECT DATE_FORMAT(issue_date, '%Y-%m') month, COALESCE(SUM(total),0) revenue
       FROM invoices WHERE user_id = :userId GROUP BY month ORDER BY month DESC LIMIT 12`, { userId: req.user.id });
        res.json({ summary: summary[0], monthly: monthly.reverse() });
    }
    catch (error) {
        next(error);
    }
});
exports.invoiceRouter.post("/", async (req, res, next) => {
    try {
        const body = validators_1.invoiceSchema.parse(req.body);
        const totals = (0, invoice_1.calculateInvoice)(body.items);
        const { invoiceId, invoiceNumber, pdfStyle } = await (0, db_1.withTransaction)(async (connection) => {
            const invoiceNumber = body.invoiceNumber || (await nextInvoiceNumber(req.user.id, "INV", connection));
            const pdfStyle = (0, pdf_service_1.normalizePdfStyle)(body.pdfStyle ?? (await defaultPdfStyleForUser(req.user.id, connection)));
            const [result] = await connection.execute(`INSERT INTO invoices (user_id, client_id, invoice_number, issue_date, due_date, status, currency, business_name,
          business_email, business_tax_id, business_address, customer_name, customer_email, customer_tax_id, customer_address,
          notes, terms, pdf_style, subtotal, tax_total, discount_total, total)
         VALUES (:userId, :clientId, :invoiceNumber, :issueDate, :dueDate, :status, :currency, :businessName, :businessEmail,
          :businessTaxId, :businessAddress, :customerName, :customerEmail, :customerTaxId, :customerAddress, :notes, :terms,
          :pdfStyle, :subtotal, :taxTotal, :discountTotal, :total)`, { userId: req.user.id, ...invoiceSqlParams(body, totals, pdfStyle), invoiceNumber });
            const invoiceId = result.insertId;
            for (const item of body.items) {
                await connection.execute(`INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, tax_rate, discount_rate)
           VALUES (:invoiceId, :name, :description, :quantity, :unitPrice, :taxRate, :discountRate)`, { invoiceId, ...item });
            }
            return { invoiceId, invoiceNumber, pdfStyle };
        });
        res.status(201).json({ id: invoiceId, invoiceNumber, pdfStyle, ...body, ...totals });
    }
    catch (error) {
        next(error);
    }
});
exports.invoiceRouter.get("/:id", async (req, res, next) => {
    try {
        const [invoices] = await db_1.pool.execute("SELECT * FROM invoices WHERE id = :id AND user_id = :userId", {
            id: req.params.id,
            userId: req.user.id,
        });
        const invoice = invoices[0];
        if (!invoice)
            throw new error_1.AppError(404, "Invoice not found");
        const [items] = await db_1.pool.execute("SELECT * FROM invoice_items WHERE invoice_id = :id", { id: req.params.id });
        res.json({ ...invoice, items });
    }
    catch (error) {
        next(error);
    }
});
exports.invoiceRouter.put("/:id", async (req, res, next) => {
    try {
        const body = validators_1.invoiceSchema.parse(req.body);
        const totals = (0, invoice_1.calculateInvoice)(body.items);
        const { pdfStyle, invoiceNumber } = await (0, db_1.withTransaction)(async (connection) => {
            const [existingRows] = await connection.execute("SELECT invoice_number FROM invoices WHERE id = :id AND user_id = :userId", { id: req.params.id, userId: req.user.id });
            const existing = existingRows[0];
            if (!existing)
                throw new error_1.AppError(404, "Invoice not found");
            const pdfStyle = (0, pdf_service_1.normalizePdfStyle)(body.pdfStyle ?? (await defaultPdfStyleForUser(req.user.id, connection)));
            const invoiceNumber = body.invoiceNumber || existing.invoice_number;
            const [result] = await connection.execute(`UPDATE invoices SET client_id=:clientId, invoice_number=:invoiceNumber, issue_date=:issueDate, due_date=:dueDate,
         status=:status, currency=:currency, business_name=:businessName, business_email=:businessEmail, business_tax_id=:businessTaxId,
         business_address=:businessAddress, customer_name=:customerName, customer_email=:customerEmail, customer_tax_id=:customerTaxId,
         customer_address=:customerAddress, notes=:notes, terms=:terms, pdf_style=:pdfStyle, subtotal=:subtotal, tax_total=:taxTotal,
         discount_total=:discountTotal, total=:total WHERE id=:id AND user_id=:userId`, { id: req.params.id, userId: req.user.id, ...invoiceSqlParams(body, totals, pdfStyle), invoiceNumber });
            if (result.affectedRows === 0)
                throw new error_1.AppError(404, "Invoice not found");
            await connection.execute("DELETE FROM invoice_items WHERE invoice_id = :id", { id: req.params.id });
            for (const item of body.items) {
                await connection.execute(`INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, tax_rate, discount_rate)
           VALUES (:invoiceId, :name, :description, :quantity, :unitPrice, :taxRate, :discountRate)`, { invoiceId: req.params.id, ...item });
            }
            return { pdfStyle, invoiceNumber };
        });
        res.json({ id: Number(req.params.id), invoiceNumber, pdfStyle, ...body, ...totals });
    }
    catch (error) {
        next(error);
    }
});
exports.invoiceRouter.post("/:id/duplicate", async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute("SELECT * FROM invoices WHERE id = :id AND user_id = :userId", { id: req.params.id, userId: req.user.id });
        const original = rows[0];
        if (!original)
            throw new error_1.AppError(404, "Invoice not found");
        const [items] = await db_1.pool.execute("SELECT name, description, quantity, unit_price unitPrice, tax_rate taxRate, discount_rate discountRate FROM invoice_items WHERE invoice_id = :id", { id: req.params.id });
        const { newId, invoiceNumber } = await (0, db_1.withTransaction)(async (connection) => {
            const invoiceNumber = await nextInvoiceNumber(req.user.id, "INV", connection);
            const [result] = await connection.execute(`INSERT INTO invoices (user_id, client_id, invoice_number, issue_date, due_date, status, currency, business_name,
          business_email, business_tax_id, business_address, customer_name, customer_email, customer_tax_id, customer_address,
          notes, terms, pdf_style, subtotal, tax_total, discount_total, total)
         SELECT user_id, client_id, :invoiceNumber, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'Draft', currency, business_name,
          business_email, business_tax_id, business_address, customer_name, customer_email, customer_tax_id, customer_address,
          notes, terms, pdf_style, subtotal, tax_total, discount_total, total
         FROM invoices WHERE id = :id AND user_id = :userId`, { invoiceNumber, id: req.params.id, userId: req.user.id });
            const newId = result.insertId;
            for (const item of items) {
                await connection.execute(`INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, tax_rate, discount_rate)
           VALUES (:invoiceId, :name, :description, :quantity, :unitPrice, :taxRate, :discountRate)`, { invoiceId: newId, ...item });
            }
            return { newId, invoiceNumber };
        });
        res.status(201).json({ id: newId, invoiceNumber, status: "Draft" });
    }
    catch (error) {
        next(error);
    }
});
exports.invoiceRouter.delete("/:id", async (req, res, next) => {
    try {
        const [result] = await db_1.pool.execute("DELETE FROM invoices WHERE id = :id AND user_id = :userId", { id: req.params.id, userId: req.user.id });
        if (result.affectedRows === 0)
            throw new error_1.AppError(404, "Invoice not found");
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
exports.invoiceRouter.get("/:id/pdf", async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute("SELECT * FROM invoices WHERE id = :id AND user_id = :userId", { id: req.params.id, userId: req.user.id });
        const invoice = rows[0];
        if (!invoice)
            throw new error_1.AppError(404, "Invoice not found");
        const [items] = await db_1.pool.execute("SELECT * FROM invoice_items WHERE invoice_id = :id", { id: req.params.id });
        const [settingsRows] = await db_1.pool.execute("SELECT logo_url, company_name, company_email, company_address, company_tax_id FROM settings WHERE user_id = :userId", { userId: req.user.id });
        const settings = settingsRows[0] ?? {};
        const style = (0, pdf_service_1.normalizePdfStyle)(req.query.style ?? invoice.pdf_style ?? (await defaultPdfStyleForUser(req.user.id)));
        const buffer = await (0, pdf_service_1.renderInvoicePdf)(invoice, items, style, settings);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoice_number}-${style}.pdf"`);
        res.send(buffer);
    }
    catch (error) {
        next(error);
    }
});
exports.invoiceRouter.get("/:id/pdf2", async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute("SELECT * FROM invoices WHERE id = :id AND user_id = :userId", {
            id: req.params.id,
            userId: req.user.id
        });
        const invoice = rows[0];
        if (!invoice)
            throw new error_1.AppError(404, "Invoice not found");
        const [items] = await db_1.pool.execute("SELECT * FROM invoice_items WHERE invoice_id = :id", { id: req.params.id });
        const style = (0, pdf_service_1.normalizePdfStyle)(req.query.style ?? invoice.pdf_style ?? (await defaultPdfStyleForUser(req.user.id)));
        const [settingsRows] = await db_1.pool.execute("SELECT logo_url, company_name, company_email, company_address, company_tax_id FROM settings WHERE user_id = :userId", { userId: req.user.id });
        const settings = settingsRows[0] ?? {};
        const buffer = await (0, pdf_service_1.renderInvoicePdf)(invoice, items, style, settings);
        res.setHeader("Content-Type", "application/pdf");
        // changed here ↓↓↓
        res.setHeader("Content-Disposition", `inline; filename="${invoice.invoice_number}-${style}.pdf"`);
        res.send(buffer);
    }
    catch (error) {
        next(error);
    }
});
exports.invoiceRouter.get("/pdf/styles/list", (_req, res) => {
    res.json(pdf_service_1.PDF_STYLES.map((style) => pdf_service_1.PDF_STYLE_META[style]));
});
exports.invoiceRouter.post("/:id/email", async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute("SELECT id, invoice_number, customer_email FROM invoices WHERE id = :id AND user_id = :userId", { id: req.params.id, userId: req.user.id });
        const invoice = rows[0];
        if (!invoice?.customer_email)
            throw new error_1.AppError(404, "Invoice or customer email not found");
        await (0, email_service_1.sendInvoiceEmail)(invoice.customer_email, invoice.invoice_number);
        await db_1.pool.execute("INSERT INTO notifications (invoice_id, user_id, type, recipient, status, sent_at) VALUES (:invoiceId, :userId, 'invoice_email', :recipient, 'sent', NOW())", { invoiceId: req.params.id, userId: req.user.id, recipient: invoice.customer_email });
        res.json({ message: "Invoice email queued" });
    }
    catch (error) {
        next(error);
    }
});
exports.invoiceRouter.post("/:id/reminder", async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute("SELECT id, invoice_number, customer_email FROM invoices WHERE id = :id AND user_id = :userId", { id: req.params.id, userId: req.user.id });
        const invoice = rows[0];
        if (!invoice?.customer_email)
            throw new error_1.AppError(404, "Invoice or customer email not found");
        await (0, email_service_1.sendReminderEmail)(invoice.customer_email, invoice.invoice_number);
        await db_1.pool.execute("INSERT INTO notifications (invoice_id, user_id, type, recipient, status, sent_at) VALUES (:invoiceId, :userId, 'reminder', :recipient, 'sent', NOW())", { invoiceId: req.params.id, userId: req.user.id, recipient: invoice.customer_email });
        res.json({ message: "Reminder email queued" });
    }
    catch (error) {
        next(error);
    }
});
