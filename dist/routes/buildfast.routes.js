"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFastRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../config/db");
const error_1 = require("../middleware/error");
const industrySchema = zod_1.z.enum([
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
const templateSchema = zod_1.z.enum(["modern-local", "premium-dark", "clean-minimal"]);
const sitePayloadSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1).max(120),
    slug: zod_1.z.string().trim().min(3).max(90).regex(/^[a-z0-9-]+$/),
    templateId: templateSchema,
    businessName: zod_1.z.string().trim().min(2).max(180),
    tagline: zod_1.z.string().trim().min(2).max(240),
    industry: industrySchema,
    phone: zod_1.z.string().trim().min(5).max(60),
    email: zod_1.z.string().trim().email().max(190),
    address: zod_1.z.string().trim().min(2).max(500),
    city: zod_1.z.string().trim().min(2).max(120),
    country: zod_1.z.string().trim().min(2).max(120),
    logoUrl: zod_1.z.string().trim().url().max(500).optional(),
    primaryColor: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondaryColor: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/),
    services: zod_1.z.array(zod_1.z.string().trim().min(1).max(120)).min(1).max(20),
    aboutText: zod_1.z.string().trim().min(10).max(2500),
    openingHours: zod_1.z.string().trim().min(2).max(180),
    whatsappNumber: zod_1.z.string().trim().min(5).max(60),
    socialLinks: zod_1.z.object({
        facebook: zod_1.z.string().trim().max(500).optional(),
        instagram: zod_1.z.string().trim().max(500).optional(),
        linkedin: zod_1.z.string().trim().max(500).optional(),
        website: zod_1.z.string().trim().max(500).optional(),
    }),
    testimonials: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().trim().min(1).max(120),
        quote: zod_1.z.string().trim().min(1).max(500),
    })).max(12),
    faq: zod_1.z.array(zod_1.z.object({
        question: zod_1.z.string().trim().min(1).max(240),
        answer: zod_1.z.string().trim().min(1).max(800),
    })).max(20),
    createdAt: zod_1.z.string().datetime(),
});
const saveSiteSchema = zod_1.z.object({
    site: sitePayloadSchema,
});
exports.buildFastRouter = (0, express_1.Router)();
exports.buildFastRouter.post("/sites", async (req, res, next) => {
    try {
        const { site } = saveSiteSchema.parse(req.body);
        await db_1.pool.execute(`INSERT INTO buildfast_sites
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
        updated_at = CURRENT_TIMESTAMP`, {
            slug: site.slug,
            templateId: site.templateId,
            industry: site.industry,
            businessName: site.businessName,
            city: site.city,
            country: site.country,
            siteData: JSON.stringify(site),
        });
        // Future: associate site ownership with req.user after BuildFast auth is enabled.
        // Future: enforce paid export / hosted subdomain limits from pricing tables.
        res.status(201).json({ site });
    }
    catch (error) {
        next(error);
    }
});
exports.buildFastRouter.get("/sites/:slug", async (req, res, next) => {
    try {
        const slug = zod_1.z.string().trim().min(3).max(90).regex(/^[a-z0-9-]+$/).parse(req.params.slug);
        const [rows] = await db_1.pool.execute("SELECT slug, site_data, status, is_paid, created_at, updated_at FROM buildfast_sites WHERE slug = :slug LIMIT 1", { slug });
        const row = rows[0];
        if (!row) {
            throw new error_1.AppError(404, "BuildFast site not found");
        }
        res.json({
            site: typeof row.site_data === "string" ? JSON.parse(row.site_data) : row.site_data,
            status: row.status,
            isPaid: Boolean(row.is_paid),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.buildFastRouter.get("/sites", async (req, res, next) => {
    try {
        const limit = Math.min(Number(req.query.limit ?? 24), 100);
        const [rows] = await db_1.pool.execute(`SELECT slug, industry, template_id, business_name, city, country, status, is_paid, created_at, updated_at
       FROM buildfast_sites
       ORDER BY created_at DESC
       LIMIT :limit`, { limit });
        res.json({ sites: rows });
    }
    catch (error) {
        next(error);
    }
});
