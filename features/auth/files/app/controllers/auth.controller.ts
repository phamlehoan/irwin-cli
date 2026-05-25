import { FlashType } from "@configs/enum";
import { Prisma } from "@db";
import models from "@models";
import { PasswordType, UserStatus } from "@models/enums";
import {
  LoginValidator,
  UpdatePasswordValidator,
} from "@validators/auth.validator";
import { Security } from "ts-rails";
import { ApplicationController } from "./application.controller";

export class AuthController extends ApplicationController {
  async index() {
    if (this.currentUser) {
      return this.redirect("/");
    }
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
            msg: "Could not save session. Check SESSION_SECRET.",
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

  async edit() {
    const email = decodeURIComponent(String(this.req.params.email || ""))
      .trim()
      .toLowerCase();
    const user = this.currentUser;
    if (!user || user.email.toLowerCase() !== email) {
      this.flash(FlashType.Errors, { msg: this.t("flash.login_first") });
      return this.redirect("/auth");
    }

    const hasPassword = await models.password.findFirst({
      where: {
        userId: user.id,
        deleted: false,
        type: PasswordType.PASSWORD,
      },
    });

    this.render("auth.view/edit", {
      title: this.t("auth.change_password"),
      email,
      needsOldPassword: Boolean(hasPassword),
    });
  }

  async updatePassword() {
    const email = decodeURIComponent(String(this.req.params.email || ""))
      .trim()
      .toLowerCase();
    const user = this.currentUser;
    if (!user || user.email.toLowerCase() !== email) {
      this.flash(FlashType.Errors, { msg: this.t("flash.login_first") });
      return this.redirect("/auth");
    }

    const { password, passwordConfirmation, oldPassword } = await this.params(
      UpdatePasswordValidator,
    ).permit("password", "passwordConfirmation", "oldPassword");

    if (password !== passwordConfirmation) {
      this.flash(FlashType.Errors, { msg: this.t("flash.password_mismatch") });
      return this.redirect(`/auth/${encodeURIComponent(email)}/edit`);
    }

    const currentPwd = await models.password.findFirst({
      where: {
        userId: user.id,
        deleted: false,
        type: PasswordType.PASSWORD,
      },
    });

    if (currentPwd && oldPassword) {
      const ok = await Security.verifyPassword(oldPassword, currentPwd.password);
      if (!ok) {
        this.flash(FlashType.Errors, { msg: this.t("flash.wrong_old_password") });
        return this.redirect(`/auth/${encodeURIComponent(email)}/edit`);
      }
    } else if (currentPwd && !oldPassword) {
      this.flash(FlashType.Errors, { msg: this.t("flash.old_password_required") });
      return this.redirect(`/auth/${encodeURIComponent(email)}/edit`);
    }

    const hashed = await Security.hashPassword(password);
    if (currentPwd) {
      await models.password.update({
        where: { id: currentPwd.id },
        data: { password: hashed },
      });
    } else {
      await models.password.create({
        data: {
          userId: user.id,
          password: hashed,
          type: PasswordType.PASSWORD,
        },
      });
    }

    this.flash(FlashType.Success, { msg: this.t("flash.password_changed") });
    this.redirect("/me");
  }

  async destroy() {
    this.logoutUser();
    this.flash(FlashType.Info, { msg: this.t("flash.logged_out") });
    this.redirect("/auth");
  }
}
