import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/db";
import { AppError } from "../middleware/error";

const industrySchema = z.enum([
  "restaurant",
  "dentist",
  "gym",
  "lawyer",
  "salon",
  "real-estate",
  "construction",
  "cleaning",
  "agency",
  "portfolio",
]);

const templateSchema = z.enum(["modern-local", "premium-dark", "clean-minimal"]);

const sitePayloadSchema = z.object({
  id: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(3).max(90).regex(/^[a-z0-9-]+$/),
  templateId: templateSchema,
  businessName: z.string().trim().min(2).max(180),
  tagline: z.string().trim().min(2).max(240),
  industry: industrySchema,
  phone: z.string().trim().min(5).max(60),
  email: z.string().trim().email().max(190),
  address: z.string().trim().min(2).max(500),
  city: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(120),
  logoUrl: z.string().trim().url().max(500).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  services: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  aboutText: z.string().trim().min(10).max(2500),
  openingHours: z.string().trim().min(2).max(180),
  whatsappNumber: z.string().trim().min(5).max(60),
  socialLinks: z.object({
    facebook: z.string().trim().max(500).optional(),
    instagram: z.string().trim().max(500).optional(),
    linkedin: z.string().trim().max(500).optional(),
    website: z.string().trim().max(500).optional(),
  }),
  testimonials: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    quote: z.string().trim().min(1).max(500),
  })).max(12),
  faq: z.array(z.object({
    question: z.string().trim().min(1).max(240),
    answer: z.string().trim().min(1).max(800),
  })).max(20),
  createdAt: z.string().datetime(),
});

const saveSiteSchema = z.object({
  site: sitePayloadSchema,
});

type BuildFastSiteRow = {
  slug: string;
  site_data: string | Record<string, unknown>;
  status: "draft" | "published" | "archived";
  is_paid: 0 | 1;
  created_at: Date;
  updated_at: Date;
};

export const buildFastRouter = Router();

buildFastRouter.post("/sites", async (req, res, next) => {
  try {
    const { site } = saveSiteSchema.parse(req.body);

    await pool.execute(
      `INSERT INTO buildfast_sites
        (slug, template_id, industry, business_name, city, country, site_data, status)
       VALUES
        (:slug, :templateId, :industry, :businessName, :city, :country, :siteData, 'draft')
       ON DUPLICATE KEY UPDATE
        template_id = VALUES(template_id),
        industry = VALUES(industry),
        business_name = VALUES(business_name),
        city = VALUES(city),
        country = VALUES(country),
        site_data = VALUES(site_data),
        updated_at = CURRENT_TIMESTAMP`,
      {
        slug: site.slug,
        templateId: site.templateId,
        industry: site.industry,
        businessName: site.businessName,
        city: site.city,
        country: site.country,
        siteData: JSON.stringify(site),
      },
    );

    // Future: associate site ownership with req.user after BuildFast auth is enabled.
    // Future: enforce paid export / hosted subdomain limits from pricing tables.
    res.status(201).json({ site });
  } catch (error) {
    next(error);
  }
});

buildFastRouter.get("/sites/:slug", async (req, res, next) => {
  try {
    const slug = z.string().trim().min(3).max(90).regex(/^[a-z0-9-]+$/).parse(req.params.slug);
    const [rows] = await pool.execute(
      "SELECT slug, site_data, status, is_paid, created_at, updated_at FROM buildfast_sites WHERE slug = :slug LIMIT 1",
      { slug },
    );
    const row = (rows as BuildFastSiteRow[])[0];

    if (!row) {
      throw new AppError(404, "BuildFast site not found");
    }

    res.json({
      site: typeof row.site_data === "string" ? JSON.parse(row.site_data) : row.site_data,
      status: row.status,
      isPaid: Boolean(row.is_paid),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

buildFastRouter.get("/sites", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 24), 100);
    const [rows] = await pool.execute(
      `SELECT slug, industry, template_id, business_name, city, country, status, is_paid, created_at, updated_at
       FROM buildfast_sites
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit },
    );
    res.json({ sites: rows });
  } catch (error) {
    next(error);
  }
});
