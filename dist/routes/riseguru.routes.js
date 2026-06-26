"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.riseGuruRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../config/db");
const waitlistSchema = zod_1.z.object({
    email: zod_1.z.email(),
    channelSize: zod_1.z.enum(["under_10k", "10k_50k", "50k_200k", "200k_500k", "over_500k"]).optional(),
    primaryGoal: zod_1.z.enum(["views", "ctr", "sponsors", "revenue", "leads"]).optional(),
    source: zod_1.z.string().trim().min(1).max(80).optional(),
});
exports.riseGuruRouter = (0, express_1.Router)();
exports.riseGuruRouter.post("/waitlist", async (req, res, next) => {
    try {
        const body = waitlistSchema.parse(req.body);
        await db_1.pool.execute(`INSERT INTO riseguru_waitlist (email, channel_size, primary_goal, source)
       VALUES (:email, :channelSize, :primaryGoal, :source)
       ON DUPLICATE KEY UPDATE
         channel_size = VALUES(channel_size),
         primary_goal = VALUES(primary_goal),
         source = VALUES(source)`, {
            email: body.email.toLowerCase(),
            channelSize: body.channelSize ?? null,
            primaryGoal: body.primaryGoal ?? null,
            source: body.source ?? "landing_page",
        });
        res.status(201).json({ message: "You are on the RiseGuru waitlist" });
    }
    catch (error) {
        next(error);
    }
});
