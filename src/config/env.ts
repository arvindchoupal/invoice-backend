import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  db: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "123456",
    database: process.env.DB_NAME ?? "invoice_maker",
    /** Keep low on Hostinger shared MySQL (often 5–15 max per user). */
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 5),
    queueLimit: Number(process.env.DB_QUEUE_LIMIT ?? 25),
  },
  jwtSecret: process.env.JWT_SECRET ?? "local-development-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM ?? "InvoiceWala <billing@invoicewala.shop>",
  },
  leads: {
    to: process.env.LEAD_EMAIL_TO ?? process.env.SMTP_USER,
  },
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  retailx: {
    apiBaseUrl: process.env.RETAILX_API_BASE_URL ?? "https://retailxapp.com",
  },
  einvoice: {
    environment: process.env.EINVOICE_ENVIRONMENT ?? "sandbox",
    sandboxBaseUrl:
      process.env.EINVOICE_SANDBOX_BASE_URL ??
      "https://testapi.mygstcafe.com/eicore/v1.03",
    productionBaseUrl:
      process.env.EINVOICE_PRODUCTION_BASE_URL ??
      "https://api.mygstcafe.com/eicore/v1.03",
    gstin: process.env.EINVOICE_GSTIN,
    username: process.env.EINVOICE_USERNAME,
    password: process.env.EINVOICE_PASSWORD,
    customerId: process.env.EINVOICE_CUSTOMER_ID,
    apiId: process.env.EINVOICE_API_ID,
    apiSecret: process.env.EINVOICE_API_SECRET,
    source: process.env.EINVOICE_SOURCE ?? "API",
    customerName: process.env.EINVOICE_CUSTOMER_NAME,
    branch: process.env.EINVOICE_BRANCH,
  },
};
