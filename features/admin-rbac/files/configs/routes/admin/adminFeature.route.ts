import { Feature } from "@configs/enum";
import { AdminFeatureController } from "@controllers";
import { RailsRoute, RestActions } from "ts-rails";

export class AdminFeatureRoute extends RailsRoute {
  public draw() {
    this.resource(AdminFeatureController, {
      only: [RestActions.Index, RestActions.Show],
      setPermissionFor: Feature.RoleAndPermission,
    });
  }
}
