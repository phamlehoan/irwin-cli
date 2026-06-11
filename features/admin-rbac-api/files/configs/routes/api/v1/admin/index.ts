import { RailsRoute } from "ts-rails";
import { ApiV1AdminFeatureRoute } from "./features.route";
import { ApiV1AdminRoleRoute } from "./roles.route";
import { ApiV1AdminUserRoute } from "./users.route";

export class ApiV1AdminRoute extends RailsRoute {
  public draw() {
    this.path("/users", ApiV1AdminUserRoute.draw());
    this.path("/roles", ApiV1AdminRoleRoute.draw());
    this.path("/features", ApiV1AdminFeatureRoute.draw());
  }
}
