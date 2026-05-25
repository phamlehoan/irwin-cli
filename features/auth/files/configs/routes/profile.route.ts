import { ProfileController } from "@controllers/profile.controller";
import { ValidateUserLoginMiddleware } from "@middlewares";
import { action, RailsRoute } from "ts-rails";

export class ProfileRoute extends RailsRoute {
  public draw() {
    const requireLogin = action(ValidateUserLoginMiddleware);
    this.get("/", [requireLogin, action(ProfileController, "show")]);
    this.post("/", [requireLogin, action(ProfileController, "update")]);
  }
}
