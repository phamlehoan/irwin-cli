import { NextFunction, Request, Response } from "express";
import { logger } from "ts-rails";

export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: Date.now() - start,
    });
  });
  next();
}
