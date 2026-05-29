import { FlashType } from "@configs/enum";
import { isMailDeliveryConfigured } from "@lib/utils/mailConfig";
import { AuthRegisterService } from "@services/auth/authRegister.service";
import { RegisterUserValidator } from "@validators/auth.validator";
import { UnprocessableEntityError } from "ts-rails";
import { ApplicationController } from "./application.controller";

export class UserController extends ApplicationController {
  async new() {
    if (this.currentUser) {
      return this.redirect("/");
    }
    this.render("user.view/new", {
      title: this.t("users.register_title"),
      mailActivationRequired: isMailDeliveryConfigured(),
    });
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

    try {
      const result = await new AuthRegisterService().execute(data);

      if (result.activationRequired) {
        this.flash(
          result.emailSent ? FlashType.Success : FlashType.Errors,
          {
            msg: result.emailSent
              ? this.t("flash.registration_invite_sent", { email: result.email })
              : this.t("flash.registration_invite_failed", {
                  email: result.email,
                }),
          },
        );
      } else {
        this.flash(FlashType.Success, {
          msg: this.t("flash.registration_success", { email: result.email }),
        });
      }
    } catch (e) {
      if (e instanceof UnprocessableEntityError) {
        if (e.message === "REGISTRATION_EMAIL_EXISTS") {
          this.flash(FlashType.Errors, {
            msg: this.t("flash.registration_email_exists"),
          });
          return this.redirect("/users/new");
        }
        if (e.message === "PASSWORD_MISMATCH") {
          this.flash(FlashType.Errors, { msg: this.t("flash.password_mismatch") });
          return this.redirect("/users/new");
        }
      }
      throw e;
    }

    this.redirect("/auth");
  }
}
