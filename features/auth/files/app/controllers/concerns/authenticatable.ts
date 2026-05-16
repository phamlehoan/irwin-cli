import { FlashType } from "@configs/enum";
import type { ApplicationController } from "../application.controller";

export const Authenticatable = {
  logoutUser(this: ApplicationController) {
    if (this.req.session?.userId) {
      this.req.session.userId = undefined;
    }
    (this.req as { user?: unknown }).user = undefined;
  },

  authenticateUser(this: ApplicationController): boolean {
    if (!this.currentUser) {
      if (this.req.originalUrl.includes("/api")) {
        this.res
          .status(401)
          .json({ success: false, error: this.t("flash.login_first") });
        return false;
      }
      this.flash(FlashType.Errors, { msg: this.t("flash.login_first") });
      this.redirect("/auth");
      return false;
    }
    return true;
  },
};
