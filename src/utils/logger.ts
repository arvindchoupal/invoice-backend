import fs from "fs";
import path from "path";
import winston from "winston";

const logDir = path.resolve("logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: path.join(logDir, "app.log") }),
  ],
});
