import { Router } from "express";
import { pool, withTransaction, type DbExecutor } from "../config/db";
import { AppError } from "../middleware/error";
import { requireAuth } from "../middleware/auth";
import { sendInvoiceEmail, sendReminderEmail } from "../services/email.service";
import { PDF_STYLE_META, PDF_STYLES, normalizePdfStyle, renderInvoicePdf } from "../services/pdf.service";
import { calculateInvoice, makeInvoiceNumber } from "../utils/invoice";
import { z } from "zod";
import { invoiceSchema } from "../utils/validators";
type InvoiceBody = z.infer<typeof invoiceSchema>;

function invoiceSqlParams(body: InvoiceBody, totals: ReturnType<typeof calculateInvoice>, pdfStyle: string) {
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

function invoiceItemSqlParams(invoiceId: number | string, item: InvoiceBody["items"][number]) {
  return {
    invoiceId,
    name: item.name,
    description: item.description || null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate ?? 0,
    discountRate: item.discountRate ?? 0,
  };
}

export const invoiceRouter = Router();
invoiceRouter.use(requireAuth);

async function defaultPdfStyleForUser(userId: number, db: DbExecutor = pool) {
  const [rows] = await db.execute("SELECT default_pdf_style FROM settings WHERE user_id = :userId", { userId });
  return normalizePdfStyle((rows as Array<{ default_pdf_style?: string }>)[0]?.default_pdf_style);
}

async function nextInvoiceNumber(userId: number, prefix = "INV", db: DbExecutor = pool) {
  const [rows] = await db.execute("SELECT invoice_counter FROM settings WHERE user_id = :userId", { userId });
  const counter = ((rows as Array<{ invoice_counter: number }>)[0]?.invoice_counter ?? 0) + 1;
  await db.execute(
    `INSERT INTO settings (user_id, invoice_counter, invoice_prefix)
     VALUES (:userId, :counter, :prefix)
     ON DUPLICATE KEY UPDATE invoice_counter = :counter`,
    { userId, counter, prefix },
  );
  return makeInvoiceNumber(prefix, counter);
}
//tewt
invoiceRouter.get("/", async (req:any, res, next) => {
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
      userId: req.user!.id,
      search,
      status,
      limit: pageSize,
      offset,
    };
    const where = `user_id = :userId
      AND (:status = 'all' OR status = :status)
      AND (invoice_number LIKE :search OR customer_name LIKE :search OR customer_email LIKE :search OR customer_tax_id LIKE :search)`;
      const [rows] = await pool.execute(
        `
        SELECT *
        FROM invoices
        WHERE ${where}
        ORDER BY ${sortBy} ${sortDir}
        LIMIT ${pageSize}
        OFFSET ${offset}
        `,
        {
          userId: req.user!.id,
          search,
          status
        }
       );
    const [countRows] = await pool.execute(`SELECT COUNT(*) total FROM invoices WHERE ${where}`, params);
    const [facets] = await pool.execute(
      `SELECT status, COUNT(*) count FROM invoices WHERE user_id = :userId GROUP BY status`,
      { userId: req.user!.id },
    );
    res.json({
      data: rows,
      pagination: {
        page,
        pageSize,
        total: Number((countRows as Array<{ total: number }>)[0]?.total ?? 0),
      },
      facets,
    });
  } catch (error) {
    next(error);
  }
});

invoiceRouter.get("/stats/summary", async (req:any, res, next) => {
  try {
    const [summary] = await pool.execute(
      `SELECT COUNT(*) total_invoices,
        SUM(status = 'Paid') paid_invoices,
        SUM(status IN ('Draft','Sent','Pending')) pending_invoices,
        COALESCE(SUM(CASE WHEN status='Paid' THEN total ELSE 0 END),0) revenue
       FROM invoices WHERE user_id = :userId`,
      { userId: req.user!.id },
    );
    const [monthly] = await pool.execute(
      `SELECT DATE_FORMAT(issue_date, '%Y-%m') month, COALESCE(SUM(total),0) revenue
       FROM invoices WHERE user_id = :userId GROUP BY month ORDER BY month DESC LIMIT 12`,
      { userId: req.user!.id },
    );
    res.json({ summary: (summary as unknown[])[0], monthly: (monthly as unknown[]).reverse() });
  } catch (error) {
    next(error);
  }
});

