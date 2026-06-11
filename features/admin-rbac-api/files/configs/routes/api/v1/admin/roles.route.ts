import { Feature } from "@configs/enum";
import { Permission } from "@middlewares";
import { ApiV1AdminRoleController } from "@controllers/api/v1/admin";
import {
  RoleCreateValidator,
  RoleUpdateValidator,
} from "@validators/role.validator";
import { action, RailsRoute } from "ts-rails";

export class ApiV1AdminRoleRoute extends RailsRoute {
  public draw() {
    this.resource(ApiV1AdminRoleController, {
      setPermissionFor: Feature.RoleAndPermission,
      document: {
        tags: ["Admin Roles"],
        auth: true,
      },
      documentByAction: {
        create: { body: RoleCreateValidator },
        update: { body: RoleUpdateValidator },
      },
    });

    const updatePerms = [`${Feature.RoleAndPermission}::${Permission.Update}`];

    this.get(
      "/:id/assign-candidates",
      action(ApiV1AdminRoleController, "assignCandidates"),
      {
        setPermissionForAny: updatePerms,
        document: {
          summary: "Users available to assign to role",
          tags: ["Admin Roles"],
          auth: true,
          params: { id: "string", search: "string" },
        },
      },
    );
    this.post(
      "/:id/assign-users",
      action(ApiV1AdminRoleController, "assignUsers"),
      {
        setPermissionForAny: updatePerms,
        document: {
          summary: "Assign users to role",
          tags: ["Admin Roles"],
          auth: true,
          params: { id: "string" },
          body: { userIds: "string[]" },
        },
      },
    );
    this.delete(
      "/:id/users/:userId",
      action(ApiV1AdminRoleController, "unassignUser"),
      {
        setPermissionForAny: updatePerms,
        document: {
          summary: "Remove user from role",
          tags: ["Admin Roles"],
          auth: true,
          params: { id: "string", userId: "string" },
        },
      },
    );
  }
}
