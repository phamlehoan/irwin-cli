import { FlashType } from "@configs/enum";
import { NextFunction, Request, Response } from "express";
import { ApplicationMiddleware } from "./application.middleware";

/** Redirect guests to login when a route requires an authenticated user. */
export class ValidateUserLoginMiddleware extends ApplicationMiddleware {
  public async execute(req: Request, res: Response, next: NextFunction) {
    if (req.user) {
      return next();
    }
    const t = (res.locals?.t as (k: string) => string) || ((k: string) => k);
    if (req.originalUrl.includes("/api")) {
      return res.status(403).json({ success: false, error: t("flash.login_first") });
    }
    req.flash(FlashType.Errors, { msg: t("flash.login_first") });
    return res.redirect("/auth");
  }
}
