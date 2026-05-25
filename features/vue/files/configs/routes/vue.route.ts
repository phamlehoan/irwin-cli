import { VueDemoController } from "@controllers/vueDemo.controller";
import { action, RailsRoute } from "ts-rails";

export class VueRoute extends RailsRoute {
  public draw() {
    this.get("/", action(VueDemoController, "index"));
  }
}
