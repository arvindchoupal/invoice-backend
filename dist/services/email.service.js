"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendInvoiceEmail = sendInvoiceEmail;
exports.sendReminderEmail = sendReminderEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
function hasSmtpConfig() {
    return Boolean(env_1.env.smtp.host && env_1.env.smtp.user && env_1.env.smtp.pass);
}
async function sendEmail(to, subject, html) {
    if (!hasSmtpConfig()) {
        logger_1.logger.info("SMTP not configured; email skipped", { to, subject });
        return { skipped: true };
    }
    const transporter = nodemailer_1.default.createTransport({
        host: env_1.env.smtp.host,
        port: env_1.env.smtp.port,
        secure: env_1.env.smtp.port === 465,
        auth: { user: env_1.env.smtp.user, pass: env_1.env.smtp.pass },
    });
    return transporter.sendMail({ from: env_1.env.smtp.from, to, subject, html });
}
function sendPasswordResetEmail(to, token) {
    const url = `${env_1.env.frontendUrl}/forgot-password?token=${token}`;
    return sendEmail(to, "Reset your InvoiceWala password", `<p>Use this secure link to reset your password:</p><p><a href="${url}">${url}</a></p>`);
}
function sendInvoiceEmail(to, invoiceNumber, paymentUrl) {
    const button = paymentUrl ? `<p><a href="${paymentUrl}">Pay invoice</a></p>` : "";
    return sendEmail(to, `Invoice ${invoiceNumber}`, `<p>Your invoice ${invoiceNumber} is ready.</p>${button}`);
}
function sendReminderEmail(to, invoiceNumber) {
    return sendEmail(to, `Reminder: invoice ${invoiceNumber}`, `<p>This is a friendly reminder that invoice ${invoiceNumber} is pending.</p>`);
}
