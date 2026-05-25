import { UserController } from "@controllers/user.controller";
import { action, RailsRoute } from "ts-rails";

export class UserRoute extends RailsRoute {
  public draw() {
    this.get("/new", action(UserController, "new"));
    this.post("/", action(UserController, "create"));
  }
}
