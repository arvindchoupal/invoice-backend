"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.notFound = notFound;
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
class AppError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.AppError = AppError;
function notFound(req, res) {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
}
function errorHandler(error, _req, res, _next) {
    if (error instanceof zod_1.ZodError) {
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
        const dbError = error;
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
    logger_1.logger.error("Unhandled error", { error });
    return res.status(500).json({ message: "Something went wrong" });
}
