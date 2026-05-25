import { FlashType } from "@configs/enum";
import models from "@models";
import { PasswordType, UserStatus } from "@models/enums";
import { RegisterUserValidator } from "@validators/auth.validator";
import { Security } from "ts-rails";
import { ApplicationController } from "./application.controller";

export class UserController extends ApplicationController {
  async new() {
    if (this.currentUser) {
      return this.redirect("/");
    }
    this.render("user.view/new", { title: this.t("users.register_title") });
  }

  async create() {
    if (this.currentUser) {
      return this.redirect("/");
    }

    const data = await this.params(RegisterUserValidator).permit(
      "firstName",
      "lastName",
      "email",
      "password",
      "passwordConfirmation",
    );

    const email = data.email.trim().toLowerCase();
    if (data.password !== data.passwordConfirmation) {
      this.flash(FlashType.Errors, { msg: this.t("flash.password_mismatch") });
      return this.redirect("/users/new");
    }

    const existing = await models.user.findFirst({
      where: { email, deleted: false },
    });
    if (existing) {
      this.flash(FlashType.Errors, {
        msg: this.t("flash.registration_email_exists"),
      });
      return this.redirect("/users/new");
    }

    const hashed = await Security.hashPassword(data.password);
    await models.user.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email,
        status: UserStatus.ACTIVE,
        passwords: {
          create: {
            password: hashed,
            type: PasswordType.PASSWORD,
          },
        },
      },
    });

    this.flash(FlashType.Success, {
      msg: this.t("flash.registration_success", { email }),
    });
    this.redirect("/auth");
  }
}
