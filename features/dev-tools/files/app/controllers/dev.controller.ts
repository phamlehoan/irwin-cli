import { ApplicationController } from "./application.controller";

export class DevController extends ApplicationController {
  async index() {
    this.render("dev.view/index", {
      title: "Dev tools",
      appEnv: process.env.APP_ENV || process.env.NODE_ENV || "development",
    });
  }
}
