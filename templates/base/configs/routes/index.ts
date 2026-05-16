import { HomeController } from "@controllers";
import { RailsRoute, RestActions } from "ts-rails";

// @irwin:routes-imports

export class Route extends RailsRoute {
  public draw() {
    // @irwin:routes-draw
    this.resource(HomeController, {
      only: [RestActions.Index],
    });
  }
}
