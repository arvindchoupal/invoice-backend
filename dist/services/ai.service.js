"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExtractionConfidence = buildExtractionConfidence;
exports.extractTextFromFile = extractTextFromFile;
exports.inferInvoiceFromText = inferInvoiceFromText;
const promises_1 = __importDefault(require("fs/promises"));
function buildExtractionConfidence(text, invoice) {
    const hasEmail = Boolean(invoice.customerEmail);
    const hasAmount = invoice.items.some((item) => item.unitPrice > 0);
    const hasTaxId = /gstin|gst|vat|tax\s?id/i.test(text);
    const hasInvoiceNumber = /invoice\s?#?|inv[-\s]?\d+/i.test(text);
    return {
        overall: Math.round(([hasEmail, hasAmount, hasTaxId, hasInvoiceNumber].filter(Boolean).length / 4) * 100),
        fields: [
            { field: "customerEmail", label: "Customer email", value: invoice.customerEmail ?? "", confidence: hasEmail ? 95 : 20 },
            { field: "total", label: "Total amount", value: String(invoice.items[0]?.unitPrice ?? 0), confidence: hasAmount ? 86 : 30 },
            { field: "tax", label: "GST/VAT detection", value: hasTaxId ? "Detected" : "Not detected", confidence: hasTaxId ? 82 : 25 },
            { field: "invoiceNumber", label: "Invoice number", value: hasInvoiceNumber ? "Detected in text" : "", confidence: hasInvoiceNumber ? 78 : 18 },
        ],
    };
}
async function extractTextFromFile(filePath, mimeType) {
    if (mimeType === "application/pdf") {
        return "PDF text extraction placeholder. Install a PDF text extractor for production OCR on scanned PDFs.";
    }
    const stats = await promises_1.default.stat(filePath);
    return `Uploaded ${mimeType} image (${stats.size} bytes). Connect a managed OCR provider or Tesseract worker here for production extraction.`;
}


function inferInvoiceFromText(text) {
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    const amount = Number(text.match(/(?:total|amount due)\D+(\d+(?:\.\d{1,2})?)/i)?.[1] ?? 0);
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    return {
        businessName: lines[0] ?? "Your Business",
        customerName: lines.find((line) => /bill to|client|customer/i.test(line))?.replace(/bill to|client|customer/gi, "").trim() || "Imported Client",
        customerEmail: email,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        currency: "USD",
        notes: text.slice(0, 500),
        items: [
            {
                name: "Imported service",
                quantity: 1,
                unitPrice: amount || 100,
                taxRate: 0,
                discountRate: 0,
            },
        ],
    };
}
