import { ApiResponse, RailsRoute } from "ts-rails";
import { checkReadiness } from "@configs/plugins/health";

export class ApiRoute extends RailsRoute {
  public draw() {
    this.get("/health", async (_req, res) => {
      const status = await checkReadiness();
      const code = status.status === "ok" ? 200 : 503;
      res.status(code).json(ApiResponse.ok(status));
    });
  }
}
