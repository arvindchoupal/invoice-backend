import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "../utils/logger";

function hasSmtpConfig() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!hasSmtpConfig()) {
    logger.info("SMTP not configured; email skipped", { to, subject });
    return { skipped: true };
  }

  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });

  return transporter.sendMail({ from: env.smtp.from, to, subject, html });
}

export function sendPasswordResetEmail(to: string, token: string) {
  const url = `${env.frontendUrl}/forgot-password?token=${token}`;
  return sendEmail(to, "Reset your Invoice Maker password", `<p>Use this secure link to reset your password:</p><p><a href="${url}">${url}</a></p>`);
}

export function sendInvoiceEmail(to: string, invoiceNumber: string, paymentUrl?: string) {
  const button = paymentUrl ? `<p><a href="${paymentUrl}">Pay invoice</a></p>` : "";
  return sendEmail(to, `Invoice ${invoiceNumber}`, `<p>Your invoice ${invoiceNumber} is ready.</p>${button}`);
}

export function sendReminderEmail(to: string, invoiceNumber: string) {
  return sendEmail(to, `Reminder: invoice ${invoiceNumber}`, `<p>This is a friendly reminder that invoice ${invoiceNumber} is pending.</p>`);
}
