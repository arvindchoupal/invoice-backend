import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { sendEmail } from "../services/email.service";

const jaipurMoversLeadSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  phone: z.string().trim().min(7).max(30),
  movingType: z.string().trim().min(2).max(80),
  movingFrom: z.string().trim().min(2).max(160),
  movingTo: z.string().trim().min(2).max(160),
  page: z.string().trim().max(200).optional(),
});

export const leadRouter = Router();

leadRouter.post("/jaipur-movers", async (req, res, next) => {
  try {
    const lead = jaipurMoversLeadSchema.parse(req.body);
    const to = env.leads.to;

    if (!to) {
      return res.status(500).json({ message: "Lead email receiver is not configured" });
    }

    const html = `
      <h2>New enquiry - Shree International Packers and Movers</h2>
      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;font-family:Arial,sans-serif">
        <tr><td><b>Name</b></td><td>${escapeHtml(lead.name)}</td></tr>
        <tr><td><b>Phone</b></td><td>${escapeHtml(lead.phone)}</td></tr>
        <tr><td><b>Email</b></td><td>${escapeHtml(lead.email || "Not provided")}</td></tr>
        <tr><td><b>Moving Type</b></td><td>${escapeHtml(lead.movingType)}</td></tr>
        <tr><td><b>Moving From</b></td><td>${escapeHtml(lead.movingFrom)}</td></tr>
        <tr><td><b>Moving To</b></td><td>${escapeHtml(lead.movingTo)}</td></tr>
        <tr><td><b>Page</b></td><td>${escapeHtml(lead.page || "Website")}</td></tr>
      </table>
    `;

    await sendEmail(to, `New moving enquiry from ${lead.name}`, html);
    res.status(201).json({ message: "Enquiry submitted successfully" });
  } catch (error) {
    next(error);
  }
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
