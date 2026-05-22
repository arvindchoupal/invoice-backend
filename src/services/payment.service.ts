import Razorpay from "razorpay";
import Stripe from "stripe";
import { env } from "../config/env";
import { AppError } from "../middleware/error";

export async function createStripeCheckout(invoice: { id: number; invoice_number: string; total: number; currency: string }) {
  if (!env.stripeSecretKey) throw new AppError(501, "Stripe is not configured");
  const stripe = new Stripe(env.stripeSecretKey);
  return stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${env.frontendUrl}/payments?status=success&invoice=${invoice.id}`,
    cancel_url: `${env.frontendUrl}/payments?status=cancelled&invoice=${invoice.id}`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: invoice.currency.toLowerCase(),
          unit_amount: Math.round(invoice.total * 100),
          product_data: { name: `Invoice ${invoice.invoice_number}` },
        },
      },
    ],
    metadata: { invoiceId: String(invoice.id) },
  });
}

export async function createRazorpayOrder(invoice: { id: number; invoice_number: string; total: number; currency: string }) {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) throw new AppError(501, "Razorpay is not configured");
  const razorpay = new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });
  return razorpay.orders.create({
    amount: Math.round(invoice.total * 100),
    currency: invoice.currency,
    receipt: invoice.invoice_number,
    notes: { invoiceId: String(invoice.id) },
  });
}
