import env from "@configs/env";
import { NextFunction, Request, Response } from "express";

const store: Record<string, { count: number; resetAt: number }> = {};

export function rateLimitMiddleware() {
  const windowMs = 5 * 60 * 1000;
  const max = 300;

  return (req: Request, res: Response, next: NextFunction) => {
    if (env.appEnv === "development") return next();

    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    if (!store[key] || now > store[key].resetAt) {
      store[key] = { count: 1, resetAt: now + windowMs };
    } else {
      store[key].count++;
    }

    if (store[key].count > max) {
      return res.status(429).json({
        success: false,
        error: "Too many requests",
      });
    }
    next();
  };
}
