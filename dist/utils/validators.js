"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textToInvoiceSchema = exports.settingsSchema = exports.invoiceSchema = exports.invoiceItemSchema = exports.clientSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.signupSchema = void 0;
const zod_1 = require("zod");
const pdf_service_1 = require("../services/pdf.service");
const pdfStyleEnum = zod_1.z.enum(pdf_service_1.PDF_STYLES);
exports.signupSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.email(),
    password: zod_1.z.string().min(8),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.email(),
    password: zod_1.z.string().min(1),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.email(),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(32),
    password: zod_1.z.string().min(8),
});
exports.clientSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.email().optional().or(zod_1.z.literal("")),
    phone: zod_1.z.string().optional(),
    taxId: zod_1.z.string().optional(),
    billingAddress: zod_1.z.string().optional(),
    shippingAddress: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.invoiceItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    quantity: zod_1.z.coerce.number().positive(),
    unitPrice: zod_1.z.coerce.number().nonnegative(),
    taxRate: zod_1.z.coerce.number().min(0).max(100).default(0),
    discountRate: zod_1.z.coerce.number().min(0).max(100).default(0),
});
exports.invoiceSchema = zod_1.z.object({
    clientId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    invoiceNumber: zod_1.z.string().optional(),
    issueDate: zod_1.z.string(),
    dueDate: zod_1.z.string(),
    status: zod_1.z.enum(["Draft", "Sent", "Paid", "Overdue"]).default("Draft"),
    currency: zod_1.z.string().min(3).max(3).default("USD"),
    businessName: zod_1.z.string().min(2),
    businessEmail: zod_1.z.email().optional().or(zod_1.z.literal("")),
    businessTaxId: zod_1.z.string().optional(),
    businessAddress: zod_1.z.string().optional(),
    customerName: zod_1.z.string().min(2),
    customerEmail: zod_1.z.email().optional().or(zod_1.z.literal("")),
    customerTaxId: zod_1.z.string().optional(),
    customerAddress: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    terms: zod_1.z.string().optional(),
    pdfStyle: pdfStyleEnum.optional(),
    items: zod_1.z.array(exports.invoiceItemSchema).min(1),
});
exports.settingsSchema = zod_1.z.object({
    companyName: zod_1.z.string().optional(),
    companyEmail: zod_1.z.email().optional().or(zod_1.z.literal("")),
    companyAddress: zod_1.z.string().optional(),
    companyTaxId: zod_1.z.string().optional(),
    currency: zod_1.z.string().min(3).max(3).default("USD"),
    taxName: zod_1.z.string().default("VAT"),
    taxRate: zod_1.z.coerce.number().min(0).max(100).default(0),
    theme: zod_1.z.enum(["light", "dark", "system"]).default("system"),
    invoicePrefix: zod_1.z.string().min(1).max(12).default("INV"),
    defaultPdfStyle: pdfStyleEnum.optional(),
});
exports.textToInvoiceSchema = zod_1.z.object({
    text: zod_1.z.string().min(10),
});
