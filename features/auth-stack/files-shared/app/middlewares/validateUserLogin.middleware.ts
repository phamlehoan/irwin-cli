import { FlashType } from "@configs/enum";
import { NextFunction, Request, Response } from "express";
import { ApplicationMiddleware } from "./application.middleware";

/** Web: flash + redirect; API: JSON (401). */
export class ValidateUserLoginMiddleware extends ApplicationMiddleware {
  public async execute(req: Request, res: Response, next: NextFunction) {
    if (req.user) return next();

    const t = (res.locals?.t as (k: string) => string) || ((k: string) => k);
    if (req.originalUrl.includes("/api")) {
      return res.status(401).json({ success: false, error: t("flash.login_first") });
    }

    req.flash(FlashType.Errors, { msg: t("flash.login_first") });
    return res.redirect("/auth");
  }
}
