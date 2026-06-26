import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/db";

const waitlistSchema = z.object({
  email: z.email(),
  channelSize: z.enum(["under_10k", "10k_50k", "50k_200k", "200k_500k", "over_500k"]).optional(),
  primaryGoal: z.enum(["views", "ctr", "sponsors", "revenue", "leads"]).optional(),
  source: z.string().trim().min(1).max(80).optional(),
});

export const riseGuruRouter = Router();

riseGuruRouter.post("/waitlist", async (req, res, next) => {
  try {
    const body = waitlistSchema.parse(req.body);
    await pool.execute(
      `INSERT INTO riseguru_waitlist (email, channel_size, primary_goal, source)
       VALUES (:email, :channelSize, :primaryGoal, :source)
       ON DUPLICATE KEY UPDATE
         channel_size = VALUES(channel_size),
         primary_goal = VALUES(primary_goal),
         source = VALUES(source)`,
      {
        email: body.email.toLowerCase(),
        channelSize: body.channelSize ?? null,
        primaryGoal: body.primaryGoal ?? null,
        source: body.source ?? "landing_page",
      },
    );
    res.status(201).json({ message: "You are on the RiseGuru waitlist" });
  } catch (error) {
    next(error);
  }
});
