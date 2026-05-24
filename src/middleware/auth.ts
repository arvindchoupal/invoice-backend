import type { NextFunction, Request, Response } from "express";
import { roleForEmail, verifyToken, type Role } from "../utils/auth";

export function requireAuth(req: any, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : typeof req.query.token === "string" ? req.query.token : undefined;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const user = verifyToken(token);
    req.user = { ...user, role: roleForEmail(user.email, user.role) };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}