invoiceRouter.post("/", async (req:any, res, next) => {
  try {
    const body = invoiceSchema.parse(req.body);
    const totals = calculateInvoice(body.items);
    const { invoiceId, invoiceNumber, pdfStyle } = await withTransaction(async (connection) => {
      const invoiceNumber = body.invoiceNumber || (await nextInvoiceNumber(req.user!.id, "INV", connection));
      const pdfStyle = normalizePdfStyle(body.pdfStyle ?? (await defaultPdfStyleForUser(req.user!.id, connection)));

      const [result] = await connection.execute(
        `INSERT INTO invoices (user_id, client_id, invoice_number, issue_date, due_date, status, currency, business_name,
          business_email, business_tax_id, business_address, customer_name, customer_email, customer_tax_id, customer_address,
          notes, terms, pdf_style, subtotal, tax_total, discount_total, total)
         VALUES (:userId, :clientId, :invoiceNumber, :issueDate, :dueDate, :status, :currency, :businessName, :businessEmail,
          :businessTaxId, :businessAddress, :customerName, :customerEmail, :customerTaxId, :customerAddress, :notes, :terms,
          :pdfStyle, :subtotal, :taxTotal, :discountTotal, :total)`,
        { userId: req.user!.id, ...invoiceSqlParams(body, totals, pdfStyle), invoiceNumber },
      );

      const invoiceId = (result as { insertId: number }).insertId;
      for (const item of body.items) {
        await connection.execute(
          `INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, tax_rate, discount_rate)
           VALUES (:invoiceId, :name, :description, :quantity, :unitPrice, :taxRate, :discountRate)`,
          invoiceItemSqlParams(invoiceId, item),
        );
      }
      return { invoiceId, invoiceNumber, pdfStyle };
    });
    res.status(201).json({ id: invoiceId, invoiceNumber, pdfStyle, ...body, ...totals });
  } catch (error) {
    next(error);
  }
});

invoiceRouter.get("/:id", async (req:any, res, next) => {
  try {
    const [invoices] = await pool.execute("SELECT * FROM invoices WHERE id = :id AND user_id = :userId", {
      id: req.params.id,
      userId: req.user!.id,
    });
    const invoice = (invoices as unknown[])[0];
    if (!invoice) throw new AppError(404, "Invoice not found");
    const [items] = await pool.execute("SELECT * FROM invoice_items WHERE invoice_id = :id", { id: req.params.id });
    res.json({ ...invoice, items });
  } catch (error) {
    next(error);
  }
});

