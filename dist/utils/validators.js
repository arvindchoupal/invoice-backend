"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textToInvoiceSchema = exports.settingsSchema = exports.invoiceSchema = exports.invoiceItemSchema = exports.clientSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.signupSchema = void 0;
const zod_1 = require("zod");
const pdf_service_1 = require("../services/pdf.service");
const pdfStyleEnum = zod_1.z.enum(pdf_service_1.PDF_STYLES);
const emptyToUndefined = (value) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const trimmedOptional = zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().optional());
const optionalEmail = zod_1.z.preprocess(emptyToUndefined, zod_1.z.email().optional());
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
    name: zod_1.z.string().trim().min(1, "Line item name is required"),
    description: trimmedOptional,
    quantity: zod_1.z.coerce.number().positive(),
    unitPrice: zod_1.z.coerce.number().nonnegative(),
    taxRate: zod_1.z.coerce.number().min(0).max(100).default(0),
    discountRate: zod_1.z.coerce.number().min(0).max(100).default(0),
});
exports.invoiceSchema = zod_1.z.preprocess((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return value;
    const body = value;
    const items = Array.isArray(body.items)
        ? body.items.filter((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item))
                return false;
            const row = item;
            return [row.name, row.description, row.quantity, row.unitPrice, row.taxRate, row.discountRate].some((field) => {
                if (field === null || field === undefined)
                    return false;
                if (typeof field === "string")
                    return field.trim() !== "" && field.trim() !== "0";
                if (typeof field === "number")
                    return field !== 0;
                return true;
            });
        })
        : body.items;
    return { ...body, items };
}, zod_1.z.object({
    clientId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    invoiceNumber: trimmedOptional,
    issueDate: zod_1.z.string().min(1, "Issue date is required"),
    dueDate: zod_1.z.string().min(1, "Due date is required"),
    status: zod_1.z.enum(["Draft", "Sent", "Paid", "Overdue"]).default("Draft"),
    currency: zod_1.z.string().min(3).max(3).default("USD"),
    businessName: zod_1.z.string().trim().min(1, "Business name is required"),
    businessEmail: optionalEmail,
    businessTaxId: trimmedOptional,
    businessAddress: trimmedOptional,
    customerName: zod_1.z.string().trim().min(1, "Customer name is required"),
    customerEmail: optionalEmail,
    customerTaxId: trimmedOptional,
    customerAddress: trimmedOptional,
    notes: trimmedOptional,
    terms: trimmedOptional,
    pdfStyle: pdfStyleEnum.optional(),
    items: zod_1.z.array(exports.invoiceItemSchema).min(1, "Add at least one line item"),
}));
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
