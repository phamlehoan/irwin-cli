import { AuthController } from "@controllers/auth.controller";
import { action, RailsRoute } from "ts-rails";

export class AuthRoute extends RailsRoute {
  public draw() {
    this.get("/", action(AuthController, "index"));
    this.post("/login", action(AuthController, "login"));
    this.post("/logout", action(AuthController, "destroy"));
  }
}
