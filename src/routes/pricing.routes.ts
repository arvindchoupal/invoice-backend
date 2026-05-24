import { Router } from "express";
import { pool } from "../config/db";
import { requireAuth } from "../middleware/auth";

export const pricingRouter = Router();

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
