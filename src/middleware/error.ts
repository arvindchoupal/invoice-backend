import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));
    const message = issues.length
      ? issues.map((issue) => `${issue.path || "request"}: ${issue.message}`).join("; ")
      : "Validation failed";
    return res.status(422).json({ message, issues });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (typeof error === "object" && error && "code" in error) {
    const dbError = error as { code?: string; sqlMessage?: string };
    if (dbError.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Invoice number already exists. Please use a different invoice number." });
    }
    if (dbError.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(422).json({ message: "Selected client or related record does not exist." });
    }
    if (dbError.code === "WARN_DATA_TRUNCATED" || dbError.code === "ER_TRUNCATED_WRONG_VALUE") {
      return res.status(422).json({ message: dbError.sqlMessage ?? "Invalid value for one of the invoice fields." });
    }
  }

  logger.error("Unhandled error", { error });
  return res.status(500).json({ message: "Something went wrong" });
}
