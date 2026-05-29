import { AuthController } from "@controllers/api";
import {
  ChangeMyPasswordValidator,
  UpdateMyProfileValidator,
} from "@validators/auth.validator";
import { CurrentUserMiddleware, ValidateUserLoginMiddleware } from "@middlewares";
import { action, RailsRoute } from "ts-rails";
import { AuthRoute } from "./auth";

export class ApiV1Route extends RailsRoute {
  public draw() {
    this.path(action(CurrentUserMiddleware));

    this.path("/auth", AuthRoute.draw());

    this.path(action(ValidateUserLoginMiddleware));

    this.get("/auth/me", action(AuthController, "me"), {
      document: {
        summary: "Current user profile",
        tags: ["Auth"],
        auth: true,
        responses: { 200: "OK", 401: "Unauthorized" },
      },
    });

    this.patch("/auth/me/profile", action(AuthController, "updateProfile"), {
      document: {
        summary: "Update my profile",
        tags: ["Auth"],
        auth: true,
        body: UpdateMyProfileValidator,
      },
    });

    this.post("/auth/me/password", action(AuthController, "changePassword"), {
      document: {
        summary: "Change my password",
        tags: ["Auth"],
        auth: true,
        body: ChangeMyPasswordValidator,
      },
    });
  }
}
