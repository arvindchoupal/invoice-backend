import { Router } from "express";
import { pool } from "../config/db";
import { requireAuth } from "../middleware/auth";

export const reportRouter = Router();
reportRouter.use(requireAuth);

function buildInsights(summary: Record<string, number>, gst: Record<string, number>, clientGrowth: unknown[]) {
  const insights: Array<{ type: string; message: string; severity: "info" | "warning" | "success" }> = [];
  const overdue = Number(summary.overdue_invoices ?? 0);
  const pending = Number(summary.pending_invoices ?? 0);
  const gstTotal = Number(gst.gst_total ?? 0);

  if (overdue > 0) {
    insights.push({ type: "overdue", message: `${overdue} overdue invoice${overdue === 1 ? "" : "s"} need follow-up.`, severity: "warning" });
  }
  if (pending > 0) {
    insights.push({ type: "pending", message: `${pending} pending invoice${pending === 1 ? "" : "s"} can be nudged for faster collection.`, severity: "info" });
  }
  if (gstTotal > 0) {
    insights.push({ type: "gst", message: `GST/VAT collected across invoices totals ${gstTotal.toFixed(2)}.`, severity: "success" });
  }
  if (clientGrowth.length > 0) {
    insights.push({ type: "clients", message: `Client base has activity in ${clientGrowth.length} month${clientGrowth.length === 1 ? "" : "s"}.`, severity: "info" });
  }
  if (insights.length === 0) {
    insights.push({ type: "setup", message: "Create invoices and clients to unlock AI business insights.", severity: "info" });
  }

  return insights;
}

reportRouter.get("/dashboard", async (req:any, res, next) => {
  try {
    const userId = req.user!.id;
    const [summaryRows] = await pool.execute(
      `SELECT
        COUNT(*) total_invoices,
        COALESCE(SUM(status = 'Paid'), 0) paid_invoices,
        COALESCE(SUM(status IN ('Draft','Sent')), 0) pending_invoices,
        COALESCE(SUM(status = 'Overdue' OR (status <> 'Paid' AND due_date < CURDATE())), 0) overdue_invoices,
        COALESCE(SUM(CASE WHEN status='Paid' THEN total ELSE 0 END), 0) paid_revenue,
        COALESCE(SUM(CASE WHEN status <> 'Paid' THEN total ELSE 0 END), 0) outstanding_amount,
        COALESCE(SUM(total), 0) invoice_volume
       FROM invoices WHERE user_id = :userId`,
      { userId },
    );
    const summary = (summaryRows as Array<Record<string, number>>)[0] ?? {};

    const [monthlyRevenue] = await pool.execute(
      `SELECT DATE_FORMAT(issue_date, '%Y-%m') month,
        COALESCE(SUM(total), 0) revenue,
        COALESCE(SUM(CASE WHEN status='Paid' THEN total ELSE 0 END), 0) paid,
        COALESCE(SUM(CASE WHEN status <> 'Paid' THEN total ELSE 0 END), 0) outstanding,
        COUNT(*) invoice_count
       FROM invoices
       WHERE user_id = :userId
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      { userId },
    );

    const [paymentTrends] = await pool.execute(
      `SELECT DATE_FORMAT(COALESCE(p.created_at, i.paid_at), '%Y-%m') month,
        COALESCE(SUM(COALESCE(p.amount, i.total)), 0) amount,
        COUNT(*) payment_count
       FROM invoices i
       LEFT JOIN payments p ON p.invoice_id = i.id
       WHERE i.user_id = :userId AND (i.status='Paid' OR p.id IS NOT NULL)
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      { userId },
    );

    const [clientGrowth] = await pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') month, COUNT(*) clients
       FROM clients
       WHERE user_id = :userId
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      { userId },
    );

    const [topClients] = await pool.execute(
      `SELECT c.id, c.name, c.email,
        COUNT(i.id) invoice_count,
        COALESCE(SUM(i.total), 0) revenue,
        COALESCE(SUM(CASE WHEN i.status <> 'Paid' THEN i.total ELSE 0 END), 0) outstanding_amount,
        MAX(i.issue_date) last_invoice_date
       FROM clients c
       LEFT JOIN invoices i ON i.client_id = c.id
       WHERE c.user_id = :userId
       GROUP BY c.id
       ORDER BY revenue DESC
       LIMIT 5`,
      { userId },
    );

    const [gstRows] = await pool.execute(
      `SELECT
        COALESCE(SUM(tax_total), 0) gst_total,
        COALESCE(SUM(subtotal), 0) taxable_value,
        COALESCE(AVG(NULLIF(tax_total, 0)), 0) average_tax
       FROM invoices WHERE user_id = :userId`,
      { userId },
    );
    const gstSummary = (gstRows as Array<Record<string, number>>)[0] ?? {};

    const [recentActivity] = await pool.execute(
      `SELECT 'invoice' type, invoice_number title,
        CONCAT(status, ' invoice for ', customer_name, ' worth ', currency, ' ', total) body,
        status, created_at
       FROM invoices
       WHERE user_id = :userId
       UNION ALL
       SELECT 'notification' type, type title,
        CONCAT(status, ' reminder/email to ', recipient) body,
        status, created_at
       FROM notifications
       WHERE user_id = :userId
       ORDER BY created_at DESC
       LIMIT 10`,
      { userId },
    );

    res.json({
      summary,
      monthlyRevenue: (monthlyRevenue as unknown[]).reverse(),
      paymentTrends: (paymentTrends as unknown[]).reverse(),
      clientGrowth: (clientGrowth as unknown[]).reverse(),
      topClients,
      gstSummary,
      recentActivity,
      insights: buildInsights(summary, gstSummary, clientGrowth as unknown[]),
    });
  } catch (error) {
    next(error);
  }
});

