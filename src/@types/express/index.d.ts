import type { Role } from "../../utils/auth";

declare namespace Express {
  interface Request {
    user?: {
      id: number;
      role: Role;
      email: string;
    };
  }
}

export {};