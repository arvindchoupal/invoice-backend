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
        return res.status(422).json({ message: "Validation failed", issues: error.issues });
    }
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
    }
    logger_1.logger.error("Unhandled error", { error });
    return res.status(500).json({ message: "Something went wrong" });
}
