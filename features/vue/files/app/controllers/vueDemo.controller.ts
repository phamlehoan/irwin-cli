import { ApplicationController } from "./application.controller";

export class VueDemoController extends ApplicationController {
  async index() {
    this.render("vueDemo.view/index", { title: "Vue demo" });
  }
}
