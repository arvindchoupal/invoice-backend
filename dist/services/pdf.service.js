"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDF_STYLE_META = exports.PDF_STYLES = void 0;
exports.normalizePdfStyle = normalizePdfStyle;
exports.renderInvoicePdf = renderInvoicePdf;
const pdfkit_1 = __importDefault(require("pdfkit"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
exports.PDF_STYLES = [
    "neat",
    "corporate",
    "classic",
    "classicWhite",
    "bandBlue",
    "minimal",
    "executive",
    "startup",
    "gst",
    "agency",
    "construction",
    "retail",
    "premium",
    "modernRed",
    "coolWaves",
    "midnight",
    "emerald",
    "sunrise",
    "mono",
    "monoBlack",
    "stripe",
    "ledger",
    "studio",
    "pureWhite",
    "slim",
    "cleanGreen",
    "modernBlack",
    "bandNavy",
    "enterpriseBlack",
    "enterpriseBlue",
    "modernOrange",
    "sharp",
    "cleanBlue",
    "pureBlue",
    "cleanRed",
    "cleanOrange",
    "bandGreen",
    "modernBlue",
    "gstIndia",
    "receipt",
    "quotation",
    "purchaseOrder",
    "noLogoSlate",
    "noLogoTeal",
    "transparentBlue",
    "transparentLeaf",
    "transparentRose",
];
exports.PDF_STYLE_META = {
    neat: { id: "neat", label: "Neat", accent: "#2563eb", accentDark: "#1e3a8a", text: "#0f172a", muted: "#64748b", soft: "#eff6ff", header: "bar", table: "line", category: "classic" },
    corporate: { id: "corporate", label: "Corporate", accent: "#2563eb", accentDark: "#0f172a", text: "#0f172a", muted: "#64748b", soft: "#eff6ff", header: "solid", table: "dark" },
    classic: { id: "classic", label: "Classic Professional", accent: "#2563eb", accentDark: "#0f172a", text: "#0f172a", muted: "#64748b", soft: "#eff6ff", header: "solid", table: "dark" },
    classicWhite: { id: "classicWhite", label: "Classic White", accent: "#334155", accentDark: "#111827", text: "#111827", muted: "#64748b", soft: "#f8fafc", header: "minimal", table: "line", category: "classic" },
    bandBlue: { id: "bandBlue", label: "Band Blue", accent: "#2563eb", accentDark: "#1e40af", text: "#0f172a", muted: "#64748b", soft: "#dbeafe", header: "bar", table: "dark", category: "modern" },
    minimal: { id: "minimal", label: "Minimal White", accent: "#111827", accentDark: "#111827", text: "#111827", muted: "#6b7280", soft: "#f9fafb", header: "minimal", table: "line" },
    executive: { id: "executive", label: "Executive Navy", accent: "#1d4ed8", accentDark: "#172554", text: "#111827", muted: "#64748b", soft: "#dbeafe", header: "split", table: "dark" },
    startup: { id: "startup", label: "Startup", accent: "#0ea5e9", accentDark: "#075985", text: "#0f172a", muted: "#64748b", soft: "#e0f2fe", header: "bar", table: "soft" },
    gst: { id: "gst", label: "GST Compliant", accent: "#059669", accentDark: "#064e3b", text: "#10231b", muted: "#64748b", soft: "#d1fae5", header: "side", table: "line" },
    agency: { id: "agency", label: "Agency", accent: "#db2777", accentDark: "#831843", text: "#111827", muted: "#64748b", soft: "#fce7f3", header: "bar", table: "soft" },
    construction: { id: "construction", label: "Construction", accent: "#d97706", accentDark: "#78350f", text: "#111827", muted: "#64748b", soft: "#fef3c7", header: "bar", table: "line" },
    retail: { id: "retail", label: "Retail", accent: "#7c3aed", accentDark: "#4c1d95", text: "#111827", muted: "#64748b", soft: "#ede9fe", header: "side", table: "soft" },
    premium: { id: "premium", label: "Premium", accent: "#7c3aed", accentDark: "#3b0764", text: "#111827", muted: "#64748b", soft: "#ede9fe", header: "split", table: "dark" },
    modernRed: { id: "modernRed", label: "Modern Red", accent: "#ef4444", accentDark: "#991b1b", text: "#111827", muted: "#64748b", soft: "#fee2e2", header: "bar", table: "dark", category: "modern" },
    coolWaves: { id: "coolWaves", label: "Cool Waves", accent: "#06b6d4", accentDark: "#155e75", text: "#0f172a", muted: "#64748b", soft: "#cffafe", header: "split", table: "soft", category: "modern" },
    midnight: { id: "midnight", label: "Midnight Contrast", accent: "#38bdf8", accentDark: "#020617", text: "#0f172a", muted: "#64748b", soft: "#e0f2fe", header: "solid", table: "dark" },
    emerald: { id: "emerald", label: "Emerald Ledger", accent: "#059669", accentDark: "#064e3b", text: "#10231b", muted: "#64748b", soft: "#d1fae5", header: "side", table: "soft" },
    sunrise: { id: "sunrise", label: "Sunrise Modern", accent: "#f97316", accentDark: "#7c2d12", text: "#111827", muted: "#6b7280", soft: "#ffedd5", header: "bar", table: "soft" },
    mono: { id: "mono", label: "Mono Grid", accent: "#525252", accentDark: "#171717", text: "#171717", muted: "#737373", soft: "#f5f5f5", header: "minimal", table: "line" },
    monoBlack: { id: "monoBlack", label: "Mono Black", accent: "#111827", accentDark: "#030712", text: "#111827", muted: "#6b7280", soft: "#f3f4f6", header: "side", table: "dark", category: "minimal" },
    stripe: { id: "stripe", label: "Blue Stripe", accent: "#0ea5e9", accentDark: "#075985", text: "#0f172a", muted: "#64748b", soft: "#e0f2fe", header: "side", table: "dark" },
    ledger: { id: "ledger", label: "Tax Ledger", accent: "#7c3aed", accentDark: "#3b0764", text: "#111827", muted: "#64748b", soft: "#ede9fe", header: "split", table: "line" },
    studio: { id: "studio", label: "Creative Studio", accent: "#db2777", accentDark: "#831843", text: "#111827", muted: "#64748b", soft: "#fce7f3", header: "bar", table: "soft" },
    pureWhite: { id: "pureWhite", label: "Pure White", accent: "#64748b", accentDark: "#0f172a", text: "#0f172a", muted: "#64748b", soft: "#ffffff", header: "minimal", table: "line", category: "minimal" },
    slim: { id: "slim", label: "Slim", accent: "#0f766e", accentDark: "#134e4a", text: "#0f172a", muted: "#64748b", soft: "#ccfbf1", header: "minimal", table: "soft", category: "minimal" },
    cleanGreen: { id: "cleanGreen", label: "Clean Green", accent: "#22c55e", accentDark: "#166534", text: "#0f172a", muted: "#64748b", soft: "#dcfce7", header: "bar", table: "line", category: "classic" },
    modernBlack: { id: "modernBlack", label: "Modern Black", accent: "#111827", accentDark: "#030712", text: "#111827", muted: "#64748b", soft: "#f3f4f6", header: "solid", table: "dark", category: "modern" },
    bandNavy: { id: "bandNavy", label: "Band Navy Blue", accent: "#1d4ed8", accentDark: "#172554", text: "#0f172a", muted: "#64748b", soft: "#dbeafe", header: "bar", table: "dark", category: "modern" },
    enterpriseBlack: { id: "enterpriseBlack", label: "Enterprise Black", accent: "#27272a", accentDark: "#09090b", text: "#111827", muted: "#71717a", soft: "#f4f4f5", header: "split", table: "dark", category: "classic" },
    enterpriseBlue: { id: "enterpriseBlue", label: "Enterprise Blue", accent: "#2563eb", accentDark: "#1e3a8a", text: "#0f172a", muted: "#64748b", soft: "#dbeafe", header: "split", table: "dark", category: "classic" },
    modernOrange: { id: "modernOrange", label: "Modern Orange", accent: "#f97316", accentDark: "#9a3412", text: "#111827", muted: "#64748b", soft: "#ffedd5", header: "bar", table: "soft", category: "modern" },
    sharp: { id: "sharp", label: "Sharp", accent: "#0f172a", accentDark: "#020617", text: "#0f172a", muted: "#64748b", soft: "#e2e8f0", header: "side", table: "line", category: "minimal" },
    cleanBlue: { id: "cleanBlue", label: "Clean Blue", accent: "#3b82f6", accentDark: "#1e40af", text: "#0f172a", muted: "#64748b", soft: "#dbeafe", header: "minimal", table: "line", category: "classic" },
    pureBlue: { id: "pureBlue", label: "Pure Blue", accent: "#2563eb", accentDark: "#1d4ed8", text: "#0f172a", muted: "#64748b", soft: "#eff6ff", header: "solid", table: "soft", category: "modern" },
    cleanRed: { id: "cleanRed", label: "Clean Red", accent: "#dc2626", accentDark: "#991b1b", text: "#111827", muted: "#64748b", soft: "#fee2e2", header: "minimal", table: "line", category: "classic" },
    cleanOrange: { id: "cleanOrange", label: "Clean Orange", accent: "#ea580c", accentDark: "#9a3412", text: "#111827", muted: "#64748b", soft: "#ffedd5", header: "minimal", table: "soft", category: "classic" },
    bandGreen: { id: "bandGreen", label: "Band Green", accent: "#16a34a", accentDark: "#166534", text: "#0f172a", muted: "#64748b", soft: "#dcfce7", header: "bar", table: "dark", category: "modern" },
    modernBlue: { id: "modernBlue", label: "Modern Blue", accent: "#0ea5e9", accentDark: "#075985", text: "#0f172a", muted: "#64748b", soft: "#e0f2fe", header: "bar", table: "soft", category: "modern" },
    gstIndia: { id: "gstIndia", label: "GST India", accent: "#059669", accentDark: "#064e3b", text: "#10231b", muted: "#64748b", soft: "#d1fae5", header: "side", table: "line", category: "gst" },
    receipt: { id: "receipt", label: "Receipt", accent: "#7c3aed", accentDark: "#4c1d95", text: "#111827", muted: "#64748b", soft: "#ede9fe", header: "side", table: "soft", category: "retail" },
    quotation: { id: "quotation", label: "Quotation", accent: "#0ea5e9", accentDark: "#075985", text: "#0f172a", muted: "#64748b", soft: "#e0f2fe", header: "split", table: "line", category: "document" },
    purchaseOrder: { id: "purchaseOrder", label: "Purchase Order", accent: "#d97706", accentDark: "#78350f", text: "#111827", muted: "#64748b", soft: "#fef3c7", header: "bar", table: "line", category: "document" },
    noLogoSlate: { id: "noLogoSlate", label: "Slate Clean (No Logo)", accent: "#475569", accentDark: "#0f172a", text: "#0f172a", muted: "#64748b", soft: "#f1f5f9", header: "minimal", table: "line", category: "minimal", noLogo: true },
    noLogoTeal: { id: "noLogoTeal", label: "Contemporary Teal (No Logo)", accent: "#14b8a6", accentDark: "#115e59", text: "#0f172a", muted: "#64748b", soft: "#ccfbf1", header: "bar", table: "soft", category: "modern", noLogo: true },
    transparentBlue: { id: "transparentBlue", label: "Transparent Blue", accent: "#38bdf8", accentDark: "#075985", text: "#0f172a", muted: "#64748b", soft: "#e0f2fe", header: "minimal", table: "line", category: "modern", watermark: "waves" },
    transparentLeaf: { id: "transparentLeaf", label: "Transparent Leaf", accent: "#22c55e", accentDark: "#166534", text: "#0f172a", muted: "#64748b", soft: "#dcfce7", header: "minimal", table: "soft", category: "modern", watermark: "leaf" },
    transparentRose: { id: "transparentRose", label: "Transparent Rose", accent: "#f43f5e", accentDark: "#9f1239", text: "#111827", muted: "#64748b", soft: "#ffe4e6", header: "minimal", table: "line", category: "modern", watermark: "rose" },
};
function logoPath(settings) {
    const logoUrl = String(settings?.logo_url ?? "");
    if (!logoUrl)
        return "";
    if (path_1.default.isAbsolute(logoUrl) && fs_1.default.existsSync(logoUrl))
        return logoUrl;
    const fileName = logoUrl.replace(/^\/?uploads\//, "");
    const resolved = path_1.default.resolve(env_1.env.uploadDir, fileName);
    return fs_1.default.existsSync(resolved) ? resolved : "";
}
function hasLogo(settings) {
    return Boolean(logoPath(settings));
}
function themeAllowsLogo(theme) {
    return !theme.noLogo;
}
function formatDate(value) {
    if (!value)
        return "";
    if (value instanceof Date)
        return value.toISOString().slice(0, 10);
    const raw = String(value);
    const isoMatch = raw.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoMatch)
        return isoMatch[0];
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}
function normalizePdfStyle(style) {
    return exports.PDF_STYLES.includes(style) ? style : "classic";
}
function renderInvoicePdf(invoice, items, style = "classic", settings = {}) {
    return new Promise((resolve) => {
        const theme = exports.PDF_STYLE_META[style];
        const doc = new pdfkit_1.default({ margin: 48, size: "A4" });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        drawWatermark(doc, theme);
        drawHeader(doc, invoice, theme, settings);
        drawParties(doc, invoice, theme);
        const itemTop = drawTemplateStructure(doc, invoice, items, theme);
        const tableBottom = drawItems(doc, items, theme, itemTop);
        drawTotals(doc, invoice, theme, tableBottom + 16);
        drawFooter(doc, invoice, theme);
        doc.end();
    });
}
function drawWatermark(doc, theme) {
    if (!theme.watermark)
        return;
    doc.save();
    doc.opacity(0.12);
    if (theme.watermark === "waves") {
        doc.moveTo(48, 550).bezierCurveTo(170, 470, 260, 640, 380, 550).bezierCurveTo(450, 500, 500, 520, 560, 480).lineWidth(26).strokeColor(theme.accent).stroke();
        doc.moveTo(30, 610).bezierCurveTo(160, 530, 250, 690, 390, 610).bezierCurveTo(470, 565, 520, 580, 590, 540).lineWidth(18).strokeColor(theme.accentDark).stroke();
    }
    if (theme.watermark === "leaf") {
        doc.ellipse(455, 580, 96, 36).rotate(-18, { origin: [455, 580] }).fillColor(theme.accent).fill();
        doc.ellipse(365, 650, 82, 30).rotate(-24, { origin: [365, 650] }).fillColor(theme.accentDark).fill();
    }
    if (theme.watermark === "rose") {
        doc.circle(470, 590, 64).fillColor(theme.accent).fill();
        doc.circle(420, 640, 52).fillColor(theme.accentDark).fill();
        doc.circle(525, 650, 46).fillColor(theme.accent).fill();
    }
    doc.opacity(1);
    doc.restore();
}
function drawLogo(doc, settings, x, y, size = 38) {
    const file = logoPath(settings);
    if (!file)
        return false;
    try {
        doc.image(file, x, y, { fit: [size, size] });
        return true;
    }
    catch {
        return false;
    }
}
function drawHeader(doc, invoice, theme, settings) {
    const logoAvailable = themeAllowsLogo(theme) && hasLogo(settings);
    const textX = logoAvailable ? 100 : 48;
    if (theme.header === "solid") {
        doc.rect(0, 0, 595, 132).fill(theme.accentDark);
        if (themeAllowsLogo(theme))
            drawLogo(doc, settings, 48, 38, 42);
        doc.fillColor("#ffffff").fontSize(24).text(String(invoice.business_name ?? "InvoiceWala"), textX, 42);
        doc.fontSize(10).fillColor("#cbd5e1").text(String(invoice.business_address ?? ""), textX, 72, { width: 250 });
        doc.fillColor(theme.accent).roundedRect(410, 38, 136, 54, 6).fill();
        doc.fillColor("#ffffff").fontSize(22).text("INVOICE", 426, 48);
        doc.fontSize(10).text(String(invoice.invoice_number), 426, 74);
        return;
    }
    if (theme.header === "split") {
        doc.rect(0, 0, 250, 132).fill(theme.accentDark);
        doc.rect(250, 0, 345, 132).fill(theme.soft);
        if (themeAllowsLogo(theme))
            drawLogo(doc, settings, 48, 38, 38);
        doc.fillColor("#ffffff").fontSize(22).text(String(invoice.business_name ?? "InvoiceWala"), logoAvailable ? 94 : 48, 40, { width: logoAvailable ? 130 : 170 });
        doc.fillColor(theme.text).fontSize(30).text("INVOICE", 365, 42);
        doc.fontSize(11).fillColor(theme.muted).text(String(invoice.invoice_number), 368, 78);
        return;
    }
    if (theme.header === "side") {
        doc.rect(0, 0, 24, 842).fill(theme.accent);
        if (themeAllowsLogo(theme))
            drawLogo(doc, settings, 52, 38, 38);
        doc.fillColor(theme.text).fontSize(24).text(String(invoice.business_name ?? "InvoiceWala"), logoAvailable ? 98 : 52, 42);
        doc.fillColor(theme.accentDark).fontSize(32).text("INVOICE", 390, 40);
        doc.fontSize(10).fillColor(theme.muted).text(String(invoice.invoice_number), 394, 78);
        return;
    }
    if (theme.header === "bar") {
        doc.rect(48, 34, 500, 10).fill(theme.accent);
        if (themeAllowsLogo(theme))
            drawLogo(doc, settings, 48, 58, 38);
        doc.fillColor(theme.text).fontSize(24).text(String(invoice.business_name ?? "InvoiceWala"), logoAvailable ? 94 : 48, 64);
        doc.fontSize(34).fillColor(theme.accentDark).text("INVOICE", 374, 58);
        doc.fontSize(10).fillColor(theme.muted).text(String(invoice.invoice_number), 380, 94);
        return;
    }
    doc.fillColor(theme.text).fontSize(24).text(String(invoice.business_name ?? "InvoiceWala"), textX, 42);
    doc.fontSize(10).fillColor(theme.muted).text(String(invoice.business_address ?? ""), textX, 72, { width: 260 });
    doc.moveTo(48, 112).lineTo(548, 112).strokeColor(theme.accent).lineWidth(2).stroke();
    doc.fillColor(theme.text).fontSize(30).text("INVOICE", 400, 42);
    doc.fontSize(10).fillColor(theme.muted).text(String(invoice.invoice_number), 404, 78);
}
function drawParties(doc, invoice, theme) {
    const y = 158;
    doc.fillColor(theme.muted).fontSize(9).text("BILL TO", 48, y);
    doc.fillColor(theme.text).fontSize(16).text(String(invoice.customer_name ?? ""), 48, y + 18, { width: 220 });
    doc.fontSize(10).fillColor(theme.muted).text(String(invoice.customer_email ?? ""), 48, y + 42, { width: 220 });
    doc.text(String(invoice.customer_address ?? ""), 48, y + 58, { width: 220 });
    doc.roundedRect(336, y - 8, 212, 92, 6).fill(theme.soft);
    doc.fillColor(theme.text).fontSize(10).text(`Issue Date: ${formatDate(invoice.issue_date)}`, 356, y + 8);
    doc.text(`Due Date: ${formatDate(invoice.due_date)}`, 356, y + 30);
    doc.text(`Status: ${String(invoice.status)}`, 356, y + 52);
}
function drawTemplateStructure(doc, invoice, items, theme) {
    const category = theme.category;
    const isGst = category === "gst" || theme.id === "gst" || theme.id === "ledger" || theme.id === "emerald";
    const isAgency = category === "agency" || theme.id === "agency" || theme.id === "studio";
    const isConstruction = category === "construction" || theme.id === "construction" || theme.id === "purchaseOrder";
    const isRetail = category === "retail" || theme.id === "retail" || theme.id === "receipt";
    const isDocument = category === "document" || theme.id === "quotation";
    if (!isGst && !isAgency && !isConstruction && !isRetail && theme.header !== "minimal") {
        doc.roundedRect(48, 252, 500, 36, 6).fill(theme.soft);
        doc.fillColor(theme.accentDark).fontSize(10).text(isDocument ? "DOCUMENT NOTES" : "PAYMENT TERMS", 62, 264);
        doc.fillColor(theme.text).fontSize(10).text(String(invoice.terms ?? "Payment is due by the invoice due date."), 170, 264, { width: 250 });
        doc.fillColor(theme.accent).roundedRect(450, 260, 76, 18, 9).fill();
        doc.fillColor("#ffffff").fontSize(8).text(`DUE ${formatDate(invoice.due_date)}`, 462, 265);
        return 324;
    }
    if (isAgency) {
        const hours = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
        doc.roundedRect(48, 252, 500, 52, 8).fill(theme.soft);
        doc.fillColor(theme.accentDark).fontSize(10).text("PROJECT SUMMARY", 62, 266);
        doc.fillColor(theme.text).fontSize(9).text("Creative, consulting, retainer or service work billed by deliverable and hours.", 62, 282, { width: 320 });
        doc.fillColor(theme.text).fontSize(18).text(hours.toFixed(2), 440, 262);
        doc.fillColor(theme.muted).fontSize(8).text("TOTAL HOURS", 438, 284);
        return 340;
    }
    if (isConstruction) {
        const subtotal = Number(invoice.subtotal ?? 0);
        doc.roundedRect(48, 252, 500, 58, 8).fill(theme.soft);
        doc.fillColor(theme.accentDark).fontSize(10).text(theme.id === "purchaseOrder" ? "PURCHASE ORDER BREAKDOWN" : "CONSTRUCTION BREAKDOWN", 62, 266);
        doc.fillColor(theme.text).fontSize(11).text(`Materials: ${(subtotal * 0.58).toFixed(2)}`, 62, 286);
        doc.text(`Labor: ${(subtotal * 0.42).toFixed(2)}`, 220, 286);
        doc.text("Milestone: Completion billing", 360, 286, { width: 160 });
        return 348;
    }
    if (isGst) {
        doc.roundedRect(48, 252, 500, 48, 8).fill(theme.soft);
        doc.fillColor(theme.accentDark).fontSize(10).text("GST DETAILS", 62, 266);
        doc.fillColor(theme.text).fontSize(9).text(`Supplier GSTIN: ${String(invoice.business_tax_id ?? "-")}`, 62, 284);
        doc.text(`Customer GSTIN: ${String(invoice.customer_tax_id ?? "-")}`, 282, 284);
        return 336;
    }
    if (isRetail) {
        doc.roundedRect(48, 252, 500, 46, 8).fill(theme.soft);
        doc.fillColor(theme.accentDark).fontSize(10).text(theme.id === "receipt" ? "RECEIPT SUMMARY" : "RETAIL SALE", 62, 266);
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
function drawItems(doc, items, theme, top = 288) {
    const headerFill = theme.table === "dark" ? theme.accentDark : theme.soft;
    const headerText = theme.table === "dark" ? "#ffffff" : theme.text;
    doc.roundedRect(48, top - 28, 500, 30, 4).fill(headerFill);
    const isGst = theme.category === "gst" || theme.id === "gst" || theme.id === "ledger" || theme.id === "emerald";
    const isRetail = theme.category === "retail" || theme.id === "retail" || theme.id === "receipt";
    const isAgency = theme.category === "agency" || theme.id === "agency" || theme.id === "studio";
    const isConstruction = theme.category === "construction" || theme.id === "construction" || theme.id === "purchaseOrder";
    doc.fillColor(headerText).fontSize(9).text(isAgency ? "DELIVERABLE" : isConstruction ? "MATERIAL / LABOR" : "ITEM", 60, top - 18);
    doc.text(isAgency ? "HRS" : "QTY", 292, top - 18);
    if (isGst || isRetail)
        doc.text("HSN", 336, top - 18);
    doc.text("RATE", isGst || isRetail ? 382 : 350, top - 18);
    doc.text("TAX", isGst || isRetail ? 432 : 410, top - 18);
    doc.text("TOTAL", 486, top - 18);
    let y = top + 16;
    items.forEach((item, index) => {
        if (theme.table === "soft" && index % 2 === 0)
            doc.roundedRect(54, y - 8, 488, 28, 3).fill(theme.soft);
        const qty = Number(item.quantity ?? 0);
        const rate = Number(item.unit_price ?? 0);
        const tax = Number(item.tax_rate ?? 0);
        const discount = Number(item.discount_rate ?? 0);
        const lineTotal = qty * rate * (1 - discount / 100) * (1 + tax / 100);
        doc.fillColor(theme.text).fontSize(10).text(String(item.name), 60, y, { width: 210 });
        doc.fillColor(theme.muted).fontSize(9).text(String(item.description ?? ""), 60, y + 12, { width: 210 });
        doc.fillColor(theme.text).fontSize(10).text(String(qty), 292, y);
        if (isGst || isRetail)
            doc.text(isRetail ? `89${index}1` : `99${index}0`, 336, y);
        doc.text(rate.toFixed(2), isGst || isRetail ? 382 : 350, y);
        doc.text(`${tax}%`, isGst || isRetail ? 432 : 410, y);
        doc.text(lineTotal.toFixed(2), 486, y, { width: 54, align: "right" });
        doc.moveTo(58, y + 30).lineTo(538, y + 30).strokeColor(theme.table === "line" ? "#e5e7eb" : "#ffffff").lineWidth(1).stroke();
        y += 38;
    });
    return y;
}
function drawTotals(doc, invoice, theme, y) {
    const isGst = theme.category === "gst" || theme.id === "gst" || theme.id === "ledger" || theme.id === "emerald";
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
function drawFooter(doc, invoice, theme) {
    doc.fillColor(theme.text).fontSize(10).text("Notes", 48, 650);
    doc.fillColor(theme.muted).fontSize(9).text(String(invoice.notes ?? ""), 48, 668, { width: 230 });
    doc.fillColor(theme.text).fontSize(10).text("Terms", 48, 724);
    doc.fillColor(theme.muted).fontSize(9).text(String(invoice.terms ?? ""), 48, 742, { width: 500 });
    doc.moveTo(48, 812).lineTo(548, 812).strokeColor(theme.accent).lineWidth(1).stroke();
}
