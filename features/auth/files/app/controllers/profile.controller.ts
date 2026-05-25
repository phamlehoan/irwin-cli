import { FlashType } from "@configs/enum";
import models from "@models";
import { UpdateProfileValidator } from "@validators/profile.validator";
import { BeforeAction } from "ts-rails";
import { ApplicationController } from "./application.controller";

@BeforeAction("requireLogin")
export class ProfileController extends ApplicationController {
  async show() {
    const user = await models.user.findFirst({
      where: { id: this.currentUser!.id, deleted: false },
    });
    if (!user) {
      this.flash(FlashType.Errors, { msg: this.t("flash.user_not_found") });
      return this.redirect("/auth");
    }
    this.render("profile.view/show", {
      title: this.t("profile.title"),
      user,
    });
  }

  async update() {
    const userId = this.currentUser!.id;
    const data = await this.params(UpdateProfileValidator).permit(
      "firstName",
      "lastName",
      "phoneNumber",
      "address",
      "gender",
    );

    await models.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName.trim() }),
        ...(data.lastName !== undefined && { lastName: data.lastName.trim() }),
        ...(data.phoneNumber !== undefined && {
          phoneNumber: data.phoneNumber?.trim() || null,
        }),
        ...(data.address !== undefined && {
          address: data.address?.trim() || null,
        }),
        ...(data.gender !== undefined && {
          gender: data.gender?.trim() || null,
        }),
      },
    });

    this.flash(FlashType.Success, { msg: this.t("flash.profile_updated") });
    this.redirect("/me");
  }
}
