import { DevController } from "@controllers/dev.controller";
import { RailsRoute, RestActions } from "ts-rails";

export class DevRoute extends RailsRoute {
  public draw() {
    this.resource(DevController, {
      only: [RestActions.Index],
    });
  }
}
