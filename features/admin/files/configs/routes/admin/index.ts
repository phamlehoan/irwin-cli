import { AdminController } from "@controllers";
import { RailsRoute, RestActions } from "ts-rails";
import { AdminUserRoute } from "./adminUser.route";

export class AdminRoute extends RailsRoute {
  public draw() {
    this.path("/users", AdminUserRoute.draw());
    this.resource(AdminController, {
      only: [RestActions.Index],
    });
  }
}