invoiceRouter.put("/:id", async (req:any, res, next) => {
  try {
    const body = invoiceSchema.parse(req.body);
    const totals = calculateInvoice(body.items);
    const { pdfStyle, invoiceNumber } = await withTransaction(async (connection) => {
      const [existingRows] = await connection.execute(
        "SELECT invoice_number FROM invoices WHERE id = :id AND user_id = :userId",
        { id: req.params.id, userId: req.user!.id },
      );
      const existing = (existingRows as Array<{ invoice_number: string }>)[0];
      if (!existing) throw new AppError(404, "Invoice not found");
      const pdfStyle = normalizePdfStyle(body.pdfStyle ?? (await defaultPdfStyleForUser(req.user!.id, connection)));
      const invoiceNumber = body.invoiceNumber || existing.invoice_number;
      const [result] = await connection.execute(
        `UPDATE invoices SET client_id=:clientId, invoice_number=:invoiceNumber, issue_date=:issueDate, due_date=:dueDate,
         status=:status, currency=:currency, business_name=:businessName, business_email=:businessEmail, business_tax_id=:businessTaxId,
         business_address=:businessAddress, customer_name=:customerName, customer_email=:customerEmail, customer_tax_id=:customerTaxId,
         customer_address=:customerAddress, notes=:notes, terms=:terms, pdf_style=:pdfStyle, subtotal=:subtotal, tax_total=:taxTotal,
         discount_total=:discountTotal, total=:total WHERE id=:id AND user_id=:userId`,
        { id: req.params.id, userId: req.user!.id, ...invoiceSqlParams(body, totals, pdfStyle), invoiceNumber },
      );
      if ((result as { affectedRows: number }).affectedRows === 0) throw new AppError(404, "Invoice not found");
      await connection.execute("DELETE FROM invoice_items WHERE invoice_id = :id", { id: req.params.id });
      for (const item of body.items) {
        await connection.execute(
          `INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, tax_rate, discount_rate)
           VALUES (:invoiceId, :name, :description, :quantity, :unitPrice, :taxRate, :discountRate)`,
          invoiceItemSqlParams(req.params.id, item),
        );
      }
      return { pdfStyle, invoiceNumber };
    });
    res.json({ id: Number(req.params.id), invoiceNumber, pdfStyle, ...body, ...totals });
  } catch (error) {
    next(error);
  }
});

invoiceRouter.post("/:id/duplicate", async (req:any, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM invoices WHERE id = :id AND user_id = :userId", { id: req.params.id, userId: req.user!.id });
    const original = (rows as Array<Record<string, unknown>>)[0];
    if (!original) throw new AppError(404, "Invoice not found");
    const [items] = await pool.execute(
      "SELECT name, description, quantity, unit_price unitPrice, tax_rate taxRate, discount_rate discountRate FROM invoice_items WHERE invoice_id = :id",
      { id: req.params.id },
    );

    const { newId, invoiceNumber } = await withTransaction(async (connection) => {
      const invoiceNumber = await nextInvoiceNumber(req.user!.id, "INV", connection);
      const [result] = await connection.execute(
        `INSERT INTO invoices (user_id, client_id, invoice_number, issue_date, due_date, status, currency, business_name,
          business_email, business_tax_id, business_address, customer_name, customer_email, customer_tax_id, customer_address,
          notes, terms, pdf_style, subtotal, tax_total, discount_total, total)
         SELECT user_id, client_id, :invoiceNumber, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'Draft', currency, business_name,
          business_email, business_tax_id, business_address, customer_name, customer_email, customer_tax_id, customer_address,
          notes, terms, pdf_style, subtotal, tax_total, discount_total, total
         FROM invoices WHERE id = :id AND user_id = :userId`,
        { invoiceNumber, id: req.params.id, userId: req.user!.id },
      );
      const newId = (result as { insertId: number }).insertId;
      for (const item of items as Array<Record<string, unknown>>) {
        await connection.execute(
          `INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, tax_rate, discount_rate)
           VALUES (:invoiceId, :name, :description, :quantity, :unitPrice, :taxRate, :discountRate)`,
          { invoiceId: newId, ...item },
        );
      }
      return { newId, invoiceNumber };
    });
    res.status(201).json({ id: newId, invoiceNumber, status: "Draft" });
  } catch (error) {
    next(error);
  }
});

