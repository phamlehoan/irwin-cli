import { verifyToken } from "@lib";
import { NextFunction, Request, Response } from "express";
import { ApplicationMiddleware } from "./application.middleware";

const ADMIN_FEATURE_CODES = ["USM", "RAP"];

/** JWT on `/api`; session on web; permissions when `admin-rbac` is enabled. */
export class CurrentUserMiddleware extends ApplicationMiddleware {
  public async execute(req: Request, res: Response, next: NextFunction) {
    try {
      let userId: string | undefined;

      const isApiRequest = req.originalUrl.includes("/api");
      if (isApiRequest) {
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

      req.user = userId ? await this.getUserById(userId, true) : null;

      if (!isApiRequest) {
        const perms = req.user?.permissions ?? [];
        const locals = res.locals as Record<string, unknown>;
        locals.hasAdminAccess = perms.some((p: string) =>
          ADMIN_FEATURE_CODES.some((code) => p.startsWith(`${code}::`)),
        );
      }

      next();
    } catch {
      req.user = null;
      next();
    }
  }
}
