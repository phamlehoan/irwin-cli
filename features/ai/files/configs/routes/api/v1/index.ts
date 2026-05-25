import { ApiV1AiAssistantRoute } from "./aiAssistant.route";
import { RailsRoute } from "ts-rails";

export class ApiV1Route extends RailsRoute {
  public draw() {
    this.path("/ai", ApiV1AiAssistantRoute.draw());
  }
}