invoiceRouter.delete("/:id", async (req:any, res, next) => {
  try {
    const [result] = await pool.execute("DELETE FROM invoices WHERE id = :id AND user_id = :userId", { id: req.params.id, userId: req.user!.id });
    if ((result as { affectedRows: number }).affectedRows === 0) throw new AppError(404, "Invoice not found");
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

invoiceRouter.get("/:id/pdf", async (req:any, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM invoices WHERE id = :id AND user_id = :userId", { id: req.params.id, userId: req.user!.id });
    const invoice = (rows as Array<Record<string, unknown>>)[0];
    if (!invoice) throw new AppError(404, "Invoice not found");
    const [items] = await pool.execute("SELECT * FROM invoice_items WHERE invoice_id = :id", { id: req.params.id });
    const [settingsRows] = await pool.execute("SELECT logo_url, company_name, company_email, company_address, company_tax_id FROM settings WHERE user_id = :userId", { userId: req.user!.id });
    const settings = (settingsRows as Array<Record<string, unknown>>)[0] ?? {};
    const style = normalizePdfStyle(req.query.style ?? invoice.pdf_style ?? (await defaultPdfStyleForUser(req.user!.id)));
    const buffer = await renderInvoicePdf(invoice, items as Array<Record<string, unknown>>, style, settings);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoice_number}-${style}.pdf"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

invoiceRouter.get("/:id/pdf2", async (req:any, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM invoices WHERE id = :id AND user_id = :userId",
      {
        id: req.params.id,
        userId: req.user!.id
      }
    );

    const invoice =
      (rows as Array<Record<string, unknown>>)[0];

    if (!invoice)
      throw new AppError(404, "Invoice not found");

    const [items] = await pool.execute(
      "SELECT * FROM invoice_items WHERE invoice_id = :id",
      { id: req.params.id }
    );

    const style = normalizePdfStyle(req.query.style ?? invoice.pdf_style ?? (await defaultPdfStyleForUser(req.user!.id)));

    const [settingsRows] = await pool.execute(
      "SELECT logo_url, company_name, company_email, company_address, company_tax_id FROM settings WHERE user_id = :userId",
      { userId: req.user!.id }
    );
    const settings =
      (settingsRows as Array<Record<string, unknown>>)[0] ?? {};

    const buffer = await renderInvoicePdf(
      invoice,
      items as Array<Record<string, unknown>>,
      style,
      settings
    );

    res.setHeader("Content-Type", "application/pdf");

    // changed here ↓↓↓
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${invoice.invoice_number}-${style}.pdf"`
    );

    res.send(buffer);

  } catch (error) {
    next(error);
  }
});
invoiceRouter.get("/pdf/styles/list", (_req:any, res) => {
  res.json(PDF_STYLES.map((style) => PDF_STYLE_META[style]));
});

invoiceRouter.post("/:id/email", async (req:any, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT id, invoice_number, customer_email FROM invoices WHERE id = :id AND user_id = :userId", { id: req.params.id, userId: req.user!.id });
    const invoice = (rows as Array<{ invoice_number: string; customer_email: string }>)[0];
    if (!invoice?.customer_email) throw new AppError(404, "Invoice or customer email not found");
    await sendInvoiceEmail(invoice.customer_email, invoice.invoice_number);
    await pool.execute(
      "INSERT INTO notifications (invoice_id, user_id, type, recipient, status, sent_at) VALUES (:invoiceId, :userId, 'invoice_email', :recipient, 'sent', NOW())",
      { invoiceId: req.params.id, userId: req.user!.id, recipient: invoice.customer_email },
    );
    res.json({ message: "Invoice email queued" });
  } catch (error) {
    next(error);
  }
});

invoiceRouter.post("/:id/reminder", async (req:any, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT id, invoice_number, customer_email FROM invoices WHERE id = :id AND user_id = :userId", { id: req.params.id, userId: req.user!.id });
    const invoice = (rows as Array<{ invoice_number: string; customer_email: string }>)[0];
    if (!invoice?.customer_email) throw new AppError(404, "Invoice or customer email not found");
    await sendReminderEmail(invoice.customer_email, invoice.invoice_number);
    await pool.execute(
      "INSERT INTO notifications (invoice_id, user_id, type, recipient, status, sent_at) VALUES (:invoiceId, :userId, 'reminder', :recipient, 'sent', NOW())",
      { invoiceId: req.params.id, userId: req.user!.id, recipient: invoice.customer_email },
    );
    res.json({ message: "Reminder email queued" });
  } catch (error) {
    next(error);
  }
});
