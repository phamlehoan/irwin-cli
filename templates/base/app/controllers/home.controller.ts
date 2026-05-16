import { ApplicationController } from "./application.controller";

export class HomeController extends ApplicationController {
  async index() {
    this.render("home.view/index", {
      title: "{{appTitle}}",
    });
  }
}
