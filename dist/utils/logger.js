"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const logDir = path_1.default.resolve("logs");
if (!fs_1.default.existsSync(logDir))
    fs_1.default.mkdirSync(logDir, { recursive: true });
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL ?? "info",
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console({ format: winston_1.default.format.simple() }),
        new winston_1.default.transports.File({ filename: path_1.default.join(logDir, "app.log") }),
    ],
});
