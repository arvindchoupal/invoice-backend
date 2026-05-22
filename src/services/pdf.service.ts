import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { env } from "../config/env";

export const PDF_STYLES = [
  "corporate",
  "classic",
  "minimal",
  "executive",
  "startup",
  "gst",
  "agency",
  "construction",
  "retail",
  "premium",
  "midnight",
  "emerald",
  "sunrise",
  "mono",
  "stripe",
  "ledger",
  "studio",
] as const;

export type PdfStyleId = (typeof PDF_STYLES)[number];

interface PdfTheme {
  id: PdfStyleId;
  label: string;
  accent: string;
  accentDark: string;
  text: string;
  muted: string;
  soft: string;
  header: "solid" | "split" | "minimal" | "side" | "bar";
  table: "dark" | "line" | "soft";
}

export const PDF_STYLE_META: Record<PdfStyleId, PdfTheme> = {
  corporate: { id: "corporate", label: "Corporate", accent: "#2563eb", accentDark: "#0f172a", text: "#0f172a", muted: "#64748b", soft: "#eff6ff", header: "solid", table: "dark" },
  classic: { id: "classic", label: "Classic Professional", accent: "#2563eb", accentDark: "#0f172a", text: "#0f172a", muted: "#64748b", soft: "#eff6ff", header: "solid", table: "dark" },
  minimal: { id: "minimal", label: "Minimal White", accent: "#111827", accentDark: "#111827", text: "#111827", muted: "#6b7280", soft: "#f9fafb", header: "minimal", table: "line" },
  executive: { id: "executive", label: "Executive Navy", accent: "#1d4ed8", accentDark: "#172554", text: "#111827", muted: "#64748b", soft: "#dbeafe", header: "split", table: "dark" },
  startup: { id: "startup", label: "Startup", accent: "#0ea5e9", accentDark: "#075985", text: "#0f172a", muted: "#64748b", soft: "#e0f2fe", header: "bar", table: "soft" },
  gst: { id: "gst", label: "GST Compliant", accent: "#059669", accentDark: "#064e3b", text: "#10231b", muted: "#64748b", soft: "#d1fae5", header: "side", table: "line" },
  agency: { id: "agency", label: "Agency", accent: "#db2777", accentDark: "#831843", text: "#111827", muted: "#64748b", soft: "#fce7f3", header: "bar", table: "soft" },
  construction: { id: "construction", label: "Construction", accent: "#d97706", accentDark: "#78350f", text: "#111827", muted: "#64748b", soft: "#fef3c7", header: "bar", table: "line" },
  retail: { id: "retail", label: "Retail", accent: "#7c3aed", accentDark: "#4c1d95", text: "#111827", muted: "#64748b", soft: "#ede9fe", header: "side", table: "soft" },
  premium: { id: "premium", label: "Premium", accent: "#7c3aed", accentDark: "#3b0764", text: "#111827", muted: "#64748b", soft: "#ede9fe", header: "split", table: "dark" },
  midnight: { id: "midnight", label: "Midnight Contrast", accent: "#38bdf8", accentDark: "#020617", text: "#0f172a", muted: "#64748b", soft: "#e0f2fe", header: "solid", table: "dark" },
  emerald: { id: "emerald", label: "Emerald Ledger", accent: "#059669", accentDark: "#064e3b", text: "#10231b", muted: "#64748b", soft: "#d1fae5", header: "side", table: "soft" },
  sunrise: { id: "sunrise", label: "Sunrise Modern", accent: "#f97316", accentDark: "#7c2d12", text: "#111827", muted: "#6b7280", soft: "#ffedd5", header: "bar", table: "soft" },
  mono: { id: "mono", label: "Mono Grid", accent: "#525252", accentDark: "#171717", text: "#171717", muted: "#737373", soft: "#f5f5f5", header: "minimal", table: "line" },
  stripe: { id: "stripe", label: "Blue Stripe", accent: "#0ea5e9", accentDark: "#075985", text: "#0f172a", muted: "#64748b", soft: "#e0f2fe", header: "side", table: "dark" },
  ledger: { id: "ledger", label: "Tax Ledger", accent: "#7c3aed", accentDark: "#3b0764", text: "#111827", muted: "#64748b", soft: "#ede9fe", header: "split", table: "line" },
  studio: { id: "studio", label: "Creative Studio", accent: "#db2777", accentDark: "#831843", text: "#111827", muted: "#64748b", soft: "#fce7f3", header: "bar", table: "soft" },
};

