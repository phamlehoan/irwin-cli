import { AuthController } from "@controllers/auth.controller";
import { action, RailsRoute } from "ts-rails";

export class AuthRoute extends RailsRoute {
  public draw() {
    this.get("/", action(AuthController, "index"));
    this.get("/google", action(AuthController, "loginWithGoogle"));
    this.get("/google/callback", action(AuthController, "loginWithGoogleRedirect"));
    this.post("/login", action(AuthController, "login"));
    this.post("/logout", action(AuthController, "destroy"));
    this.get("/:email/edit", action(AuthController, "edit"));
    this.post("/:email/password", action(AuthController, "updatePassword"));
  }
}
