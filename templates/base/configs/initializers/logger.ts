import env from "@configs/env";
import pino from "pino";
import { RailsApplication } from "ts-rails";

export function initializeLogger() {
  const pinoLogger = pino({
    level: env.appEnv === "development" ? "debug" : "info",
    transport:
      env.appEnv === "development"
        ? {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:standard" },
          }
        : undefined,
  });

  RailsApplication.loggerAdapter = {
    info: pinoLogger.info.bind(pinoLogger),
    warn: pinoLogger.warn.bind(pinoLogger),
    error: pinoLogger.error.bind(pinoLogger),
    debug: pinoLogger.debug.bind(pinoLogger),
  };
}