function logoPath(settings?: Record<string, unknown>) {
  const logoUrl = String(settings?.logo_url ?? "");
  if (!logoUrl) return "";
  if (path.isAbsolute(logoUrl) && fs.existsSync(logoUrl)) return logoUrl;
  const fileName = logoUrl.replace(/^\/?uploads\//, "");
  const resolved = path.resolve(env.uploadDir, fileName);
  return fs.existsSync(resolved) ? resolved : "";
}

export function normalizePdfStyle(style: unknown): PdfStyleId {
  return PDF_STYLES.includes(style as PdfStyleId) ? (style as PdfStyleId) : "classic";
}

export function renderInvoicePdf(invoice: Record<string, unknown>, items: Array<Record<string, unknown>>, style: PdfStyleId = "classic", settings: Record<string, unknown> = {}) {
  return new Promise<Buffer>((resolve) => {
    const theme = PDF_STYLE_META[style];
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    drawHeader(doc, invoice, theme, settings);
    drawParties(doc, invoice, theme);
    const itemTop = drawTemplateStructure(doc, invoice, items, theme);
    const tableBottom = drawItems(doc, items, theme, itemTop);
    drawTotals(doc, invoice, theme, tableBottom + 16);
    drawFooter(doc, invoice, theme);

    doc.end();
  });
}

function drawLogo(doc: PDFKit.PDFDocument, settings: Record<string, unknown> | undefined, x: number, y: number, size = 38) {
  const file = logoPath(settings);
  if (!file) return false;
  try {
    doc.image(file, x, y, { fit: [size, size] });
    return true;
  } catch {
    return false;
  }
}

function drawHeader(doc: PDFKit.PDFDocument, invoice: Record<string, unknown>, theme: PdfTheme, settings?: Record<string, unknown>) {
  const hasLogo = drawLogo(doc, settings, 48, 36, 42);
  const textX = hasLogo ? 100 : 48;
  if (theme.header === "solid") {
    doc.rect(0, 0, 595, 132).fill(theme.accentDark);
    drawLogo(doc, settings, 48, 38, 42);
    doc.fillColor("#ffffff").fontSize(24).text(String(invoice.business_name ?? "Invoice Maker"), textX, 42);
    doc.fontSize(10).fillColor("#cbd5e1").text(String(invoice.business_address ?? ""), textX, 72, { width: 250 });
    doc.fillColor(theme.accent).roundedRect(410, 38, 136, 54, 6).fill();
    doc.fillColor("#ffffff").fontSize(22).text("INVOICE", 426, 48);
    doc.fontSize(10).text(String(invoice.invoice_number), 426, 74);
    return;
  }

  if (theme.header === "split") {
    doc.rect(0, 0, 250, 132).fill(theme.accentDark);
    doc.rect(250, 0, 345, 132).fill(theme.soft);
    drawLogo(doc, settings, 48, 38, 38);
    doc.fillColor("#ffffff").fontSize(22).text(String(invoice.business_name ?? "Invoice Maker"), hasLogo ? 94 : 48, 40, { width: hasLogo ? 130 : 170 });
    doc.fillColor(theme.text).fontSize(30).text("INVOICE", 365, 42);
    doc.fontSize(11).fillColor(theme.muted).text(String(invoice.invoice_number), 368, 78);
    return;
  }

  if (theme.header === "side") {
    doc.rect(0, 0, 24, 842).fill(theme.accent);
    drawLogo(doc, settings, 52, 38, 38);
    doc.fillColor(theme.text).fontSize(24).text(String(invoice.business_name ?? "Invoice Maker"), hasLogo ? 98 : 52, 42);
    doc.fillColor(theme.accentDark).fontSize(32).text("INVOICE", 390, 40);
    doc.fontSize(10).fillColor(theme.muted).text(String(invoice.invoice_number), 394, 78);
    return;
  }

  if (theme.header === "bar") {
    doc.rect(48, 34, 500, 10).fill(theme.accent);
    drawLogo(doc, settings, 48, 58, 38);
    doc.fillColor(theme.text).fontSize(24).text(String(invoice.business_name ?? "Invoice Maker"), hasLogo ? 94 : 48, 64);
    doc.fontSize(34).fillColor(theme.accentDark).text("INVOICE", 374, 58);
    doc.fontSize(10).fillColor(theme.muted).text(String(invoice.invoice_number), 380, 94);
    return;
  }

  doc.fillColor(theme.text).fontSize(24).text(String(invoice.business_name ?? "Invoice Maker"), textX, 42);
  doc.fontSize(10).fillColor(theme.muted).text(String(invoice.business_address ?? ""), textX, 72, { width: 260 });
  doc.moveTo(48, 112).lineTo(548, 112).strokeColor(theme.accent).lineWidth(2).stroke();
  doc.fillColor(theme.text).fontSize(30).text("INVOICE", 400, 42);
  doc.fontSize(10).fillColor(theme.muted).text(String(invoice.invoice_number), 404, 78);
}

function drawParties(doc: PDFKit.PDFDocument, invoice: Record<string, unknown>, theme: PdfTheme) {
  const y = 158;
  doc.fillColor(theme.muted).fontSize(9).text("BILL TO", 48, y);
  doc.fillColor(theme.text).fontSize(16).text(String(invoice.customer_name ?? ""), 48, y + 18, { width: 220 });
  doc.fontSize(10).fillColor(theme.muted).text(String(invoice.customer_email ?? ""), 48, y + 42, { width: 220 });
  doc.text(String(invoice.customer_address ?? ""), 48, y + 58, { width: 220 });

  doc.roundedRect(336, y - 8, 212, 92, 6).fill(theme.soft);
  doc.fillColor(theme.text).fontSize(10).text(`Issue Date: ${String(invoice.issue_date).slice(0, 10)}`, 356, y + 8);
  doc.text(`Due Date: ${String(invoice.due_date).slice(0, 10)}`, 356, y + 30);
  doc.text(`Status: ${String(invoice.status)}`, 356, y + 52);
}

function drawTemplateStructure(doc: PDFKit.PDFDocument, invoice: Record<string, unknown>, items: Array<Record<string, unknown>>, theme: PdfTheme) {
  if (theme.id === "corporate" || theme.id === "classic") {
    doc.roundedRect(48, 252, 500, 36, 6).fill(theme.soft);
    doc.fillColor(theme.accentDark).fontSize(10).text("PAYMENT TERMS", 62, 264);
    doc.fillColor(theme.text).fontSize(10).text(String(invoice.terms ?? "Payment is due by the invoice due date."), 170, 264, { width: 250 });
    doc.fillColor(theme.accent).roundedRect(450, 260, 76, 18, 9).fill();
    doc.fillColor("#ffffff").fontSize(8).text(`DUE ${String(invoice.due_date).slice(0, 10)}`, 462, 265);
    return 324;
  }

  if (theme.id === "agency" || theme.id === "studio") {
    const hours = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
    doc.roundedRect(48, 252, 500, 52, 8).fill(theme.soft);
    doc.fillColor(theme.accentDark).fontSize(10).text("PROJECT SUMMARY", 62, 266);
    doc.fillColor(theme.text).fontSize(9).text("Creative, consulting, retainer or service work billed by deliverable and hours.", 62, 282, { width: 320 });
    doc.fillColor(theme.text).fontSize(18).text(hours.toFixed(2), 440, 262);
    doc.fillColor(theme.muted).fontSize(8).text("TOTAL HOURS", 438, 284);
    return 340;
  }

  if (theme.id === "construction") {
    const subtotal = Number(invoice.subtotal ?? 0);
    doc.roundedRect(48, 252, 500, 58, 8).fill(theme.soft);
    doc.fillColor(theme.accentDark).fontSize(10).text("CONSTRUCTION BREAKDOWN", 62, 266);
    doc.fillColor(theme.text).fontSize(11).text(`Materials: ${(subtotal * 0.58).toFixed(2)}`, 62, 286);
    doc.text(`Labor: ${(subtotal * 0.42).toFixed(2)}`, 220, 286);
    doc.text("Milestone: Completion billing", 360, 286, { width: 160 });
    return 348;
  }

  if (theme.id === "gst" || theme.id === "ledger") {
    doc.roundedRect(48, 252, 500, 48, 8).fill(theme.soft);
    doc.fillColor(theme.accentDark).fontSize(10).text("GST DETAILS", 62, 266);
    doc.fillColor(theme.text).fontSize(9).text(`Supplier GSTIN: ${String(invoice.business_tax_id ?? "-")}`, 62, 284);
    doc.text(`Customer GSTIN: ${String(invoice.customer_tax_id ?? "-")}`, 282, 284);
    return 336;
  }

  if (theme.id === "retail") {
    doc.roundedRect(48, 252, 500, 46, 8).fill(theme.soft);
    doc.fillColor(theme.accentDark).fontSize(10).text("RETAIL SALE", 62, 266);
    doc.fillColor(theme.text).fontSize(9).text("HSN, quantity and barcode-style product sale layout.", 62, 284);
    let x = 450;
    [16, 28, 20, 34, 14, 26, 18, 30].forEach((height) => {
      doc.rect(x, 286 - height, 3, height).fill(theme.accentDark);
      x += 7;
    });
    return 336;
  }

  return 288;
}

function drawItems(doc: PDFKit.PDFDocument, items: Array<Record<string, unknown>>, theme: PdfTheme, top = 288) {
  const headerFill = theme.table === "dark" ? theme.accentDark : theme.soft;
  const headerText = theme.table === "dark" ? "#ffffff" : theme.text;
  doc.roundedRect(48, top - 28, 500, 30, 4).fill(headerFill);
  const isGst = theme.id === "gst" || theme.id === "ledger";
  const isRetail = theme.id === "retail";
  const isAgency = theme.id === "agency" || theme.id === "studio";
  doc.fillColor(headerText).fontSize(9).text(isAgency ? "DELIVERABLE" : theme.id === "construction" ? "MATERIAL / LABOR" : "ITEM", 60, top - 18);
  doc.text(isAgency ? "HRS" : "QTY", 292, top - 18);
  if (isGst || isRetail) doc.text("HSN", 336, top - 18);
  doc.text("RATE", isGst || isRetail ? 382 : 350, top - 18);
  doc.text("TAX", isGst || isRetail ? 432 : 410, top - 18);
  doc.text("TOTAL", 486, top - 18);

  let y = top + 16;
  items.forEach((item, index) => {
    if (theme.table === "soft" && index % 2 === 0) doc.roundedRect(54, y - 8, 488, 28, 3).fill(theme.soft);
    const qty = Number(item.quantity ?? 0);
    const rate = Number(item.unit_price ?? 0);
    const tax = Number(item.tax_rate ?? 0);
    const discount = Number(item.discount_rate ?? 0);
    const lineTotal = qty * rate * (1 - discount / 100) * (1 + tax / 100);
    doc.fillColor(theme.text).fontSize(10).text(String(item.name), 60, y, { width: 210 });
    doc.fillColor(theme.muted).fontSize(9).text(String(item.description ?? ""), 60, y + 12, { width: 210 });
    doc.fillColor(theme.text).fontSize(10).text(String(qty), 292, y);
    if (isGst || isRetail) doc.text(isRetail ? `89${index}1` : `99${index}0`, 336, y);
    doc.text(rate.toFixed(2), isGst || isRetail ? 382 : 350, y);
    doc.text(`${tax}%`, isGst || isRetail ? 432 : 410, y);
    doc.text(lineTotal.toFixed(2), 486, y, { width: 54, align: "right" });
    doc.moveTo(58, y + 30).lineTo(538, y + 30).strokeColor(theme.table === "line" ? "#e5e7eb" : "#ffffff").lineWidth(1).stroke();
    y += 38;
  });
  return y;
}

function drawTotals(doc: PDFKit.PDFDocument, invoice: Record<string, unknown>, theme: PdfTheme, y: number) {
  const isGst = theme.id === "gst" || theme.id === "ledger";
  doc.roundedRect(336, y, 212, isGst ? 164 : 118, 6).fill(theme.soft);
  doc.fillColor(theme.text).fontSize(10);
  doc.text(`Subtotal: ${Number(invoice.subtotal ?? 0).toFixed(2)}`, 356, y + 18);
  doc.text(`Discount: ${Number(invoice.discount_total ?? 0).toFixed(2)}`, 356, y + 40);
  doc.text(`Tax: ${Number(invoice.tax_total ?? 0).toFixed(2)}`, 356, y + 62);
  if (isGst) {
    const tax = Number(invoice.tax_total ?? 0);
    doc.text(`CGST: ${(tax / 2).toFixed(2)}`, 356, y + 84);
    doc.text(`SGST: ${(tax / 2).toFixed(2)}`, 356, y + 106);
    doc.text(`IGST: ${tax.toFixed(2)}`, 356, y + 128);
    doc.fillColor(theme.accentDark).fontSize(16).text(`Total: ${String(invoice.currency)} ${Number(invoice.total ?? 0).toFixed(2)}`, 356, y + 148);
    return;
  }
  doc.fillColor(theme.accentDark).fontSize(16).text(`Total: ${String(invoice.currency)} ${Number(invoice.total ?? 0).toFixed(2)}`, 356, y + 88);
}

function drawFooter(doc: PDFKit.PDFDocument, invoice: Record<string, unknown>, theme: PdfTheme) {
  doc.fillColor(theme.text).fontSize(10).text("Notes", 48, 650);
  doc.fillColor(theme.muted).fontSize(9).text(String(invoice.notes ?? ""), 48, 668, { width: 230 });
  doc.fillColor(theme.text).fontSize(10).text("Terms", 48, 724);
  doc.fillColor(theme.muted).fontSize(9).text(String(invoice.terms ?? ""), 48, 742, { width: 500 });
  doc.moveTo(48, 812).lineTo(548, 812).strokeColor(theme.accent).lineWidth(1).stroke();
}
