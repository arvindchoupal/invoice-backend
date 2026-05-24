"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const error_1 = require("../middleware/error");
const upload_1 = require("../middleware/upload");
const validators_1 = require("../utils/validators");
exports.settingsRouter = (0, express_1.Router)();
exports.settingsRouter.use(auth_1.requireAuth);
exports.settingsRouter.get("/", async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute("SELECT * FROM settings WHERE user_id = :userId", { userId: req.user.id });
        res.json(rows[0] ?? {});
    }
    catch (error) {
        next(error);
    }
});
exports.settingsRouter.put("/", async (req, res, next) => {
    try {
        const body = validators_1.settingsSchema.parse(req.body);
        await db_1.pool.execute(`INSERT INTO settings (user_id, company_name, company_email, company_address, company_tax_id, currency, tax_name, tax_rate, theme, invoice_prefix, default_pdf_style)
       VALUES (:userId, :companyName, :companyEmail, :companyAddress, :companyTaxId, :currency, :taxName, :taxRate, :theme, :invoicePrefix, :defaultPdfStyle)
       ON DUPLICATE KEY UPDATE company_name=:companyName, company_email=:companyEmail, company_address=:companyAddress,
       company_tax_id=:companyTaxId, currency=:currency, tax_name=:taxName, tax_rate=:taxRate, theme=:theme, invoice_prefix=:invoicePrefix,
       default_pdf_style=:defaultPdfStyle`, { userId: req.user.id, defaultPdfStyle: body.defaultPdfStyle ?? "classic", ...body });
        res.json(body);
    }
    catch (error) {
        next(error);
    }
});
exports.settingsRouter.post("/logo", upload_1.upload.single("logo"), async (req, res, next) => {
    try {
        if (!req.file?.mimetype.startsWith("image/"))
            throw new error_1.AppError(400, "Logo must be an image file");
        const logoUrl = req.file ? `/uploads/${req.file.filename}` : "";
        await db_1.pool.execute(`INSERT INTO settings (user_id, logo_url) VALUES (:userId, :logoUrl)
       ON DUPLICATE KEY UPDATE logo_url=:logoUrl`, { userId: req.user.id, logoUrl });
        res.json({ logoUrl });
    }
    catch (error) {
        next(error);
    }
});
exports.settingsRouter.delete("/logo", async (req, res, next) => {
    try {
        await db_1.pool.execute(`INSERT INTO settings (user_id, logo_url) VALUES (:userId, NULL)
       ON DUPLICATE KEY UPDATE logo_url=NULL`, { userId: req.user.id });
        res.json({ logoUrl: "" });
    }
    catch (error) {
        next(error);
    }
});
