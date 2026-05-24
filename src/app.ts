import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { pingDatabase } from "./config/db";
import { env } from "./config/env";
import { adminRouter } from "./routes/admin.routes";
import { aiRouter } from "./routes/ai.routes";
import { authRouter } from "./routes/auth.routes";
import { bookkeepingRouter } from "./routes/bookkeeping.routes";
import { clientRouter } from "./routes/client.routes";
import { documentRouter } from "./routes/document.routes";
import { invoiceRouter } from "./routes/invoice.routes";
import { paymentRouter } from "./routes/payment.routes";
import { portalRouter } from "./routes/portal.routes";
import { pricingRouter } from "./routes/pricing.routes";
import { recurringRouter } from "./routes/recurring.routes";
import { reportRouter } from "./routes/report.routes";
import { settingsRouter } from "./routes/settings.routes";
import { errorHandler, notFound } from "./middleware/error";

export const app = express();

app.use(helmet());
app.use(
  cors()
);

app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use("/uploads", express.static(path.resolve(env.uploadDir)));
app.get("/", (_, res) => {
    res.send("API runnings");
  });
app.get("/health", async (_req, res) => {
  try {
    await pingDatabase();
    res.json({ ok: true, service: "invoice-backend", db: "up" });
  } catch {
    res.status(503).json({ ok: false, service: "invoice-backend", db: "down" });
  }
});
app.use("/api/auth", authRouter);
app.use("/api/bookkeeping", bookkeepingRouter);
app.use("/api/clients", clientRouter);
app.use("/api/documents", documentRouter);
app.use("/api/invoices", invoiceRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/portal", portalRouter);
app.use("/api/pricing", pricingRouter);
app.use("/api/recurring", recurringRouter);
app.use("/api/reports", reportRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/admin", adminRouter);

app.use(notFound);
app.use(errorHandler);
