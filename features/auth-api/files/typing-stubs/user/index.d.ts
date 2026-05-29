import type { User } from "@db";

declare global {
  namespace Express {
    interface Request {
      user?: User | null;
      requestId?: string;
    }
  }
}

export {};
