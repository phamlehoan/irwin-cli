import env from "@configs/env";
import bcrypt from "bcrypt";
import { RequestHandler } from "express";
import session from "express-session";
import { RailsApplication } from "ts-rails";

export function initializeSession(): RequestHandler {
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

export function initializeHash() {
  RailsApplication.hasher = {
    hash: async (password) => bcrypt.hash(password, 10),
    verify: async (password, hash) => bcrypt.compare(password, hash),
  };
}
