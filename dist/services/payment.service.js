"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStripeCheckout = createStripeCheckout;
exports.createRazorpayOrder = createRazorpayOrder;
const razorpay_1 = __importDefault(require("razorpay"));
const stripe_1 = __importDefault(require("stripe"));
const env_1 = require("../config/env");
const error_1 = require("../middleware/error");
async function createStripeCheckout(invoice) {
    if (!env_1.env.stripeSecretKey)
        throw new error_1.AppError(501, "Stripe is not configured");
    const stripe = new stripe_1.default(env_1.env.stripeSecretKey);
    return stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${env_1.env.frontendUrl}/payments?status=success&invoice=${invoice.id}`,
        cancel_url: `${env_1.env.frontendUrl}/payments?status=cancelled&invoice=${invoice.id}`,
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
async function createRazorpayOrder(invoice) {
    if (!env_1.env.razorpayKeyId || !env_1.env.razorpayKeySecret)
        throw new error_1.AppError(501, "Razorpay is not configured");
    const razorpay = new razorpay_1.default({ key_id: env_1.env.razorpayKeyId, key_secret: env_1.env.razorpayKeySecret });
    return razorpay.orders.create({
        amount: Math.round(invoice.total * 100),
        currency: invoice.currency,
        receipt: invoice.invoice_number,
        notes: { invoiceId: String(invoice.id) },
    });
}
