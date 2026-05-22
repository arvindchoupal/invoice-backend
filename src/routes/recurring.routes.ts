import { Router } from "express";
import { pool } from "../config/db";
import { requireAuth } from "../middleware/auth";

export const recurringRouter = Router();
recurringRouter.use(requireAuth);

recurringRouter.get("/", async (req:any, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, c.name client_name, i.invoice_number template_invoice_number
       FROM recurring_invoices r
       LEFT JOIN clients c ON c.id = r.client_id
       LEFT JOIN invoices i ON i.id = r.template_invoice_id
       WHERE r.user_id = :userId ORDER BY r.next_run_date ASC`,
      { userId: req.user!.id },
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

recurringRouter.post("/", async (req:any, res, next) => {
  try {
    const body = req.body;
    const [result] = await pool.execute(
      `INSERT INTO recurring_invoices (user_id, client_id, template_invoice_id, frequency, next_run_date, auto_send, status)
       VALUES (:userId, :clientId, :templateInvoiceId, :frequency, :nextRunDate, :autoSend, :status)`,
      {
        userId: req.user!.id,
        clientId: body.clientId ?? null,
        templateInvoiceId: body.templateInvoiceId ?? null,
        frequency: body.frequency,
        nextRunDate: body.nextRunDate,
        autoSend: Boolean(body.autoSend),
        status: body.status ?? "active",
      },
    );
    res.status(201).json({ id: (result as { insertId: number }).insertId });
  } catch (error) {
    next(error);
  }
});
