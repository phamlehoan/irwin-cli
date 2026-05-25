import type { User } from "@db";
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: User | null;
      requestId?: string;
    }
  }
}

export {};
