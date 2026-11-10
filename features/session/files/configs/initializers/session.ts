import env from "@configs/env";
import { RequestHandler } from "express";
import session from "express-session";
import { RailsApplication } from "ts-rails";

export function initializeSession(): RequestHandler {
  // IRW-FIX-047: no public fallback secret; a missing value must stop the app.
  if (!env.sessionSecret) {
    throw new Error("SESSION_SECRET is not set. Add a long random value to .env (irwin add session generates one).");
  }
  const sessionMiddleware = session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.nodeEnv === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 3,
    },
  });

  RailsApplication.sessionMiddleware = sessionMiddleware;
  return sessionMiddleware;
}
