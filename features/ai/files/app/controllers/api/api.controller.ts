import { ApplicationController } from "../application.controller";
import { ApiResponse } from "ts-rails";

export class ApiController extends ApplicationController {
  protected renderJson(data: unknown, status = 200): void {
    this.res.status(status).json(ApiResponse.ok(data));
  }

  protected renderError(message: string, status = 400): void {
    this.res.status(status).json(ApiResponse.error(message));
  }
}
