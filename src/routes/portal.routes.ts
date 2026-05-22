import { Router } from "express";
import { pool } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { randomToken } from "../utils/auth";

export const portalRouter = Router();

portalRouter.post("/tokens/:invoiceId", requireAuth, async (req:any, res, next) => {
  try {
    const token = randomToken();
    await pool.execute(
      "INSERT INTO client_portal_tokens (invoice_id, token, expires_at) VALUES (:invoiceId, :token, DATE_ADD(NOW(), INTERVAL 30 DAY))",
      { invoiceId: req.params.invoiceId, token },
    );
    res.status(201).json({ token, url: `/portal/${token}` });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/:token", async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT i.id, i.invoice_number, i.customer_name, i.customer_email, i.status, i.issue_date, i.due_date, i.total, i.currency
       FROM client_portal_tokens t
       INNER JOIN invoices i ON i.id = t.invoice_id
       WHERE t.token = :token AND (t.expires_at IS NULL OR t.expires_at > NOW())`,
      { token: req.params.token },
    );
    const invoice = (rows as unknown[])[0];
    res.json({ invoice });
  } catch (error) {
    next(error);
  }
});
