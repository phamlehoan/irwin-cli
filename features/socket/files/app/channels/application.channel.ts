import type { Request } from "express";
import { RailsChannel } from "ts-rails";

export abstract class ApplicationChannel extends RailsChannel {
  protected getSessionUserId(): string | undefined {
    const req = this.socket.request as Request & {
      session?: { userId?: string };
    };
    return req.session?.userId;
  }
}
