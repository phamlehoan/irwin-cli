import { Feature } from "@configs/enum";
import { ApiV1AdminUserController } from "@controllers/api/v1/admin";
import {
  CreateUserValidator,
  UpdateUserValidator,
} from "@validators/admin.validator";
import { RailsRoute } from "ts-rails";

export class ApiV1AdminUserRoute extends RailsRoute {
  public draw() {
    this.resource(ApiV1AdminUserController, {
      setPermissionForAny: [Feature.UserManagement],
      document: {
        tags: ["Admin Users"],
        auth: true,
      },
      documentByAction: {
        create: { body: CreateUserValidator },
        update: { body: UpdateUserValidator },
      },
    });
  }
}
