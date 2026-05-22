import { Router } from "express";
import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import { requireAuth } from "../middleware/auth";
import { comparePassword, hashPassword, randomToken, signToken } from "../utils/auth";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "../utils/validators";
import { sendPasswordResetEmail } from "../services/email.service";

export const authRouter = Router();

authRouter.post("/signup", async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);
    const passwordHash = await hashPassword(body.password);
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password_hash) VALUES (:name, :email, :passwordHash)",
      { ...body, passwordHash },
    );
    const id = Number((result as { insertId: number }).insertId);
    const token = signToken({ id, email: body.email, role: "user" });
    res.status(201).json({ token, user: { id, name: body.name, email: body.email, role: "user" } });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return next(new AppError(409, "Email already exists"));
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const [rows] = await pool.execute("SELECT id, name, email, role, password_hash FROM users WHERE email = :email", {
      email: body.email,
    });
    const user = (rows as Array<{ id: number; name: string; email: string; role: "admin" | "user"; password_hash: string }>)[0];
    if (!user || !(await comparePassword(body.password, user.password_hash))) throw new AppError(401, "Invalid credentials");
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const token = randomToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await pool.execute("UPDATE users SET reset_token = :token, reset_expires = :expires WHERE email = :email", { token, expires, email });
    await sendPasswordResetEmail(email, token);
    res.json({ message: "If the email exists, a reset link has been sent" });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const body = resetPasswordSchema.parse(req.body);
    const passwordHash = await hashPassword(body.password);
    const [result] = await pool.execute(
      "UPDATE users SET password_hash = :passwordHash, reset_token = NULL, reset_expires = NULL WHERE reset_token = :token AND reset_expires > NOW()",
      { passwordHash, token: body.token },
    );
    if ((result as { affectedRows: number }).affectedRows === 0) throw new AppError(400, "Invalid or expired reset token");
    res.json({ message: "Password updated" });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req:any, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT id, name, email, role, avatar_url FROM users WHERE id = :id", { id: req.user!.id });
    res.json((rows as unknown[])[0]);
  } catch (error) {
    next(error);
  }
});

authRouter.put("/profile", requireAuth, async (req:any, res, next) => {
  try {
    const { name, email } = signupSchema.pick({ name: true, email: true }).parse(req.body);
    await pool.execute("UPDATE users SET name = :name, email = :email WHERE id = :id", { name, email, id: req.user!.id });
    res.json({ id: req.user!.id, name, email, role: req.user!.role });
  } catch (error) {
    next(error);
  }
});
