import { z } from "zod";
import { PDF_STYLES } from "../services/pdf.service";

const pdfStyleEnum = z.enum(PDF_STYLES as unknown as [string, ...string[]]);
const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const trimmedOptional = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalEmail = z.preprocess(emptyToUndefined, z.email().optional());

export const signupSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8),
});

export const clientSchema = z.object({
  name: z.string().min(2),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  notes: z.string().optional(),
});

export const invoiceItemSchema = z.object({
  name: z.string().trim().min(1, "Line item name is required"),
  description: trimmedOptional,
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discountRate: z.coerce.number().min(0).max(100).default(0),
});

export const invoiceSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const body = value as Record<string, unknown>;
  const items = Array.isArray(body.items)
    ? body.items.filter((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        const row = item as Record<string, unknown>;
        return [row.name, row.description, row.quantity, row.unitPrice, row.taxRate, row.discountRate].some((field) => {
          if (field === null || field === undefined) return false;
          if (typeof field === "string") return field.trim() !== "" && field.trim() !== "0";
          if (typeof field === "number") return field !== 0;
          return true;
        });
      })
    : body.items;
  return { ...body, items };
}, z.object({
  clientId: z.coerce.number().int().positive().optional().nullable(),
  invoiceNumber: trimmedOptional,
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  status: z.enum(["Draft", "Sent", "Paid", "Overdue"]).default("Draft"),
  currency: z.string().min(3).max(3).default("USD"),
  businessName: z.string().trim().min(1, "Business name is required"),
  businessEmail: optionalEmail,
  businessTaxId: trimmedOptional,
  businessAddress: trimmedOptional,
  customerName: z.string().trim().min(1, "Customer name is required"),
  customerEmail: optionalEmail,
  customerTaxId: trimmedOptional,
  customerAddress: trimmedOptional,
  notes: trimmedOptional,
  terms: trimmedOptional,
  pdfStyle: pdfStyleEnum.optional(),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item"),
}));

export const settingsSchema = z.object({
  companyName: z.string().optional(),
  companyEmail: z.email().optional().or(z.literal("")),
  companyAddress: z.string().optional(),
  companyTaxId: z.string().optional(),
  currency: z.string().min(3).max(3).default("USD"),
  taxName: z.string().default("VAT"),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  invoicePrefix: z.string().min(1).max(12).default("INV"),
  defaultPdfStyle: pdfStyleEnum.optional(),
});

export const textToInvoiceSchema = z.object({
  text: z.string().min(10),
});
