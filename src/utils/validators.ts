import { z } from "zod";

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
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discountRate: z.coerce.number().min(0).max(100).default(0),
});

export const invoiceSchema = z.object({
  clientId: z.coerce.number().int().positive().optional().nullable(),
  invoiceNumber: z.string().optional(),
  issueDate: z.string(),
  dueDate: z.string(),
  status: z.enum(["Draft", "Sent", "Paid", "Overdue"]).default("Draft"),
  currency: z.string().min(3).max(3).default("USD"),
  businessName: z.string().min(2),
  businessEmail: z.email().optional().or(z.literal("")),
  businessTaxId: z.string().optional(),
  businessAddress: z.string().optional(),
  customerName: z.string().min(2),
  customerEmail: z.email().optional().or(z.literal("")),
  customerTaxId: z.string().optional(),
  customerAddress: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
});

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
});

export const textToInvoiceSchema = z.object({
  text: z.string().min(10),
});
