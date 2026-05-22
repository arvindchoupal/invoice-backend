import { Router } from "express";
import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import { requireAuth } from "../middleware/auth";
import { clientSchema } from "../utils/validators";

export const clientRouter = Router();
clientRouter.use(requireAuth);

clientRouter.get("/", async (req:any, res, next) => {
  try {
    const search = `%${String(req.query.search ?? "")}%`;
    const [rows] = await pool.execute(
      `SELECT c.*,
        COUNT(i.id) AS invoice_count,
        COALESCE(SUM(i.total), 0) AS lifetime_value,
        COALESCE(SUM(CASE WHEN i.status <> 'Paid' THEN i.total ELSE 0 END), 0) AS outstanding_amount,
        COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.total ELSE 0 END), 0) AS paid_amount,
        MAX(i.issue_date) AS last_invoice_date
       FROM clients c
       LEFT JOIN invoices i ON i.client_id = c.id
       WHERE c.user_id = :userId AND (c.name LIKE :search OR c.email LIKE :search)
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      { userId: req.user!.id, search },
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

clientRouter.get("/:id", async (req:any, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*,
        COUNT(i.id) AS invoice_count,
        COALESCE(SUM(i.total), 0) AS lifetime_value,
        COALESCE(SUM(CASE WHEN i.status <> 'Paid' THEN i.total ELSE 0 END), 0) AS outstanding_amount,
        COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.total ELSE 0 END), 0) AS paid_amount,
        MAX(i.issue_date) AS last_invoice_date
       FROM clients c
       LEFT JOIN invoices i ON i.client_id = c.id
       WHERE c.user_id = :userId AND c.id = :id
       GROUP BY c.id`,
      { userId: req.user!.id, id: req.params.id },
    );
    const client = (rows as unknown[])[0];
    if (!client) throw new AppError(404, "Client not found");
    const [history] = await pool.execute(
      "SELECT id, invoice_number, status, issue_date, due_date, total, currency FROM invoices WHERE user_id = :userId AND client_id = :id ORDER BY issue_date DESC",
      { userId: req.user!.id, id: req.params.id },
    );
    const [payments] = await pool.execute(
      `SELECT p.*, i.invoice_number
       FROM payments p
       INNER JOIN invoices i ON i.id = p.invoice_id
       WHERE i.user_id = :userId AND i.client_id = :id
       ORDER BY p.created_at DESC`,
      { userId: req.user!.id, id: req.params.id },
    );
    res.json({ client, history, payments });
  } catch (error) {
    next(error);
  }
});

clientRouter.post("/", async (req:any, res, next) => {
  try {
    const body = clientSchema.parse(req.body);
    const [result] = await pool.execute(
      `INSERT INTO clients (user_id, name, email, phone, tax_id, billing_address, shipping_address, notes)
       VALUES (:userId, :name, :email, :phone, :taxId, :billingAddress, :shippingAddress, :notes)`,
      { userId: req.user!.id, ...body },
    );
    res.status(201).json({ id: (result as { insertId: number }).insertId, ...body });
  } catch (error) {
    next(error);
  }
});

clientRouter.get("/:id/history", async (req:any, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, invoice_number, status, issue_date, due_date, total, currency FROM invoices WHERE user_id = :userId AND client_id = :id ORDER BY issue_date DESC",
      { userId: req.user!.id, id: req.params.id },
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

clientRouter.put("/:id", async (req:any, res, next) => {
  try {
    const body = clientSchema.parse(req.body);
    const [result] = await pool.execute(
      `UPDATE clients SET name=:name, email=:email, phone=:phone, tax_id=:taxId, billing_address=:billingAddress,
       shipping_address=:shippingAddress, notes=:notes WHERE id=:id AND user_id=:userId`,
      { id: req.params.id, userId: req.user!.id, ...body },
    );
    if ((result as { affectedRows: number }).affectedRows === 0) throw new AppError(404, "Client not found");
    res.json({ id: Number(req.params.id), ...body });
  } catch (error) {
    next(error);
  }
});

clientRouter.delete("/:id", async (req:any, res, next) => {
  try {
    const [result] = await pool.execute("DELETE FROM clients WHERE id = :id AND user_id = :userId", {
      id: req.params.id,
      userId: req.user!.id,
    });
    if ((result as { affectedRows: number }).affectedRows === 0) throw new AppError(404, "Client not found");
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
