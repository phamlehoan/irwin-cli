import { createHash, randomUUID } from "crypto";
import env from "@configs/env";
import jwt, { SignOptions } from "jsonwebtoken";

export interface JwtPayload extends jwt.JwtPayload {
  id?: string;
  purpose?: string;
}

/**
 * IRW-FIX-047: read lazily and fail closed. There is no fallback to the session secret or to a
 * public string, because a token signed with a known secret is a forged login.
 */
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET || (env as { jwtSecret?: string }).jwtSecret;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Add a long random value to .env (irwin add auth-api generates one).");
  }
  return secret;
}

export function generateToken(payload: object, expiresIn: string = "3h"): string {
  return jwt.sign({ ...payload, jti: randomUUID() }, jwtSecret(), {
    expiresIn: expiresIn as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, jwtSecret());
  if (typeof decoded === "string") throw new Error("Invalid token payload");
  return decoded as JwtPayload;
}

/** Refresh tokens are stored hashed: a database leak must not hand out working sessions. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
