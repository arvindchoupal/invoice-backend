import { Router } from "express";
import { pool } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../middleware/error";
import { upload } from "../middleware/upload";
import { settingsSchema } from "../utils/validators";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/", async (req:any, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM settings WHERE user_id = :userId", { userId: req.user!.id });
    res.json((rows as unknown[])[0] ?? {});
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/", async (req:any, res, next) => {
  try {
    const body = settingsSchema.parse(req.body);
    await pool.execute(
      `INSERT INTO settings (user_id, company_name, company_email, company_address, company_tax_id, currency, tax_name, tax_rate, theme, invoice_prefix)
       VALUES (:userId, :companyName, :companyEmail, :companyAddress, :companyTaxId, :currency, :taxName, :taxRate, :theme, :invoicePrefix)
       ON DUPLICATE KEY UPDATE company_name=:companyName, company_email=:companyEmail, company_address=:companyAddress,
       company_tax_id=:companyTaxId, currency=:currency, tax_name=:taxName, tax_rate=:taxRate, theme=:theme, invoice_prefix=:invoicePrefix`,
      { userId: req.user!.id, ...body },
    );
    res.json(body);
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/logo", upload.single("logo"), async (req:any, res, next) => {
  try {
    if (!req.file?.mimetype.startsWith("image/")) throw new AppError(400, "Logo must be an image file");
    const logoUrl = req.file ? `/uploads/${req.file.filename}` : "";
    await pool.execute(
      `INSERT INTO settings (user_id, logo_url) VALUES (:userId, :logoUrl)
       ON DUPLICATE KEY UPDATE logo_url=:logoUrl`,
      { userId: req.user!.id, logoUrl },
    );
    res.json({ logoUrl });
  } catch (error) {
    next(error);
  }
});
