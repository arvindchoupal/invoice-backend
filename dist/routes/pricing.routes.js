"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricingRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
exports.pricingRouter = (0, express_1.Router)();
exports.pricingRouter.get("/launch-offer", async (_req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute("SELECT claim_limit, claimed_count, active FROM launch_offers WHERE offer_key='founding-1000' LIMIT 1");
        const offer = rows[0];
        const limit = offer?.claim_limit ?? 1000;
        const claimed = Math.min(offer?.claimed_count ?? 0, limit);
        res.json({
            key: "founding-1000",
            limit,
            claimed,
            remaining: Math.max(limit - claimed, 0),
            active: Boolean(offer?.active) && claimed < limit,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.pricingRouter.get("/plans", async (_req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute("SELECT * FROM subscription_plans WHERE name <> 'starter' ORDER BY FIELD(name, 'free', 'pro', 'business')");
        res.json(rows);
    }
    catch (error) {
        next(error);
    }
});
exports.pricingRouter.get("/usage", auth_1.requireAuth, async (req, res, next) => {
    try {
        await db_1.pool.execute("INSERT IGNORE INTO user_plan_usage (user_id) VALUES (:userId)", { userId: req.user.id });
        const [rows] = await db_1.pool.execute("SELECT * FROM user_plan_usage WHERE user_id=:userId", { userId: req.user.id });
        res.json(rows[0]);
    }
    catch (error) {
        next(error);
    }
});
