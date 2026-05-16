import { AdminUserController } from "@controllers";
import { RailsRoute } from "ts-rails";

export class AdminUserRoute extends RailsRoute {
  public draw() {
    this.resource(AdminUserController);
  }
}
