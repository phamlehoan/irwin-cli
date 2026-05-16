import { NextFunction, Request, Response } from "express";
import { ApplicationMiddleware } from "./application.middleware";

export class CurrentUserMiddleware extends ApplicationMiddleware {
  public async execute(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.session?.userId;
      req.user = userId ? await this.getUserById(userId) : null;
      next();
    } catch {
      req.user = null;
      next();
    }
  }
}
