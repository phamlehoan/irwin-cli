import { User } from "@db";
import { AfterAction, logger, RailsController } from "ts-rails";
import { Authenticatable } from "./concerns/authenticatable";

type AuthenticatableMethods = typeof Authenticatable;

export interface ApplicationController
  extends AuthenticatableMethods {}

@AfterAction("logActionCompletion")
export class ApplicationController extends RailsController {
  protected flash(type: string, message: Record<string, string> | string) {
    (this.req as { flash: (t: string, m: unknown) => void }).flash(
      type,
      typeof message === "string" ? { msg: message } : message,
    );
  }

  protected get currentUser(): User | undefined {
    return (this.req as { user?: User }).user;
  }

  protected logActionCompletion() {
    logger.debug(`Action completed: ${this.req.method} ${this.req.originalUrl}`);
  }
}
