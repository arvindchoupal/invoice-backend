import { Router } from "express";
import { pool } from "../config/db";
import { requireAuth } from "../middleware/auth";

export const pricingRouter = Router();

pricingRouter.get("/launch-offer", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT claim_limit, claimed_count, active FROM launch_offers WHERE offer_key='founding-1000' LIMIT 1",
    );
    const offer = (rows as Array<{ claim_limit: number; claimed_count: number; active: number }>)[0];
    const limit = offer?.claim_limit ?? 1000;
    const claimed = Math.min(offer?.claimed_count ?? 0, limit);
    res.json({
      key: "founding-1000",
      limit,
      claimed,
      remaining: Math.max(limit - claimed, 0),
      active: Boolean(offer?.active) && claimed < limit,
    });
  } catch (error) {
    next(error);
  }
});

pricingRouter.get("/plans", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM subscription_plans WHERE name <> 'starter' ORDER BY FIELD(name, 'free', 'pro', 'business')",
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

pricingRouter.get("/usage", requireAuth, async (req:any, res, next) => {
  try {
    await pool.execute("INSERT IGNORE INTO user_plan_usage (user_id) VALUES (:userId)", { userId: req.user!.id });
    const [rows] = await pool.execute("SELECT * FROM user_plan_usage WHERE user_id=:userId", { userId: req.user!.id });
    res.json((rows as unknown[])[0]);
  } catch (error) {
    next(error);
  }
});
