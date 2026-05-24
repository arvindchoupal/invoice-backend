import { Router } from "express";
import { withTransaction } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { buildExtractionConfidence, extractTextFromFile, inferInvoiceFromText } from "../services/ai.service";
import { textToInvoiceSchema } from "../utils/validators";

export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File is required" });
    const text = await extractTextFromFile(req.file.path, req.file.mimetype);
    const invoice = inferInvoiceFromText(text);
    res.json({ text, invoice, confidence: buildExtractionConfidence(text, invoice) });
  } catch (error) {
    next(error);
  }
});

aiRouter.post("/text-to-invoice", async (req, res, next) => {
  try {
    const { text } = textToInvoiceSchema.parse(req.body);
    const invoice = inferInvoiceFromText(text);
    res.json({ invoice, confidence: buildExtractionConfidence(text, invoice) });
  } catch (error) {
    next(error);
  }
});

aiRouter.post("/save-extraction", async (req:any, res, next) => {
  try {
    const { invoice, createClient = true, createExpense = false, createPurchase = false } = req.body;
    const payload = await withTransaction(async (connection) => {
    let clientId: number | null = null;

    if (createClient && invoice.customerName) {
      const [clientResult] = await connection.execute(
        `INSERT INTO clients (user_id, name, email, tax_id, billing_address, notes)
         VALUES (:userId, :name, :email, :taxId, :address, 'Created from AI import')`,
        {
          userId: req.user!.id,
          name: invoice.customerName,
          email: invoice.customerEmail ?? null,
          taxId: invoice.customerTaxId ?? null,
          address: invoice.customerAddress ?? null,
        },
      );
      clientId = (clientResult as { insertId: number }).insertId;
    }

    const [invoiceResult] = await connection.execute(
      `INSERT INTO invoices (user_id, client_id, invoice_number, issue_date, due_date, status, currency, business_name,
        customer_name, customer_email, customer_tax_id, customer_address, notes, terms, subtotal, tax_total, discount_total, total)
       VALUES (:userId, :clientId, :invoiceNumber, :issueDate, :dueDate, 'Draft', :currency, :businessName,
        :customerName, :customerEmail, :customerTaxId, :customerAddress, :notes, :terms, :subtotal, :taxTotal, 0, :total)`,
      {
        userId: req.user!.id,
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
      },
    );
    const invoiceId = (invoiceResult as { insertId: number }).insertId;

    for (const item of invoice.items ?? []) {
      await connection.execute(
        `INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, tax_rate, discount_rate)
         VALUES (:invoiceId, :name, :description, :quantity, :unitPrice, :taxRate, :discountRate)`,
        { invoiceId, ...item },
      );
    }

    let expenseId: number | null = null;
    if (createExpense) {
      const [expenseResult] = await connection.execute(
        `INSERT INTO expenses (user_id, vendor_name, vendor_tax_id, expense_number, category, expense_date, currency, subtotal, tax_total, total, source, metadata)
         VALUES (:userId, :vendorName, :vendorTaxId, :expenseNumber, 'AI Import', :expenseDate, :currency, :subtotal, :taxTotal, :total, 'ai_import', CAST(:metadata AS JSON))`,
        {
          userId: req.user!.id,
          vendorName: invoice.businessName ?? "Imported vendor",
          vendorTaxId: invoice.businessTaxId ?? null,
          expenseNumber: invoice.invoiceNumber ?? null,
          expenseDate: invoice.issueDate ?? new Date().toISOString().slice(0, 10),
          currency: invoice.currency ?? "USD",
          subtotal: Number(invoice.subtotal ?? 0),
          taxTotal: Number(invoice.taxTotal ?? 0),
          total: Number(invoice.total ?? 0),
          metadata: JSON.stringify({ invoiceId }),
        },
      );
      expenseId = (expenseResult as { insertId: number }).insertId;
    }

    let purchaseId: number | null = null;
    if (createPurchase) {
      const [purchaseResult] = await connection.execute(
        `INSERT INTO purchases (user_id, vendor_name, vendor_tax_id, purchase_number, purchase_date, currency, subtotal, tax_total, total, metadata)
         VALUES (:userId, :vendorName, :vendorTaxId, :purchaseNumber, :purchaseDate, :currency, :subtotal, :taxTotal, :total, CAST(:metadata AS JSON))`,
        {
          userId: req.user!.id,
          vendorName: invoice.businessName ?? "Imported vendor",
          vendorTaxId: invoice.businessTaxId ?? null,
          purchaseNumber: invoice.invoiceNumber ?? null,
          purchaseDate: invoice.issueDate ?? new Date().toISOString().slice(0, 10),
          currency: invoice.currency ?? "USD",
          subtotal: Number(invoice.subtotal ?? 0),
          taxTotal: Number(invoice.taxTotal ?? 0),
          total: Number(invoice.total ?? 0),
          metadata: JSON.stringify({ invoiceId }),
        },
      );
      purchaseId = (purchaseResult as { insertId: number }).insertId;
    }

    return { clientId, invoiceId, expenseId, purchaseId };
    });
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});
