import { Feature } from "@configs/enum";
import { Permission } from "@middlewares";
import { ApiV1AdminFeatureController } from "@controllers/api/v1/admin";
import { action, RailsRoute } from "ts-rails";

const readPerm = `${Feature.RoleAndPermission}::${Permission.Read}`;

export class ApiV1AdminFeatureRoute extends RailsRoute {
  public draw() {
    this.get("/", action(ApiV1AdminFeatureController, "index"), {
      setPermissionFor: readPerm,
      document: {
        summary: "List feature modules and permissions",
        tags: ["Admin Features"],
        auth: true,
        params: { search: "string" },
      },
    });
    this.get("/:id", action(ApiV1AdminFeatureController, "show"), {
      setPermissionFor: readPerm,
      document: {
        summary: "Feature detail with permissions",
        tags: ["Admin Features"],
        auth: true,
        params: { id: "string" },
      },
    });
  }
}
