"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const env_1 = require("../config/env");
const email_service_1 = require("../services/email.service");
const jaipurMoversLeadSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(80),
    email: zod_1.z.string().trim().email().max(120).optional().or(zod_1.z.literal("")),
    phone: zod_1.z.string().trim().min(7).max(30),
    movingType: zod_1.z.string().trim().min(2).max(80),
    movingFrom: zod_1.z.string().trim().min(2).max(160),
    movingTo: zod_1.z.string().trim().min(2).max(160),
    page: zod_1.z.string().trim().max(200).optional(),
});
exports.leadRouter = (0, express_1.Router)();
exports.leadRouter.post("/jaipur-movers", async (req, res, next) => {
    try {
        const lead = jaipurMoversLeadSchema.parse(req.body);
        const to = env_1.env.leads.to;
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
        await (0, email_service_1.sendEmail)(to, `New moving enquiry from ${lead.name}`, html);
        res.status(201).json({ message: "Enquiry submitted successfully" });
    }
    catch (error) {
        next(error);
    }
});
function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
