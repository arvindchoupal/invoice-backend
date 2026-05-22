import { Router } from "express";
import { pool } from "../config/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.get("/users", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, COUNT(i.id) invoice_count, COALESCE(SUM(i.total),0) total_billed
       FROM users u LEFT JOIN invoices i ON i.user_id = u.id GROUP BY u.id ORDER BY u.created_at DESC`,
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/analytics", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(DISTINCT u.id) users, COUNT(i.id) invoices, COALESCE(SUM(i.total),0) total_volume,
       COALESCE(SUM(i.status='Paid'),0) paid_count FROM users u LEFT JOIN invoices i ON i.user_id = u.id`,
    );
    res.json((rows as unknown[])[0]);
  } catch (error) {
    next(error);
  }
});
