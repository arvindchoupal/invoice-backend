"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.randomToken = randomToken;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
function hashPassword(password) {
    return bcryptjs_1.default.hash(password, 12);
}
function comparePassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.env.jwtSecret, { expiresIn: env_1.env.jwtExpiresIn });
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
}
function randomToken() {
    return (0, crypto_1.randomBytes)(32).toString("hex");
}
