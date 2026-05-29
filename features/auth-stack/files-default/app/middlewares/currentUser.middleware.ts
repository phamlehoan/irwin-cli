import { verifyToken } from "@lib";
import { NextFunction, Request, Response } from "express";
import { ApplicationMiddleware } from "./application.middleware";

/**
 * JWT Bearer on `/api/*`; session `userId` on web.
 * Synced by irwin-cli when `auth` and/or `auth-api` is enabled (install order independent).
 */
export class CurrentUserMiddleware extends ApplicationMiddleware {
  public async execute(req: Request, _res: Response, next: NextFunction) {
    try {
      let userId: string | undefined;

      if (req.originalUrl.includes("/api")) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.split(" ")[1];
          try {
            userId = verifyToken(token)?.id;
          } catch {
            userId = undefined;
          }
        }
      } else {
        userId = req.session?.userId;
      }

      req.user = userId ? await this.getUserById(userId) : null;
      next();
    } catch {
      req.user = null;
      next();
    }
  }
}
