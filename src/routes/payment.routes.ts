import { Router } from "express";
import { pool } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../middleware/error";
import { createRazorpayOrder, createStripeCheckout } from "../services/payment.service";

export const paymentRouter = Router();
paymentRouter.use(requireAuth);

async function findInvoice(id: string, userId: number) {
  const [rows] = await pool.execute("SELECT id, invoice_number, total, currency FROM invoices WHERE id = :id AND user_id = :userId", { id, userId });
  const invoice = (rows as Array<{ id: number; invoice_number: string; total: number; currency: string }>)[0];
  if (!invoice) throw new AppError(404, "Invoice not found");
  return invoice;
}

paymentRouter.post("/:id/stripe", async (req:any, res, next) => {
  try {
    res.json(await createStripeCheckout(await findInvoice(req.params.id, req.user!.id)));
  } catch (error) {
    next(error);
  }
});

paymentRouter.post("/:id/razorpay", async (req:any, res, next) => {
  try {
    res.json(await createRazorpayOrder(await findInvoice(req.params.id, req.user!.id)));
  } catch (error) {
    next(error);
  }
});

paymentRouter.get("/", async (req:any, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, i.invoice_number, i.customer_name
       FROM payments p
       INNER JOIN invoices i ON i.id = p.invoice_id
       WHERE i.user_id = :userId
       ORDER BY p.created_at DESC`,
      { userId: req.user!.id },
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

paymentRouter.post("/:id/manual", async (req:any, res, next) => {
  try {
    const invoice = await findInvoice(req.params.id, req.user!.id);
    const amount = Math.max(Number(req.body.amount ?? invoice.total), 0);
    if (amount <= 0) throw new AppError(422, "Payment amount must be greater than zero");
    await pool.execute(
      `INSERT INTO payments (invoice_id, provider, provider_ref, amount, currency, status, metadata)
       VALUES (:invoiceId, 'manual', :providerRef, :amount, :currency, 'paid', JSON_OBJECT('note', :note))`,
      {
        invoiceId: invoice.id,
        providerRef: req.body.reference ?? null,
        amount,
        currency: invoice.currency,
        note: req.body.note ?? "",
      },
    );
    const [paidRows] = await pool.execute("SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE invoice_id = :invoiceId AND status='paid'", {
      invoiceId: invoice.id,
    });
    const paid = Number((paidRows as Array<{ paid: number }>)[0]?.paid ?? 0);
    if (paid >= Number(invoice.total)) {
      await pool.execute("UPDATE invoices SET status='Paid', paid_at=NOW() WHERE id=:id AND user_id=:userId", {
        id: invoice.id,
        userId: req.user!.id,
      });
    }
    res.status(201).json({ message: "Payment recorded", paid, total: invoice.total });
  } catch (error) {
    next(error);
  }
});

paymentRouter.post("/:paymentId/refund", async (req:any, res, next) => {
  try {
    const [result] = await pool.execute(
      `UPDATE payments p
       INNER JOIN invoices i ON i.id = p.invoice_id
       SET p.status='refunded', p.metadata = JSON_OBJECT('refundReason', :reason)
       WHERE p.id = :paymentId AND i.user_id = :userId`,
      { paymentId: req.params.paymentId, userId: req.user!.id, reason: req.body.reason ?? "" },
    );
    if ((result as { affectedRows: number }).affectedRows === 0) throw new AppError(404, "Payment not found");
    res.json({ message: "Payment marked as refunded" });
  } catch (error) {
    next(error);
  }
});

paymentRouter.post("/:id/mark-paid", async (req:any, res, next) => {
  try {
    const invoice = await findInvoice(req.params.id, req.user!.id);
    await pool.execute(
      `INSERT INTO payments (invoice_id, provider, amount, currency, status, metadata)
       VALUES (:invoiceId, 'manual', :amount, :currency, 'paid', JSON_OBJECT('source', 'mark_paid'))
       ON DUPLICATE KEY UPDATE status = status`,
      { invoiceId: invoice.id, amount: invoice.total, currency: invoice.currency },
    );
    const [result] = await pool.execute("UPDATE invoices SET status='Paid', paid_at=NOW() WHERE id=:id AND user_id=:userId", {
      id: req.params.id,
      userId: req.user!.id,
    });
    if ((result as { affectedRows: number }).affectedRows === 0) throw new AppError(404, "Invoice not found");
    res.json({ message: "Invoice marked as paid" });
  } catch (error) {
    next(error);
  }
});