reportRouter.get("/exports", async (req:any, res, next) => {
  try {
    const userId = req.user!.id;
    const [revenue] = await pool.execute(
      `SELECT DATE_FORMAT(issue_date, '%Y-%m') month, COUNT(*) invoices, COALESCE(SUM(total),0) total
       FROM invoices WHERE user_id = :userId GROUP BY month ORDER BY month DESC`,
      { userId },
    );
    const [gst] = await pool.execute(
      `SELECT invoice_number, issue_date, customer_name, customer_tax_id, subtotal taxable_value, tax_total, total, currency
       FROM invoices WHERE user_id = :userId ORDER BY issue_date DESC`,
      { userId },
    );
    const [clients] = await pool.execute(
      `SELECT c.name, c.email, COUNT(i.id) invoices, COALESCE(SUM(i.total),0) revenue
       FROM clients c LEFT JOIN invoices i ON i.client_id = c.id
       WHERE c.user_id = :userId GROUP BY c.id ORDER BY revenue DESC`,
      { userId },
    );
    const [expenses] = await pool.execute(
      `SELECT DATE_FORMAT(expense_date, '%Y-%m') month, COUNT(*) expenses, COALESCE(SUM(total),0) total
       FROM expenses WHERE user_id = :userId GROUP BY month ORDER BY month DESC`,
      { userId },
    );
    const [profit] = await pool.execute(
      `SELECT r.month, r.revenue, COALESCE(e.expenses,0) expenses, r.revenue - COALESCE(e.expenses,0) profit
       FROM (
        SELECT DATE_FORMAT(issue_date, '%Y-%m') month, COALESCE(SUM(CASE WHEN status='Paid' THEN total ELSE 0 END),0) revenue
        FROM invoices WHERE user_id = :userId GROUP BY month
       ) r
       LEFT JOIN (
        SELECT DATE_FORMAT(expense_date, '%Y-%m') month, COALESCE(SUM(total),0) expenses
        FROM expenses WHERE user_id = :userId GROUP BY month
       ) e ON e.month = r.month
       ORDER BY r.month DESC`,
      { userId },
    );
    res.json({ revenue, gst, clients, expenses, profit });
  } catch (error) {
    next(error);
  }
});
