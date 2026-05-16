import models from "@models";
import { BeforeAction } from "ts-rails";
import { ApplicationController } from "../application.controller";

@BeforeAction("requireLogin")
export class AdminController extends ApplicationController {
  async index() {
    const userCount = await models.user.count({
      where: { deleted: false },
    });
    this.render("admin/dashboard.view/index", {
      title: this.t("admin.dashboard"),
      activeMenu: "home",
      userCount,
    });
  }
}
