"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const env_1 = require("../config/env");
const uploadPath = path_1.default.resolve(env_1.env.uploadDir);
if (!fs_1.default.existsSync(uploadPath))
    fs_1.default.mkdirSync(uploadPath, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: uploadPath,
    filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
        cb(null, `${Date.now()}-${safeName}`);
    },
});
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
        cb(null, allowed.includes(file.mimetype));
    },
});
