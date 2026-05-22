"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const ai_service_1 = require("../services/ai.service");
const validators_1 = require("../utils/validators");
exports.aiRouter = (0, express_1.Router)();
exports.aiRouter.use(auth_1.requireAuth);
exports.aiRouter.post("/upload", upload_1.upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: "File is required" });
        const text = await (0, ai_service_1.extractTextFromFile)(req.file.path, req.file.mimetype);
        const invoice = (0, ai_service_1.inferInvoiceFromText)(text);
        res.json({ text, invoice, confidence: (0, ai_service_1.buildExtractionConfidence)(text, invoice) });
    }
    catch (error) {
        next(error);
    }
});
exports.aiRouter.post("/text-to-invoice", async (req, res, next) => {
    try {
        const { text } = validators_1.textToInvoiceSchema.parse(req.body);
        const invoice = (0, ai_service_1.inferInvoiceFromText)(text);
        res.json({ invoice, confidence: (0, ai_service_1.buildExtractionConfidence)(text, invoice) });
    }
    catch (error) {
        next(error);
    }
});
exports.aiRouter.post("/save-extraction", async (req, res, next) => {
    const connection = await db_1.pool.getConnection();
    try {
        const { invoice, createClient = true, createExpense = false, createPurchase = false } = req.body;
        await connection.beginTransaction();
        let clientId = null;
        if (createClient && invoice.customerName) {
            const [clientResult] = await connection.execute(`INSERT INTO clients (user_id, name, email, tax_id, billing_address, notes)
         VALUES (:userId, :name, :email, :taxId, :address, 'Created from AI import')`, {
                userId: req.user.id,
                name: invoice.customerName,
                email: invoice.customerEmail ?? null,
                taxId: invoice.customerTaxId ?? null,
                address: invoice.customerAddress ?? null,
            });
            clientId = clientResult.insertId;
        }
        const [invoiceResult] = await connection.execute(`INSERT INTO invoices (user_id, client_id, invoice_number, issue_date, due_date, status, currency, business_name,
        customer_name, customer_email, customer_tax_id, customer_address, notes, terms, subtotal, tax_total, discount_total, total)
       VALUES (:userId, :clientId, :invoiceNumber, :issueDate, :dueDate, 'Draft', :currency, :businessName,
        :customerName, :customerEmail, :customerTaxId, :customerAddress, :notes, :terms, :subtotal, :taxTotal, 0, :total)`, {
            userId: req.user.id,
            clientId,
            invoiceNumber: invoice.invoiceNumber ?? `AI-${Date.now()}`,
            issueDate: invoice.issueDate ?? new Date().toISOString().slice(0, 10),
            dueDate: invoice.dueDate ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
            currency: invoice.currency ?? "USD",
            businessName: invoice.businessName ?? "Imported invoice",
            customerName: invoice.customerName ?? "Imported client",
            customerEmail: invoice.customerEmail ?? null,
            customerTaxId: invoice.customerTaxId ?? null,
            customerAddress: invoice.customerAddress ?? null,
            notes: invoice.notes ?? "Created from AI import",
            terms: invoice.terms ?? null,
            subtotal: Number(invoice.subtotal ?? invoice.items?.[0]?.unitPrice ?? 0),
            taxTotal: Number(invoice.taxTotal ?? 0),
            total: Number(invoice.total ?? invoice.items?.[0]?.unitPrice ?? 0),
        });
        const invoiceId = invoiceResult.insertId;
        for (const item of invoice.items ?? []) {
            await connection.execute(`INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, tax_rate, discount_rate)
         VALUES (:invoiceId, :name, :description, :quantity, :unitPrice, :taxRate, :discountRate)`, { invoiceId, ...item });
        }
        let expenseId = null;
        if (createExpense) {
            const [expenseResult] = await connection.execute(`INSERT INTO expenses (user_id, vendor_name, vendor_tax_id, expense_number, category, expense_date, currency, subtotal, tax_total, total, source, metadata)
         VALUES (:userId, :vendorName, :vendorTaxId, :expenseNumber, 'AI Import', :expenseDate, :currency, :subtotal, :taxTotal, :total, 'ai_import', CAST(:metadata AS JSON))`, {
                userId: req.user.id,
                vendorName: invoice.businessName ?? "Imported vendor",
                vendorTaxId: invoice.businessTaxId ?? null,
                expenseNumber: invoice.invoiceNumber ?? null,
                expenseDate: invoice.issueDate ?? new Date().toISOString().slice(0, 10),
                currency: invoice.currency ?? "USD",
                subtotal: Number(invoice.subtotal ?? 0),
                taxTotal: Number(invoice.taxTotal ?? 0),
                total: Number(invoice.total ?? 0),
                metadata: JSON.stringify({ invoiceId }),
            });
            expenseId = expenseResult.insertId;
        }
        let purchaseId = null;
        if (createPurchase) {
            const [purchaseResult] = await connection.execute(`INSERT INTO purchases (user_id, vendor_name, vendor_tax_id, purchase_number, purchase_date, currency, subtotal, tax_total, total, metadata)
         VALUES (:userId, :vendorName, :vendorTaxId, :purchaseNumber, :purchaseDate, :currency, :subtotal, :taxTotal, :total, CAST(:metadata AS JSON))`, {
                userId: req.user.id,
                vendorName: invoice.businessName ?? "Imported vendor",
                vendorTaxId: invoice.businessTaxId ?? null,
                purchaseNumber: invoice.invoiceNumber ?? null,
                purchaseDate: invoice.issueDate ?? new Date().toISOString().slice(0, 10),
                currency: invoice.currency ?? "USD",
                subtotal: Number(invoice.subtotal ?? 0),
                taxTotal: Number(invoice.taxTotal ?? 0),
                total: Number(invoice.total ?? 0),
                metadata: JSON.stringify({ invoiceId }),
            });
            purchaseId = purchaseResult.insertId;
        }
        await connection.commit();
        res.status(201).json({ clientId, invoiceId, expenseId, purchaseId });
    }
    catch (error) {
        await connection.rollback();
        next(error);
    }
    finally {
        connection.release();
    }
});
