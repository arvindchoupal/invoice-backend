"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db");
const error_1 = require("../middleware/error");
const auth_1 = require("../middleware/auth");
const auth_2 = require("../utils/auth");
const validators_1 = require("../utils/validators");
const email_service_1 = require("../services/email.service");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/signup", async (req, res, next) => {
    try {
        const body = validators_1.signupSchema.parse(req.body);
        const passwordHash = await (0, auth_2.hashPassword)(body.password);
        const role = (0, auth_2.roleForEmail)(body.email);
        const [result] = await db_1.pool.execute("INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :passwordHash, :role)", { ...body, passwordHash, role });
        const id = Number(result.insertId);
        const token = (0, auth_2.signToken)({ id, email: body.email, role });
        res.status(201).json({ token, user: { id, name: body.name, email: body.email, role } });
    }
    catch (error) {
        if (error.code === "ER_DUP_ENTRY")
            return next(new error_1.AppError(409, "Email already exists"));
        next(error);
    }
});
exports.authRouter.post("/login", async (req, res, next) => {
    try {
        const body = validators_1.loginSchema.parse(req.body);
        const [rows] = await db_1.pool.execute("SELECT id, name, email, role, password_hash FROM users WHERE email = :email", {
            email: body.email,
        });
        const user = rows[0];
        if (!user || !(await (0, auth_2.comparePassword)(body.password, user.password_hash)))
            throw new error_1.AppError(401, "Invalid credentials");
        const role = (0, auth_2.roleForEmail)(user.email, user.role);
        if (role !== user.role)
            await db_1.pool.execute("UPDATE users SET role = :role WHERE id = :id", { role, id: user.id });
        const token = (0, auth_2.signToken)({ id: user.id, email: user.email, role });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role } });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post("/forgot-password", async (req, res, next) => {
    try {
        const { email } = validators_1.forgotPasswordSchema.parse(req.body);
        const token = (0, auth_2.randomToken)();
        const expires = new Date(Date.now() + 60 * 60 * 1000);
        await db_1.pool.execute("UPDATE users SET reset_token = :token, reset_expires = :expires WHERE email = :email", { token, expires, email });
        await (0, email_service_1.sendPasswordResetEmail)(email, token);
        res.json({ message: "If the email exists, a reset link has been sent" });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post("/reset-password", async (req, res, next) => {
    try {
        const body = validators_1.resetPasswordSchema.parse(req.body);
        const passwordHash = await (0, auth_2.hashPassword)(body.password);
        const [result] = await db_1.pool.execute("UPDATE users SET password_hash = :passwordHash, reset_token = NULL, reset_expires = NULL WHERE reset_token = :token AND reset_expires > NOW()", { passwordHash, token: body.token });
        if (result.affectedRows === 0)
            throw new error_1.AppError(400, "Invalid or expired reset token");
        res.json({ message: "Password updated" });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.get("/me", auth_1.requireAuth, async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.execute("SELECT id, name, email, role, avatar_url FROM users WHERE id = :id", { id: req.user.id });
        const user = rows[0];
        if (!user)
            throw new error_1.AppError(404, "User not found");
        const role = (0, auth_2.roleForEmail)(user.email, user.role);
        if (role !== user.role)
            await db_1.pool.execute("UPDATE users SET role = :role WHERE id = :id", { role, id: user.id });
        res.json({ ...user, role });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.put("/profile", auth_1.requireAuth, async (req, res, next) => {
    try {
        const { name, email } = validators_1.signupSchema.pick({ name: true, email: true }).parse(req.body);
        const role = (0, auth_2.roleForEmail)(email, req.user.role);
        await db_1.pool.execute("UPDATE users SET name = :name, email = :email, role = :role WHERE id = :id", { name, email, role, id: req.user.id });
        res.json({ id: req.user.id, name, email, role });
    }
    catch (error) {
        next(error);
    }
});
