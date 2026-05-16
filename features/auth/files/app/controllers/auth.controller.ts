import { FlashType } from "@configs/enum";
import { Prisma } from "@db";
import models from "@models";
import { PasswordType, UserStatus } from "@models/enums";
import { LoginValidator } from "@validators/auth.validator";
import { Security } from "ts-rails";
import { ApplicationController } from "./application.controller";

export class AuthController extends ApplicationController {
  async index() {
    this.logoutUser();
    this.render("auth.view/index", { title: this.t("auth.welcome_back") });
  }

  async login() {
    const { email: rawEmail, password } = await this.params(LoginValidator).permit(
      "email",
      "password",
    );
    const email = rawEmail.trim().toLowerCase();

    const user = await models.user.findFirst({
      where: { email, status: UserStatus.ACTIVE, deleted: false },
      include: {
        passwords: {
          where: { deleted: false, type: PasswordType.PASSWORD },
          orderBy: { createdAt: Prisma.SortOrder.desc },
          take: 1,
        },
      },
    });

    if (
      user &&
      user.passwords.length > 0 &&
      (await Security.verifyPassword(password, user.passwords[0].password))
    ) {
      this.req.session!.userId = user.id;
      this.req.session!.save((err) => {
        if (err) {
          this.flash(FlashType.Errors, {
            msg: "Could not save session. Check SESSION_SECRET and cookies.",
          });
          return this.redirect("/auth");
        }
        this.flash(FlashType.Success, { msg: this.t("flash.login_success") });
        this.redirect("/");
      });
      return;
    }

    this.flash(FlashType.Errors, { msg: this.t("flash.user_not_found") });
    this.redirect("/auth");
  }

  async destroy() {
    this.logoutUser();
    this.flash(FlashType.Info, { msg: this.t("flash.logged_out") });
    this.redirect("/auth");
  }
}
